const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const Goal = require('../src/models/Goal');
const { buildFinancialContext } = require('../src/utils/financialContext');

test('Financial Calculations & Bounded Context Accuracy Suite', async (t) => {
  const timestamp = Date.now();
  let testUser;

  t.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseiq');

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

  await t.test('1. Financial Calculations & Correct Model Field Mappings', async () => {
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
      note: 'Apartment Rent Payment'
    });

    // Budget: monthlyLimit = 15000
    await Budget.create({
      userId: testUser.id,
      category: 'Rent',
      monthlyLimit: 15000
    });

    // Goal: savedAmount = 20000, deadline = 2026-12-31
    await Goal.create({
      userId: testUser.id,
      name: 'Emergency Fund',
      targetAmount: 100000,
      savedAmount: 20000,
      deadline: '2026-12-31'
    });

    const { rawPayload, contextString } = await buildFinancialContext(testUser.id);
    const parsed = JSON.parse(contextString);

    assert.equal(parsed.currentMonth.totalIncome, 50000, 'Current income equals 50000');
    assert.equal(parsed.currentMonth.totalExpenses, 10000, 'Current expenses equal 10000');
    assert.equal(parsed.currentMonth.netSavings, 40000, 'Net savings equal 40000');
    assert.equal(parsed.currentMonth.savingsRatePct, '80.0%', 'Savings rate equals 80.0%');

    // Verify Budget field mappings in context
    const rentBudget = parsed.budgets.find(b => b.category === 'Rent');
    assert.ok(rentBudget, 'Rent budget exists in context');
    assert.equal(rentBudget.limit, 15000, 'Budget monthlyLimit maps to limit=15000 in AI context');

    // Verify Goal field mappings in context
    const emergencyGoal = parsed.goals.find(g => g.name === 'Emergency Fund');
    assert.ok(emergencyGoal, 'Emergency Fund goal exists in context');
    assert.equal(emergencyGoal.savedAmount, 20000, 'Goal savedAmount maps to savedAmount=20000 in AI context');
    assert.equal(emergencyGoal.deadline, '2026-12-31', 'Goal deadline maps to deadline="2026-12-31" in AI context');

    // Verify transaction note preserved in JSON payload
    assert.ok(contextString.includes('Apartment Rent Payment'), 'Transaction note preserved in context string');
  });

  await t.test('2. Large Dataset Bounded Context & Direct JSON Parsing', async () => {
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

    // Direct JSON parsing without try/catch wrapper
    const parsed = JSON.parse(contextString);

    assert.ok(Array.isArray(parsed.budgets), 'parsed.budgets is an array');
    assert.ok(parsed.budgets.length <= 10, 'Budgets array bounded to max 10 in context');

    assert.ok(Array.isArray(parsed.goals), 'parsed.goals is an array');
    assert.ok(parsed.goals.length <= 5, 'Goals array bounded to max 5 in context');

    assert.ok(Array.isArray(parsed.currentMonth.topRecentExpenses), 'topRecentExpenses is an array');
    assert.ok(parsed.currentMonth.topRecentExpenses.length <= 5, 'Recent expenses bounded to max 5');
  });
});
