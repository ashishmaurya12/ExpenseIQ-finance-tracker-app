process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Reminder = require('../src/models/Reminder');
const reminderService = require('../src/services/reminderService');

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

test('Bill Reminders Suite (Phase 4A)', async (t) => {
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
      name: 'Reminder User A',
      email: `rem_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Create User B
    const regB = await request('POST', '/auth/register', {
      name: 'Reminder User B',
      email: `rem_b_${timestamp}@example.com`,
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
        await Reminder.ReminderModel.deleteMany({ userId: { $in: [userAId, userBId] } });
      } catch {}
    }
    try {
      await mongoose.connection.close(true);
      await mongoose.disconnect();
    } catch {}
  });

  await t.test('1. Reminder CRUD Operations & Validation', async () => {
    if (!userAToken) return;

    // Invalid input -> 400 Bad Request
    const invalid = await request('POST', '/reminders', {
      title: '',
      amount: -50,
      dueDate: 'bad-date'
    }, userAToken);
    assert.equal(invalid.status, 400);

    // Valid Creation -> 201 Created
    const createRes = await request('POST', '/reminders', {
      title: 'Electricity Bill',
      amount: 2400,
      dueDate: '2026-12-31',
      category: 'Utilities',
      priority: 'high',
      reminderDaysBefore: 5
    }, userAToken);

    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.success, true);
    const remId = createRes.body.reminder.id;

    // List Reminders -> 200 OK
    const listRes = await request('GET', '/reminders', null, userAToken);
    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.reminders));
    assert.ok(listRes.body.reminders.length >= 1);

    // Complete Reminder -> 200 OK
    const completeRes = await request('POST', `/reminders/${remId}/complete`, null, userAToken);
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.reminder.status, 'completed');
    assert.ok(completeRes.body.reminder.completedAt);

    // Delete Reminder -> 200 OK
    const deleteRes = await request('DELETE', `/reminders/${remId}`, null, userAToken);
    assert.equal(deleteRes.status, 200);
  });

  await t.test('2. Overdue Calculation & Status Transition', async () => {
    if (!userAId || !userAToken) return;

    // Create a pending reminder with a past due date
    const pastReminder = await Reminder.create({
      userId: userAId,
      title: 'Past Credit Card Bill',
      amount: 5000,
      dueDate: '2025-01-01',
      status: 'pending',
      priority: 'high'
    });

    // Mark overdue
    const updatedCount = await reminderService.markOverdueReminders(userAId);
    assert.ok(updatedCount >= 1, 'Past pending reminder marked overdue');

    const fetched = await Reminder.findById(pastReminder.id, userAId);
    assert.equal(fetched.status, 'overdue');
  });

  await t.test('3. User Isolation & Unauthorized Access Blocked', async () => {
    if (!userAToken || !userBToken) return;

    // User A creates reminder
    const remA = await request('POST', '/reminders', {
      title: 'User A Rent',
      amount: 20000,
      dueDate: '2026-10-01'
    }, userAToken);
    const remIdA = remA.body.reminder.id;

    // User B access attempts -> 404 Not Found
    const bGet = await request('GET', `/reminders/${remIdA}`, null, userBToken);
    assert.equal(bGet.status, 404);

    const bComplete = await request('POST', `/reminders/${remIdA}/complete`, null, userBToken);
    assert.equal(bComplete.status, 404);

    const bDelete = await request('DELETE', `/reminders/${remIdA}`, null, userBToken);
    assert.equal(bDelete.status, 404);
  });
});
