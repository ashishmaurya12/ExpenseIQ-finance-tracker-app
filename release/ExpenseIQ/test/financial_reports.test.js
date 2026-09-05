process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');
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

test('AI Monthly Financial Reports Suite (Phase 4B)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('financial_reports');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const regA = await request('POST', '/auth/register', {
      name: 'Report User A',
      email: `report_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Seed data with valid categories
    await request('POST', '/transactions', { type: 'income', amount: 80000, category: 'Salary', date: '2026-08-01' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 25000, category: 'Rent', date: '2026-08-05' }, userAToken);
    await request('POST', '/budgets', { category: 'Rent', monthlyLimit: 30000 }, userAToken);
    await request('POST', '/goals', { title: 'Vacation', targetAmount: 20000, savedAmount: 5000 }, userAToken);
  });

  t.after(async () => {
    if (server) {
      await new Promise(res => server.close(res));
      server = null;
    }
    if (userAId && mongoose.connection.readyState === 1) {
      try {
        await User.UserModel.deleteMany({ id: userAId });
        await Transaction.TransactionModel.deleteMany({ userId: userAId });
        await Budget.BudgetModel.deleteMany({ userId: userAId });
        await Goal.GoalModel.deleteMany({ userId: userAId });
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('GET /api/financial-reports/monthly generates 10 structured sections', async () => {
    const res = await request('GET', '/financial-reports/monthly?month=2026-08', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.report);
    assert.equal(res.body.report.month, '2026-08');
    assert.ok(Array.isArray(res.body.report.sections));
    assert.equal(res.body.report.sections.length, 10);

    const titles = res.body.report.sections.map(s => s.title);
    assert.ok(titles.includes('Executive Summary'));
    assert.ok(titles.includes('Income Analysis'));
    assert.ok(titles.includes('Expense Breakdown'));
    assert.ok(titles.includes('Budget vs Actual Performance'));
    assert.ok(titles.includes('Financial Health Score 2.0 Breakdown'));
    assert.ok(titles.includes('Actionable AI Recommendations'));
  });
});
