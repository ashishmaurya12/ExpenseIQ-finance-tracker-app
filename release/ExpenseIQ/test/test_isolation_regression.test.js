process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { setupTestIsolation } = require('./helpers/testSetup');
const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');

test('Test-Suite Isolation & Concurrent Data Storage Regression Suite', async (t) => {
  await t.test('1. Suite A and Suite B have isolated DATA_DIR environments', async () => {
    // Suite A Isolation
    const isoA = setupTestIsolation('suite_a');
    const userA = await User.create({
      name: 'User Suite A',
      email: 'user_a@example.com',
      password: 'Password123!',
      currency: 'INR'
    });
    const txnA = await Transaction.create({
      userId: userA.id,
      type: 'expense',
      amount: 500,
      category: 'Food',
      date: '2026-09-01'
    });

    assert.ok(fs.existsSync(path.join(isoA.isolatedDir, 'users.json')));
    assert.ok(fs.existsSync(path.join(isoA.isolatedDir, 'transactions.json')));

    // Suite B Isolation (Simulate concurrent test file)
    const isoB = setupTestIsolation('suite_b');
    const userB = await User.create({
      name: 'User Suite B',
      email: 'user_b@example.com',
      password: 'Password123!',
      currency: 'INR'
    });

    assert.notEqual(isoA.isolatedDir, isoB.isolatedDir, 'Suite A and Suite B have different data directories');

    // Verify Suite B JSON store contains User B
    const foundB = await User.findById(userB.id);
    assert.ok(foundB, 'User B found in Suite B storage');

    // Verify Suite A data remains completely untouched and isolated
    process.env.DATA_DIR = isoA.isolatedDir;
    const foundUserA = await User.findById(userA.id);
    assert.ok(foundUserA, 'User created in Suite A is preserved');
    assert.equal(foundUserA.email, 'user_a@example.com');

    // Cleanup Suite A
    isoA.cleanup();
    assert.equal(fs.existsSync(isoA.isolatedDir), false, 'Suite A directory removed on cleanup');

    // Verify Suite B is unaffected by Suite A cleanup
    process.env.DATA_DIR = isoB.isolatedDir;
    const foundUserB = await User.findById(userB.id);
    assert.ok(foundUserB, 'Suite B data remains intact after Suite A cleanup');

    // Cleanup Suite B
    isoB.cleanup();
    assert.equal(fs.existsSync(isoB.isolatedDir), false, 'Suite B directory removed on cleanup');
  });
});
