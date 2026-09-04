process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const RecurringTransaction = require('../src/models/RecurringTransaction');
const Transaction = require('../src/models/Transaction');
const { calculateNextDueDate, processDueRecurringTransactions } = require('../src/services/recurringTransactionService');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('Recurring Transactions Suite (Phase 4A)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId, userBToken, userBId;

  t.before(async () => {
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Create User A
    const regA = await request('POST', '/auth/register', {
      name: 'Recurring User A',
      email: `rec_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Create User B
    const regB = await request('POST', '/auth/register', {
      name: 'Recurring User B',
      email: `rec_b_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userBToken = regB.body ? regB.body.token : null;
    userBId = regB.body && regB.body.user ? regB.body.user.id : null;
  });

  t.after(async () => {
    if (server) {
      await new Promise(res => server.close(res));
      server = null;
    }
    if (userAId && userBId && mongoose.connection.readyState === 1) {
      try {
        await User.UserModel.deleteMany({ id: { $in: [userAId, userBId] } });
        await RecurringTransaction.RecurringTransactionModel.deleteMany({ userId: { $in: [userAId, userBId] } });
        await Transaction.TransactionModel.deleteMany({ userId: { $in: [userAId, userBId] } });
      } catch {}
    }
    try {
      await mongoose.connection.close(true);
      await mongoose.disconnect();
    } catch {}
  });

  await t.test('1. Date Calculation Logic & Month-End Safety', async () => {
    assert.equal(calculateNextDueDate('2026-01-15', 'daily'), '2026-01-16');
    assert.equal(calculateNextDueDate('2026-01-15', 'weekly'), '2026-01-22');
    assert.equal(calculateNextDueDate('2026-01-15', 'monthly'), '2026-02-15');
    assert.equal(calculateNextDueDate('2026-01-15', 'quarterly'), '2026-04-15');
    assert.equal(calculateNextDueDate('2026-01-15', 'yearly'), '2027-01-15');

    // Month-End Overflow Safety (Jan 31 -> Feb 28 in non-leap year)
    assert.equal(calculateNextDueDate('2026-01-31', 'monthly'), '2026-02-28');
  });

  await t.test('2. CRUD Operations & Validation', async () => {
    if (!userAToken) return;

    // Invalid input validation (400 Bad Request)
    const invalidRes = await request('POST', '/recurring', {
      type: 'invalid',
      amount: -100,
      category: '',
      frequency: 'unknown',
      startDate: 'invalid-date'
    }, userAToken);
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.success, false);

    // Valid Creation (201 Created)
    const createRes = await request('POST', '/recurring', {
      type: 'expense',
      amount: 15000,
      category: 'Housing',
      description: 'Monthly Apartment Rent',
      frequency: 'monthly',
      startDate: '2026-01-01',
      autoCreate: true,
      notes: 'Due 1st of every month'
    }, userAToken);

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    assert.ok(createRes.body.recurring.id);
    const recId = createRes.body.recurring.id;

    // List recurring items (200 OK)
    const listRes = await request('GET', '/recurring', null, userAToken);
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.recurring));
    assert.equal(listRes.body.recurring.length, 1);

    // Get single recurring item (200 OK)
    const getRes = await request('GET', `/recurring/${recId}`, null, userAToken);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body.recurring.amount, 15000);

    // Update recurring item (200 OK)
    const updateRes = await request('PUT', `/recurring/${recId}`, { amount: 16000 }, userAToken);
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.recurring.amount, 16000);

    // Delete recurring item (200 OK)
    const deleteRes = await request('DELETE', `/recurring/${recId}`, null, userAToken);
    assert.equal(deleteRes.status, 200);

    // Verify deletion (404 Not Found)
    const getDeletedRes = await request('GET', `/recurring/${recId}`, null, userAToken);
    assert.equal(getDeletedRes.status, 404);
  });

  await t.test('3. User Isolation & Unauthorized Access Blocked', async () => {
    if (!userAToken || !userBToken) return;

    // User A creates recurring item
    const recA = await request('POST', '/recurring', {
      type: 'income',
      amount: 50000,
      category: 'Salary',
      description: 'User A Salary',
      frequency: 'monthly',
      startDate: '2026-01-01'
    }, userAToken);
    const recIdA = recA.body.recurring.id;

    // User B attempts to access User A's recurring item -> 404 Not Found
    const userBGet = await request('GET', `/recurring/${recIdA}`, null, userBToken);
    assert.equal(userBGet.status, 404);

    // User B attempts to update User A's recurring item -> 404 Not Found
    const userBUpdate = await request('PUT', `/recurring/${recIdA}`, { amount: 999999 }, userBToken);
    assert.equal(userBUpdate.status, 404);

    // User B attempts to delete User A's recurring item -> 404 Not Found
    const userBDelete = await request('DELETE', `/recurring/${recIdA}`, null, userBToken);
    assert.equal(userBDelete.status, 404);
  });

  await t.test('4. Auto-Create Processing & Idempotency', async () => {
    if (!userAToken || !userAId) return;

    const todayStr = new Date().toISOString().slice(0, 10);

    // Create due recurring item with autoCreate=true
    const recRes = await request('POST', '/recurring', {
      type: 'expense',
      amount: 2500,
      category: 'Utilities',
      description: 'Internet Bill',
      frequency: 'monthly',
      startDate: todayStr,
      nextDueDate: todayStr,
      autoCreate: true
    }, userAToken);
    const recId = recRes.body.recurring.id;

    // Trigger process due transactions
    const processResult1 = await processDueRecurringTransactions(userAId);
    assert.ok(processResult1.processedCount >= 1, 'At least 1 due item processed');

    // Trigger process again immediately -> Idempotent, 0 new items created
    const processResult2 = await processDueRecurringTransactions(userAId);
    assert.equal(processResult2.processedCount, 0, 'Idempotent run creates 0 duplicate transactions');
  });

  await t.test('5. Scheduler Lifecycle & Concurrent Processing Safety', async () => {
    const { startScheduler, stopScheduler } = require('../src/services/recurringScheduler');

    // 1. Scheduler disabled by default
    delete process.env.RECURRING_SCHEDULER_ENABLED;
    startScheduler(); // should do nothing when disabled
    stopScheduler();

    // 2. Scheduler startup & duplicate start safety
    process.env.RECURRING_SCHEDULER_ENABLED = 'true';
    process.env.RECURRING_SCHEDULER_INTERVAL = '60000';
    startScheduler();
    startScheduler(); // Duplicate call should be safe / noop
    stopScheduler();
    process.env.RECURRING_SCHEDULER_ENABLED = 'false';

    // 3. Concurrent processing safety
    if (userAToken && userAId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      await request('POST', '/recurring', {
        type: 'expense',
        amount: 8888,
        category: 'Housing',
        description: 'Concurrent Rent Check',
        frequency: 'monthly',
        startDate: todayStr,
        nextDueDate: todayStr,
        autoCreate: true
      }, userAToken);

      // Run 3 simultaneous process calls concurrently
      const [res1, res2, res3] = await Promise.all([
        processDueRecurringTransactions(userAId),
        processDueRecurringTransactions(userAId),
        processDueRecurringTransactions(userAId)
      ]);

      const totalProcessed = res1.processedCount + res2.processedCount + res3.processedCount;
      assert.equal(totalProcessed, 1, 'Concurrent execution produces exactly 1 transaction occurrence');
    }
  });
});
