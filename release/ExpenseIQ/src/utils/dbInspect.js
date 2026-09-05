const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/config');
const { UserModel } = require('../models/User');
const { TransactionModel } = require('../models/Transaction');
const { BudgetModel } = require('../models/Budget');
const { GoalModel } = require('../models/Goal');

async function inspectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`\n==================================================`);
    console.log(` 🍃 ExpenseIQ Database Inspector (${MONGODB_URI})`);
    console.log(`==================================================\n`);

    // 1. Users
    const users = await UserModel.find().select('-password').lean();
    console.log(`👤 USERS (${users.length} records):`);
    console.table(users.map(u => ({ id: u.id, name: u.name, email: u.email, currency: u.currency })));

    // 2. Transactions
    const txns = await TransactionModel.find().sort({ date: -1 }).lean();
    console.log(`\n💳 TRANSACTIONS (${txns.length} records):`);
    console.table(txns.map(t => ({ date: t.date, type: t.type, category: t.category, amount: t.amount, note: t.note })));

    // 3. Budgets
    const budgets = await BudgetModel.find().lean();
    console.log(`\n🎯 BUDGETS (${budgets.length} records):`);
    console.table(budgets.map(b => ({ category: b.category, limit: b.monthlyLimit })));

    // 4. Goals
    const goals = await GoalModel.find().lean();
    console.log(`\n🏆 SAVINGS GOALS (${goals.length} records):`);
    console.table(goals.map(g => ({ name: g.name, target: g.targetAmount, saved: g.savedAmount, deadline: g.deadline || 'None' })));

    console.log(`\n==================================================\n`);
  } catch (err) {
    console.error('Error inspecting database:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

inspectDB();
