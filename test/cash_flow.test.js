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

test('Cash-Flow Forecasting & Risk Evaluation Suite (Phase 4B)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('cash_flow');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const regA = await request('POST', '/auth/register', {
      name: 'Cash Flow User A',
      email: `cash_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Seed historical data over 3 months with valid categories
    await request('POST', '/transactions', { type: 'income', amount: 60000, category: 'Salary', date: '2026-06-15' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 35000, category: 'Rent', date: '2026-06-20' }, userAToken);

    await request('POST', '/transactions', { type: 'income', amount: 62000, category: 'Salary', date: '2026-07-15' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 38000, category: 'Rent', date: '2026-07-20' }, userAToken);

    await request('POST', '/transactions', { type: 'income', amount: 64000, category: 'Salary', date: '2026-08-15' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 40000, category: 'Rent', date: '2026-08-20' }, userAToken);
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
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('GET /api/cash-flow/forecast calculates 3-month forecast', async () => {
    const res = await request('GET', '/cash-flow/forecast?months=3', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.forecast.horizonMonths, 3);
    assert.equal(res.body.forecast.forecastMonths.length, 3);

    const firstMonth = res.body.forecast.forecastMonths[0];
    assert.ok(firstMonth.projectedIncome > 0);
    assert.ok(firstMonth.projectedExpense > 0);
    assert.ok(firstMonth.upperNetBound >= firstMonth.projectedNetCashFlow);
    assert.ok(firstMonth.lowerNetBound <= firstMonth.projectedNetCashFlow);
  });

  await t.test('GET /api/cash-flow/forecast supports 1 to 12 months horizon', async () => {
    const res = await request('GET', '/cash-flow/forecast?months=6', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.forecast.horizonMonths, 6);
    assert.equal(res.body.forecast.forecastMonths.length, 6);
  });

  await t.test('GET /api/cash-flow/risk identifies cash-flow risk factors', async () => {
    const res = await request('GET', '/cash-flow/risk?months=3', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.riskEvaluation.risks));
    assert.ok(typeof res.body.riskEvaluation.hasHighRisk === 'boolean');
  });
});
