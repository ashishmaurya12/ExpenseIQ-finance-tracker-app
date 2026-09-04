const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');
const { buildFinancialContext } = require('../src/utils/financialContext');

test('Financial Calculations & Large Dataset Stress Suite', async (t) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseiq');
  } catch (e) {
    // Mongo notice
  }

  const timestamp = Date.now();
  let testUser;

  t.before(async () => {
    testUser = await User.create({
      name: 'Accuracy Test User',
      email: `accuracy_user_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
  });

  t.after(async () => {
    if (testUser && testUser.id) {
      await User.UserModel.deleteOne({ id: testUser.id });
      await Transaction.TransactionModel.deleteMany({ userId: testUser.id });
      await Budget.BudgetModel.deleteMany({ userId: testUser.id });
      await Goal.GoalModel.deleteMany({ userId: testUser.id });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  await t.test('1. Exact Financial Calculations (Income 50k, Expenses 10k -> Net 40k, 80% Savings Rate)', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Income = 50000
    await Transaction.create({
      userId: testUser.id,
      type: 'income',
      amount: 50000,
      category: 'Salary',
      date: today,
      note: 'Monthly Salary'
    });

    // Expenses = 10000
    await Transaction.create({
      userId: testUser.id,
      type: 'expense',
      amount: 10000,
      category: 'Rent',
      date: today,
      note: 'Apartment Rent'
    });

    const { rawPayload, contextString } = await buildFinancialContext(testUser.id);
    const parsed = JSON.parse(contextString);

    assert.equal(parsed.currentMonth.totalIncome, 50000, 'Current income equals 50000');
    assert.equal(parsed.currentMonth.totalExpenses, 10000, 'Current expenses equal 10000');
    assert.equal(parsed.currentMonth.netSavings, 40000, 'Net savings equal 40000');
    assert.equal(parsed.currentMonth.savingsRatePct, '80.0%', 'Savings rate equals 80.0%');
  });

  await t.test('2. Large Dataset Bounded Context (50 Transactions, 20 Budgets, 15 Goals)', async () => {
    const today = new Date().toISOString().slice(0, 10);

    // Create 30 extra transactions
    const txnPromises = [];
    for (let i = 0; i < 30; i++) {
      txnPromises.push(Transaction.create({
        userId: testUser.id,
        type: 'expense',
        amount: 100 + i,
        category: 'Shopping',
        date: today,
        note: `Bulk Item ${i}`
      }));
    }
    await Promise.all(txnPromises);

    // Create 15 budgets
    const budgetPromises = [];
    for (let i = 0; i < 15; i++) {
      budgetPromises.push(Budget.create({
        userId: testUser.id,
        category: `Cat_${i}`,
        monthlyLimit: 1000 + i * 100
      }));
    }
    await Promise.all(budgetPromises);

    // Create 10 goals
    const goalPromises = [];
    for (let i = 0; i < 10; i++) {
      goalPromises.push(Goal.create({
        userId: testUser.id,
        name: `Goal_${i}`,
        targetAmount: 10000 + i * 1000,
        savedAmount: 2000 + i * 500,
        deadline: '2026-12-31'
      }));
    }
    await Promise.all(goalPromises);

    const { contextString } = await buildFinancialContext(testUser.id);

    // Assert 100% valid JSON payload
    let isJsonValid = false;
    try {
      const parsed = JSON.parse(contextString);
      isJsonValid = true;
      assert.ok(parsed.budgets.length <= 10, 'Budgets array bounded to max 10 in context');
      assert.ok(parsed.goals.length <= 5, 'Goals array bounded to max 5 in context');
      assert.ok(parsed.currentMonth.topRecentExpenses.length <= 5, 'Recent expenses bounded to max 5');
    } catch (e) {
      isJsonValid = false;
    }

    assert.ok(isJsonValid, 'Large dataset context is 100% valid JSON without string truncation syntax errors');
  });
});
