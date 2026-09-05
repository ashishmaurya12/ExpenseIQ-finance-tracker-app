process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');

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

const { setupTestIsolation } = require('./helpers/testSetup');

test('Core Application Regression & Health Contract Suite', async (t) => {
  const timestamp = Date.now();
  let userToken, userId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('regression');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    const reg = await request('POST', '/auth/register', {
      name: 'Regression User',
      email: `reg_user_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userToken = reg.body ? reg.body.token : null;
    userId = reg.body && reg.body.user ? reg.body.user.id : null;
  });

  t.after(async () => {
    if (server) {
      await new Promise(res => server.close(res));
      server = null;
    }
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.close(true);
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('1. Health Endpoint Healthy Contract (GET /api/health → 200 OK)', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 1,
      configurable: true,
      writable: true
    });

    const health = await request('GET', '/health');
    assert.equal(health.status, 200, 'Healthy DB returns exact HTTP 200');
    assert.equal(health.body.success, true);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.database, 'connected');

    delete mongoose.connection.readyState;
  });

  await t.test('2. Health Endpoint Degraded Contract (GET /api/health → 503 Degraded)', async () => {
    Object.defineProperty(mongoose.connection, 'readyState', {
      value: 0,
      configurable: true,
      writable: true
    });

    const degraded = await request('GET', '/health');
    assert.equal(degraded.status, 503, 'Degraded DB returns exact HTTP 503');
    assert.equal(degraded.body.success, false);
    assert.equal(degraded.body.status, 'degraded');
    assert.equal(degraded.body.database, 'disconnected');

    delete mongoose.connection.readyState;
  });

  await t.test('3. Auth User Profile & Password Change', async () => {
    if (!userToken) return;
    const profile = await request('PUT', '/auth/profile', { name: 'Updated Reg User', currency: 'INR' }, userToken);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.user.name, 'Updated Reg User');

    const changePw = await request('PUT', '/auth/password', {
      currentPassword: 'Password123!',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!'
    }, userToken);
    assert.equal(changePw.status, 200);

    // Login with new password
    const login = await request('POST', '/auth/login', {
      email: `reg_user_${timestamp}@example.com`,
      password: 'NewPassword123!'
    });
    assert.equal(login.status, 200);
    userToken = login.body.token;
  });

  await t.test('4. Transactions CRUD & Pagination', async () => {
    if (!userToken) return;
    const today = new Date().toISOString().slice(0, 10);
    const createTxn = await request('POST', '/transactions', {
      type: 'expense',
      amount: 1200,
      category: 'Food',
      date: today,
      note: 'Dinner'
    }, userToken);
    assert.equal(createTxn.status, 201);
    const txnId = createTxn.body.transaction.id;

    const listTxns = await request('GET', '/transactions?page=1&limit=10', null, userToken);
    assert.equal(listTxns.status, 200);
    assert.ok(Array.isArray(listTxns.body.transactions));
    assert.ok(listTxns.body.pagination);

    const deleteTxn = await request('DELETE', `/transactions/${txnId}`, null, userToken);
    assert.equal(deleteTxn.status, 200);
  });

  await t.test('5. Budgets CRUD', async () => {
    if (!userToken) return;
    const createB = await request('POST', '/budgets', {
      category: 'Utilities',
      monthlyLimit: 5000
    }, userToken);
    assert.equal(createB.status, 201);
    const budgetId = createB.body.budget.id;

    const listB = await request('GET', '/budgets', null, userToken);
    assert.equal(listB.status, 200);
    assert.ok(Array.isArray(listB.body.budgets));

    const deleteB = await request('DELETE', `/budgets/${budgetId}`, null, userToken);
    assert.equal(deleteB.status, 200);
  });

  await t.test('6. Goals CRUD & Funding', async () => {
    if (!userToken) return;
    const createG = await request('POST', '/goals', {
      name: 'New Laptop',
      targetAmount: 80000,
      savedAmount: 20000,
      deadline: '2026-12-31'
    }, userToken);
    assert.equal(createG.status, 201);
    const goalId = createG.body.goal.id;

    const fundG = await request('POST', `/goals/${goalId}/fund`, { amount: 5000 }, userToken);
    assert.equal(fundG.status, 200);
    assert.equal(fundG.body.goal.savedAmount, 25000);

    const deleteG = await request('DELETE', `/goals/${goalId}`, null, userToken);
    assert.equal(deleteG.status, 200);
  });

  await t.test('7. API 404 Catch-All', async () => {
    const notFound = await request('GET', '/non-existent-route');
    assert.equal(notFound.status, 404);
    assert.equal(notFound.body.success, false);
  });
});
