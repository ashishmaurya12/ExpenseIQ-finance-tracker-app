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

test('Financial Health Score 2.0 Suite (Phase 4B)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('financial_health');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const regA = await request('POST', '/auth/register', {
      name: 'Health User A',
      email: `health_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Seed data: High savings rate, good budget adherence, goal progress
    await request('POST', '/transactions', { type: 'income', amount: 100000, category: 'Salary', date: '2026-08-01' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 30000, category: 'Rent', date: '2026-08-05' }, userAToken);
    await request('POST', '/budgets', { category: 'Rent', monthlyLimit: 40000 }, userAToken);
    await request('POST', '/goals', { title: 'Emergency Fund', targetAmount: 50000, savedAmount: 40000 }, userAToken);
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

  await t.test('GET /api/financial-health returns transparent 0-100 score and grade', async () => {
    const res = await request('GET', '/financial-health', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(typeof res.body.financialHealth.overallScore === 'number');
    assert.ok(res.body.financialHealth.overallScore >= 0 && res.body.financialHealth.overallScore <= 100);
    assert.ok(['A', 'B', 'C', 'D', 'F'].includes(res.body.financialHealth.grade));

    // Verify 6 components exist
    const comps = res.body.financialHealth.components;
    assert.ok(comps.savingsRateScore);
    assert.ok(comps.budgetAdherenceScore);
    assert.ok(comps.goalProgressScore);
    assert.ok(comps.debtRatioScore);
    assert.ok(comps.expenseStabilityScore);
    assert.ok(comps.emergencyFundRatioScore);
  });

  await t.test('GET /api/financial-health/recommendations returns actionable advice', async () => {
    const res = await request('GET', '/financial-health/recommendations', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.recommendations));
  });
});
