const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId } = require('../utils/helpers');
const Transaction = require('./Transaction');

const FILE = 'budgets.json';

// Mongoose Budget Schema
const budgetSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  category: { type: String, required: true },
  monthlyLimit: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const BudgetModel = mongoose.models.Budget || mongoose.model('Budget', budgetSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get all budgets for a user.
 */
async function findByUserId(userId) {
  if (isMongoConnected()) {
    const budgets = await BudgetModel.find({ userId }).lean();
    return budgets.map(b => {
      delete b._id;
      delete b.__v;
      return b;
    });
  }
  return readData(FILE).filter(b => b.userId === userId);
}

/**
 * Find a specific budget by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const b = await BudgetModel.findOne({ id, userId }).lean();
    if (!b) return null;
    delete b._id;
    delete b.__v;
    return b;
  }
  const budgets = readData(FILE);
  return budgets.find(b => b.id === id && b.userId === userId) || null;
}

/**
 * Check if a budget already exists for a category.
 */
async function findByCategory(userId, category) {
  if (isMongoConnected()) {
    const b = await BudgetModel.findOne({ userId, category }).lean();
    if (!b) return null;
    delete b._id;
    delete b.__v;
    return b;
  }
  const budgets = readData(FILE);
  return budgets.find(b => b.userId === userId && b.category === category) || null;
}

/**
 * Create a new budget.
 */
async function create({ userId, category, monthlyLimit }) {
  const newBudget = {
    id: generateId(),
    userId,
    category,
    monthlyLimit: Number(monthlyLimit),
    createdAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    const created = await BudgetModel.create(newBudget);
    const obj = created.toObject();
    delete obj._id;
    delete obj.__v;
    return obj;
  }

  const budgets = readData(FILE);
  budgets.push(newBudget);
  writeData(FILE, budgets);
  return newBudget;
}

/**
 * Update an existing budget.
 */
async function update(id, userId, data) {
  if (isMongoConnected()) {
    const updated = await BudgetModel.findOneAndUpdate(
      { id, userId },
      {
        $set: {
          ...(data.monthlyLimit !== undefined && { monthlyLimit: Number(data.monthlyLimit) }),
          ...(data.category && { category: data.category }),
          updatedAt: new Date()
        }
      },
      { new: true }
    ).lean();

    if (!updated) return null;
    delete updated._id;
    delete updated.__v;
    return updated;
  }

  const budgets = readData(FILE);
  const index = budgets.findIndex(b => b.id === id && b.userId === userId);
  if (index === -1) return null;

  const updatedBudget = {
    ...budgets[index],
    monthlyLimit: data.monthlyLimit !== undefined ? Number(data.monthlyLimit) : budgets[index].monthlyLimit,
    category: data.category || budgets[index].category,
    updatedAt: new Date().toISOString()
  };

  budgets[index] = updatedBudget;
  writeData(FILE, budgets);
  return updatedBudget;
}

/**
 * Delete a budget.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const result = await BudgetModel.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  const budgets = readData(FILE);
  const index = budgets.findIndex(b => b.id === id && b.userId === userId);
  if (index === -1) return false;

  budgets.splice(index, 1);
  writeData(FILE, budgets);
  return true;
}

/**
 * Get all budgets with spending data attached for a target month (or current month).
 */
async function getWithSpending(userId, targetMonth = null) {
  const budgets = await findByUserId(userId);
  const currentSpending = await Transaction.getCurrentMonthExpensesByCategory(userId, targetMonth);

  const spendingNormalized = {};
  Object.keys(currentSpending).forEach(cat => {
    spendingNormalized[cat.toLowerCase().trim()] = currentSpending[cat];
  });

  return budgets.map(budget => {
    const catKey = (budget.category || '').toLowerCase().trim();
    const spent = spendingNormalized[catKey] || 0;
    const monthlyLimit = Number(budget.monthlyLimit) || 0;
    const remaining = monthlyLimit - spent;
    const percentUsed = monthlyLimit > 0
      ? Math.round((spent / monthlyLimit) * 100)
      : 0;

    return {
      ...budget,
      monthlyLimit,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentUsed
    };
  });
}

module.exports = {
  BudgetModel,
  findByUserId,
  findById,
  findByCategory,
  create,
  update,
  remove,
  getWithSpending
};
