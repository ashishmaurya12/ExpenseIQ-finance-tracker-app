const { readData } = require('./fileStore');
const { UserModel } = require('../models/User');
const { TransactionModel } = require('../models/Transaction');
const { BudgetModel } = require('../models/Budget');
const { GoalModel } = require('../models/Goal');

/**
 * Migration helper: automatically populates MongoDB with data from JSON files
 * if MongoDB collections are empty.
 */
async function migrateJsonToMongo() {
  try {
    // 1. Users
    const userCount = await UserModel.countDocuments();
    if (userCount === 0) {
      const jsonUsers = readData('users.json');
      if (jsonUsers.length > 0) {
        await UserModel.insertMany(jsonUsers);
        console.log(`  📥 Migrated ${jsonUsers.length} users to MongoDB.`);
      }
    }

    // 2. Transactions
    const txnCount = await TransactionModel.countDocuments();
    if (txnCount === 0) {
      const jsonTxns = readData('transactions.json');
      if (jsonTxns.length > 0) {
        await TransactionModel.insertMany(jsonTxns);
        console.log(`  📥 Migrated ${jsonTxns.length} transactions to MongoDB.`);
      }
    }

    // 3. Budgets
    const budgetCount = await BudgetModel.countDocuments();
    if (budgetCount === 0) {
      const jsonBudgets = readData('budgets.json');
      if (jsonBudgets.length > 0) {
        await BudgetModel.insertMany(jsonBudgets);
        console.log(`  📥 Migrated ${jsonBudgets.length} budgets to MongoDB.`);
      }
    }

    // 4. Goals
    const goalCount = await GoalModel.countDocuments();
    if (goalCount === 0) {
      const jsonGoals = readData('goals.json');
      if (jsonGoals.length > 0) {
        await GoalModel.insertMany(jsonGoals);
        console.log(`  📥 Migrated ${jsonGoals.length} goals to MongoDB.`);
      }
    }
  } catch (err) {
    console.warn(`  ⚠️ JSON-to-Mongo migration skipped/warning: ${err.message}`);
  }
}

module.exports = { migrateJsonToMongo };
