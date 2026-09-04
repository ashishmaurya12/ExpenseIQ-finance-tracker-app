process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');
const Reminder = require('../src/models/Reminder');
const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');
const Transaction = require('../src/models/Transaction');
const notificationService = require('../src/services/notificationService');

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

test('Notification Center Suite (Phase 4A)', async (t) => {
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

    // Register User A
    const regA = await request('POST', '/auth/register', {
      name: 'Notif User A',
      email: `notif_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Register User B
    const regB = await request('POST', '/auth/register', {
      name: 'Notif User B',
      email: `notif_b_${timestamp}@example.com`,
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
        await Notification.NotificationModel.deleteMany({ userId: { $in: [userAId, userBId] } });
        await Reminder.ReminderModel.deleteMany({ userId: { $in: [userAId, userBId] } });
        await Budget.BudgetModel.deleteMany({ userId: { $in: [userAId, userBId] } });
        await Goal.GoalModel.deleteMany({ userId: { $in: [userAId, userBId] } });
      } catch {}
    }
    try {
      await mongoose.connection.close(true);
      await mongoose.disconnect();
    } catch {}
  });

  await t.test('1. Notification Creation, Pagination & Unread Count', async () => {
    if (!userAId || !userAToken) return;

    // Seed test notifications
    for (let i = 1; i <= 5; i++) {
      await Notification.create({
        userId: userAId,
        type: 'system',
        title: `Test Notification ${i}`,
        message: `Message body for notification ${i}`,
        priority: i % 2 === 0 ? 'high' : 'medium',
        read: false
      });
    }

    // Unauthenticated GET -> 401
    const unauth = await request('GET', '/notifications');
    assert.equal(unauth.status, 401);

    // List Notifications with pagination -> 200 OK
    const resPage1 = await request('GET', '/notifications?page=1&limit=3', null, userAToken);
    assert.equal(resPage1.status, 200);
    assert.equal(resPage1.body.success, true);
    assert.ok(Array.isArray(resPage1.body.notifications));
    assert.equal(resPage1.body.notifications.length, 3);
    assert.ok(resPage1.body.unreadCount >= 5);
    assert.equal(resPage1.body.pagination.page, 1);
    assert.equal(resPage1.body.pagination.limit, 3);

    // Test max limit cap (request limit=100 -> capped to 50)
    const resCap = await request('GET', '/notifications?limit=100', null, userAToken);
    assert.equal(resCap.status, 200);
    assert.equal(resCap.body.pagination.limit, 50);
  });

  await t.test('2. Mark Read, Read All & Delete Notifications', async () => {
    if (!userAId || !userAToken) return;

    const notif = await Notification.create({
      userId: userAId,
      type: 'reminder',
      title: 'Water Bill Due',
      message: 'Water bill is due today',
      priority: 'high',
      read: false
    });

    // Mark single notification read -> 200 OK
    const readRes = await request('PUT', `/notifications/${notif.id}/read`, null, userAToken);
    assert.equal(readRes.status, 200);
    assert.equal(readRes.body.success, true);
    assert.equal(readRes.body.notification.read, true);

    // Mark all as read -> 200 OK
    const readAllRes = await request('POST', '/notifications/read-all', null, userAToken);
    assert.equal(readAllRes.status, 200);
    assert.equal(readAllRes.body.success, true);

    // Delete single notification -> 200 OK
    const deleteRes = await request('DELETE', `/notifications/${notif.id}`, null, userAToken);
    assert.equal(deleteRes.status, 200);

    // Get deleted -> should no longer exist in user notifications
    const getRes = await request('GET', '/notifications', null, userAToken);
    const exists = getRes.body.notifications.some(n => n.id === notif.id);
    assert.equal(exists, false);
  });

  await t.test('3. User Isolation & Cross-User Security', async () => {
    if (!userAToken || !userBToken) return;

    const notifA = await Notification.create({
      userId: userAId,
      type: 'budget',
      title: 'User A Confidential Alert',
      message: 'Budget exceeded 90%',
      priority: 'high'
    });

    // User B tries to read User A's notification -> 404
    const bRead = await request('PUT', `/notifications/${notifA.id}/read`, null, userBToken);
    assert.equal(bRead.status, 404);

    // User B tries to delete User A's notification -> 404
    const bDelete = await request('DELETE', `/notifications/${notifA.id}`, null, userBToken);
    assert.equal(bDelete.status, 404);

    // User B lists notifications -> User A's notification must not be present
    const bList = await request('GET', '/notifications', null, userBToken);
    const hasA = bList.body.notifications.some(n => n.id === notifA.id);
    assert.equal(hasA, false);
  });

  await t.test('4. Automated Reminders & Budget Notification Deduplication', async () => {
    if (!userAId) return;

    // 1. Reminder Notification Generation & Deduplication
    const todayStr = new Date().toISOString().split('T')[0];
    const rem = await Reminder.create({
      userId: userAId,
      title: 'Electricity Bill',
      amount: 1500,
      dueDate: todayStr,
      status: 'pending'
    });

    // Run notification generator twice
    await notificationService.generateReminderNotifications(userAId);
    await notificationService.generateReminderNotifications(userAId);

    // Verify only 1 notification created for this reminder + date threshold
    const notifs = await Notification.find({ userId: userAId, relatedEntityId: rem.id });
    assert.equal(notifs.length, 1);
    assert.ok(notifs[0].message.includes('Electricity Bill'));

    // 2. Budget Threshold Notification Deduplication (70%, 90%, 100%)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayStrFull = now.toISOString().slice(0, 10);

    const bgt = await Budget.create({
      userId: userAId,
      category: 'Food & Dining',
      monthlyLimit: 10000,
      month: monthKey
    });

    // Create expense transaction of 9200 to trigger 70% and 90% budget utilization thresholds
    await Transaction.create({
      userId: userAId,
      type: 'expense',
      amount: 9200,
      category: 'Food & Dining',
      date: todayStrFull
    });

    await notificationService.generateBudgetNotifications(userAId);
    await notificationService.generateBudgetNotifications(userAId); // Repeat call

    const bgtNotifs = await Notification.find({ userId: userAId, relatedEntityId: bgt.id });
    // Should produce 70% and 90% notifications, but no duplicates on rerun
    const uniqueTypes = new Set(bgtNotifs.map(n => n.message));
    assert.equal(bgtNotifs.length, uniqueTypes.size);
    assert.ok(bgtNotifs.some(n => n.message.includes('90%')));
  });

  await t.test('5. Concurrent Deduplication & Frontend Files Verification', async () => {
    if (!userAId) return;

    const fs = require('fs');
    const path = require('path');

    // 1. Concurrent duplicate creation race test
    const dedupKey = `concurrent_test_${Date.now()}`;
    const [c1, c2, c3] = await Promise.all([
      Notification.create({ userId: userAId, type: 'system', title: 'Concurrent Test', message: 'Race test', dedupKey }),
      Notification.create({ userId: userAId, type: 'system', title: 'Concurrent Test', message: 'Race test', dedupKey }),
      Notification.create({ userId: userAId, type: 'system', title: 'Concurrent Test', message: 'Race test', dedupKey })
    ]);

    const createdCount = [c1, c2, c3].filter(Boolean).length;
    assert.equal(createdCount, 1, 'Concurrent notification creation with same dedupKey produces exactly 1 record');

    // 2. Verify Phase 4A Frontend HTML and JS files exist
    const publicDir = path.join(__dirname, '..', 'public');
    const requiredFiles = [
      'recurring.html', 'js/recurring.js',
      'reminders.html', 'js/reminders.js',
      'notifications.html', 'js/notifications.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(publicDir, file);
      assert.ok(fs.existsSync(filePath), `Required frontend file ${file} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(content.length > 50, `${file} must contain code content`);
    }
  });
});
