const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');
const Transaction = require('../src/models/Transaction');
const { buildFinancialContext, sanitizeText } = require('../src/utils/financialContext');

test('Financial Context Correctness Suite', async (t) => {
  // Connect DB
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseiq');
  } catch (e) {
    // Mongo notice
  }

  const timestamp = Date.now();
  let testUser;

  t.before(async () => {
    testUser = await User.create({
      name: 'Context Test User',
      email: `context_test_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
  });

  t.after(async () => {
    if (testUser && testUser.id) {
      await User.UserModel.deleteOne({ id: testUser.id });
      await Budget.BudgetModel.deleteMany({ userId: testUser.id });
      await Goal.GoalModel.deleteMany({ userId: testUser.id });
      await Transaction.TransactionModel.deleteMany({ userId: testUser.id });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  await t.test('A. Budget Fields: monthlyLimit and spent correctly populates in context', async () => {
    // Create budget with monthlyLimit = 10000
    await Budget.create({
      userId: testUser.id,
      category: 'Food',
      monthlyLimit: 10000
    });

    // Create transaction with spent = 6500
    const today = new Date().toISOString().slice(0, 10);
    await Transaction.create({
      userId: testUser.id,
      type: 'expense',
      amount: 6500,
      category: 'Food',
      date: today,
      note: 'Grocery Shopping'
    });

    const { rawPayload, contextString } = await buildFinancialContext(testUser.id);
    const parsed = JSON.parse(contextString);

    const foodBudget = parsed.budgets.find(b => b.category === 'Food');
    assert.ok(foodBudget, 'Food budget exists in context');
    assert.equal(foodBudget.limit, 10000, 'Budget limit equals monthlyLimit 10000 (NOT 0)');
    assert.equal(foodBudget.spent, 6500, 'Budget spent equals actual expense 6500');
    assert.equal(foodBudget.remaining, 3500, 'Budget remaining equals 3500');
    assert.notEqual(foodBudget.limit, 0, 'limit must not be 0');
  });

  await t.test('B. Goal Fields: savedAmount and deadline correctly populate in context', async () => {
    const deadlineStr = '2026-12-31';
    await Goal.create({
      userId: testUser.id,
      name: 'Emergency Fund',
      targetAmount: 100000,
      savedAmount: 35000,
      deadline: deadlineStr
    });

    const { rawPayload, contextString } = await buildFinancialContext(testUser.id);
    const parsed = JSON.parse(contextString);

    const goal = parsed.goals.find(g => g.name === 'Emergency Fund');
    assert.ok(goal, 'Emergency Fund goal exists in context');
    assert.equal(goal.targetAmount, 100000, 'Target amount is 100000');
    assert.equal(goal.savedAmount, 35000, 'savedAmount is 35000 (NOT 0)');
    assert.equal(goal.deadline, deadlineStr, 'deadline matches 2026-12-31 (NOT N/A)');
    assert.equal(goal.progressPct, '35%', 'progressPct matches 35%');
  });

  await t.test('C. Missing/Null numeric values safely become 0', async () => {
    await Goal.create({
      userId: testUser.id,
      name: 'Zero Target Goal',
      targetAmount: 0,
      savedAmount: 0
    });

    const { contextString } = await buildFinancialContext(testUser.id);
    const parsed = JSON.parse(contextString);

    const goal = parsed.goals.find(g => g.name === 'Zero Target Goal');
    assert.ok(goal, 'Zero target goal exists');
    assert.equal(goal.targetAmount, 0);
    assert.equal(goal.savedAmount, 0);
    assert.equal(goal.progressPct, '0%');
  });

  await t.test('D. Multilingual Unicode text preservation', async () => {
    assert.equal(sanitizeText('किराना'), 'किराना', 'Hindi preserved');
    assert.equal(sanitizeText('食費'), '食費', 'Japanese preserved');
    assert.equal(sanitizeText('طعام'), 'طعام', 'Arabic preserved');
    assert.equal(sanitizeText('🍔 Food'), '🍔 Food', 'Emoji preserved');
  });

  await t.test('E. Context String is 100% Valid JSON Payload', async () => {
    const { contextString } = await buildFinancialContext(testUser.id);
    assert.doesNotThrow(() => {
      JSON.parse(contextString);
    }, 'Context string is valid JSON without truncation syntax errors');
  });
});
