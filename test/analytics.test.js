process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const { setupTestIsolation } = require('./helpers/testSetup');

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
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test('Advanced Analytics Suite (Phase 4B)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId, userBToken, userBId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('analytics');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const regA = await request('POST', '/auth/register', {
      name: 'Analytics User A',
      email: `analy_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    const regB = await request('POST', '/auth/register', {
      name: 'Analytics User B',
      email: `analy_b_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userBToken = regB.body ? regB.body.token : null;
    userBId = regB.body && regB.body.user ? regB.body.user.id : null;

    // Seed User A Transactions with valid categories
    await request('POST', '/transactions', { type: 'income', amount: 50000, category: 'Salary', date: '2026-08-01', note: 'Aug Salary' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 15000, category: 'Rent', date: '2026-08-05', note: 'Rent' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 5000, category: 'Food', date: '2026-08-10', note: 'Groceries' }, userAToken);

    await request('POST', '/transactions', { type: 'income', amount: 55000, category: 'Salary', date: '2026-09-01', note: 'Sep Salary' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 16000, category: 'Rent', date: '2026-09-05', note: 'Rent' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 6000, category: 'Food', date: '2026-09-12', note: 'Groceries' }, userAToken);
  });

  t.after(async () => {
    if (server) {
      await new Promise(res => server.close(res));
      server = null;
    }
    if (userAId && userBId && mongoose.connection.readyState === 1) {
      try {
        await User.UserModel.deleteMany({ id: { $in: [userAId, userBId] } });
        await Transaction.TransactionModel.deleteMany({ userId: { $in: [userAId, userBId] } });
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('GET /api/analytics/overview returns financial metrics', async () => {
    const res = await request('GET', '/analytics/overview?month=2026-09', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.overview.month, '2026-09');
    assert.equal(res.body.overview.income, 55000);
    assert.equal(res.body.overview.expense, 22000);
    assert.equal(res.body.overview.balance, 33000);
  });

  await t.test('GET /api/analytics/trends returns breakdown by period', async () => {
    const res = await request('GET', '/analytics/trends?month=2026-09', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.trends));
  });

  await t.test('GET /api/analytics/categories returns expense category breakdown', async () => {
    const res = await request('GET', '/analytics/categories?month=2026-09', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.categories));
    const rent = res.body.categories.find(c => c.category === 'Rent');
    assert.ok(rent);
    assert.equal(rent.amount, 16000);
  });

  await t.test('GET /api/analytics/monthly returns historical monthly metrics', async () => {
    const res = await request('GET', '/analytics/monthly?months=6', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.monthlyHistory));
  });

  await t.test('GET /api/analytics/comparison compares two periods correctly', async () => {
    const res = await request('GET', '/analytics/comparison?month=2026-09&compareMonth=2026-08', null, userAToken);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.success, true, JSON.stringify(res.body));
    assert.equal(res.body.comparison?.current?.income, 55000, JSON.stringify(res.body));
    assert.equal(res.body.comparison?.previous?.income, 50000, JSON.stringify(res.body));
    assert.ok(res.body.comparison?.changes?.income?.percentageChange > 0, JSON.stringify(res.body));
  });

  await t.test('User isolation enforced on analytics', async () => {
    const res = await request('GET', '/analytics/overview?month=2026-09', null, userBToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.overview.income, 0);
    assert.equal(res.body.overview.expense, 0);
  });
});
