process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Notification = require('../src/models/Notification');
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

test('Expense Anomaly Detection Suite (Phase 4B)', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('anomalies');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });

    const regA = await request('POST', '/auth/register', {
      name: 'Anomaly User A',
      email: `anom_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Seed normal transactions (Food category average ~1000)
    await request('POST', '/transactions', { type: 'expense', amount: 1000, category: 'Food', date: '2026-08-01' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 1100, category: 'Food', date: '2026-08-05' }, userAToken);
    await request('POST', '/transactions', { type: 'expense', amount: 950, category: 'Food', date: '2026-08-10' }, userAToken);

    // Seed Anomaly (Food spike of 25000 -> Z-Score > 2.0 & Category spike > 1.5x)
    await request('POST', '/transactions', { type: 'expense', amount: 25000, category: 'Food', date: '2026-08-25', note: 'Luxury Banquet Outlier' }, userAToken);
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
        await Notification.NotificationModel.deleteMany({ userId: userAId });
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('GET /api/anomalies detects statistical transaction outlier', async () => {
    const res = await request('GET', '/anomalies?month=2026-08', null, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.anomalies));
    assert.ok(res.body.anomalies.length > 0);

    const spike = res.body.anomalies.find(a => a.amount === 25000);
    assert.ok(spike);
    assert.equal(spike.category, 'Food');
    assert.ok(spike.zScore > 2.0 || spike.deviationMultiplier >= 1.5);
  });

  await t.test('POST /api/anomalies/analyze triggers scan and creates notification', async () => {
    const res = await request('POST', '/anomalies/analyze', {}, userAToken);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.analyzedCount >= 1);

    // Verify notification was created
    const notifs = await request('GET', '/notifications', null, userAToken);
    assert.equal(notifs.status, 200);
    const anomalyNotif = notifs.body.notifications.find(n => n.type === 'anomaly' || n.type === 'ANOMALY_DETECTED');
    assert.ok(anomalyNotif);
  });
});
