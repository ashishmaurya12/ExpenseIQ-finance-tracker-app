const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId, getMonthFromDate, getCurrentMonth } = require('../utils/helpers');

const FILE = 'transactions.json';

// Mongoose Transaction Schema
const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: String, required: true },
  note: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const TransactionModel = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get all transactions for a user, with optional filters.
 */
async function findByUserId(userId, filters = {}) {
  if (isMongoConnected()) {
    const query = { userId };
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.month) query.date = { $regex: `^${filters.month}` };
    if (filters.from || filters.to) {
      query.date = query.date || {};
      if (filters.from) query.date.$gte = filters.from;
      if (filters.to) query.date.$lte = filters.to;
    }

    const transactions = await TransactionModel.find(query).sort({ date: -1 }).lean();
    return transactions.map(t => {
      delete t._id;
      delete t.__v;
      return t;
    });
  }

  let transactions = readData(FILE).filter(t => t.userId === userId);

  if (filters.type) transactions = transactions.filter(t => t.type === filters.type);
  if (filters.category) transactions = transactions.filter(t => t.category === filters.category);
  if (filters.month) transactions = transactions.filter(t => t.date && t.date.startsWith(filters.month));
  if (filters.from) transactions = transactions.filter(t => t.date >= filters.from);
  if (filters.to) transactions = transactions.filter(t => t.date <= filters.to);

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  return transactions;
}

/**
 * Find a specific transaction by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const t = await TransactionModel.findOne({ id, userId }).lean();
    if (!t) return null;
    delete t._id;
    delete t.__v;
    return t;
  }
  const transactions = readData(FILE);
  return transactions.find(t => t.id === id && t.userId === userId) || null;
}

/**
 * Create a new transaction.
 */
async function create({ userId, type, amount, category, date, note }) {
  const newTxn = {
    id: generateId(),
    userId,
    type,
    amount: Number(amount),
    category,
    date,
    note: note || '',
    createdAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    const created = await TransactionModel.create(newTxn);
    const obj = created.toObject();
    delete obj._id;
    delete obj.__v;
    return obj;
  }

  const transactions = readData(FILE);
  transactions.push(newTxn);
  writeData(FILE, transactions);
  return newTxn;
}

/**
 * Update an existing transaction.
 */
async function update(id, userId, data) {
  if (isMongoConnected()) {
    const updated = await TransactionModel.findOneAndUpdate(
      { id, userId },
      {
        $set: {
          ...(data.type && { type: data.type }),
          ...(data.amount !== undefined && { amount: Number(data.amount) }),
          ...(data.category && { category: data.category }),
          ...(data.date && { date: data.date }),
          ...(data.note !== undefined && { note: data.note }),
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

  const transactions = readData(FILE);
  const index = transactions.findIndex(t => t.id === id && t.userId === userId);
  if (index === -1) return null;

  const updatedTransaction = {
    ...transactions[index],
    type: data.type || transactions[index].type,
    amount: data.amount !== undefined ? Number(data.amount) : transactions[index].amount,
    category: data.category || transactions[index].category,
    date: data.date || transactions[index].date,
    note: data.note !== undefined ? data.note : transactions[index].note,
    updatedAt: new Date().toISOString()
  };

  transactions[index] = updatedTransaction;
  writeData(FILE, transactions);
  return updatedTransaction;
}

/**
 * Delete a transaction.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const result = await TransactionModel.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  const transactions = readData(FILE);
  const index = transactions.findIndex(t => t.id === id && t.userId === userId);
  if (index === -1) return false;

  transactions.splice(index, 1);
  writeData(FILE, transactions);
  return true;
}

/**
 * Get summary data for dashboard charts with optional month filter.
 */
async function getSummary(userId, targetMonth = null) {
  const transactions = await findByUserId(userId);

  // Collect available unique months
  const monthSet = new Set();
  transactions.forEach(t => {
    const m = getMonthFromDate(t.date);
    if (m) monthSet.add(m);
  });
  const currentM = getCurrentMonth();
  monthSet.add(currentM);
  const availableMonths = Array.from(monthSet).sort().reverse();

  let totalIncome = 0;
  let totalExpense = 0;
  const categoryBreakdown = {};
  const incomeBreakdown = {};
  const monthlyData = {};
  const dailyMap = {};

  // Build dailyMap range
  if (targetMonth && targetMonth !== 'all') {
    const [yearStr, monthStr] = targetMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${targetMonth}-${String(day).padStart(2, '0')}`;
      dailyMap[dStr] = 0;
    }
  } else {
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap[dateStr] = 0;
    }
  }

  transactions.forEach(t => {
    const month = getMonthFromDate(t.date);

    // Global monthly aggregate data
    if (month) {
      if (!monthlyData[month]) {
        monthlyData[month] = { month, income: 0, expense: 0 };
      }
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        monthlyData[month].income += amt;
      } else {
        monthlyData[month].expense += amt;
      }
    }

    // Filter calculations for requested target month (or all)
    if (!targetMonth || targetMonth === 'all' || (t.date && t.date.startsWith(targetMonth))) {
      const amount = Number(t.amount) || 0;
      const cat = (t.category || 'Other').trim();

      if (t.type === 'income') {
        totalIncome += amount;
        incomeBreakdown[cat] = (incomeBreakdown[cat] || 0) + amount;
      } else {
        totalExpense += amount;
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + amount;

        if (t.date && dailyMap[t.date] !== undefined) {
          dailyMap[t.date] += amount;
        }
      }
    }
  });

  const sortedMonthly = Object.values(monthlyData)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  const dailyData = Object.entries(dailyMap).map(([date, amount]) => ({
    date,
    amount: Math.round(amount * 100) / 100
  }));

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    balance: Math.round((totalIncome - totalExpense) * 100) / 100,
    categoryBreakdown,
    incomeBreakdown,
    monthlyData: sortedMonthly,
    dailyData,
    availableMonths,
    selectedMonth: targetMonth || 'all'
  };
}

/**
 * Get total expenses for a user in a target month (defaults to current month), grouped by category.
 */
async function getCurrentMonthExpensesByCategory(userId, targetMonth = null) {
  const monthToUse = targetMonth || getCurrentMonth();
  const transactions = await findByUserId(userId, { month: monthToUse });

  const byCategory = {};
  transactions.forEach(t => {
    if (t.type && t.type.toLowerCase() === 'expense') {
      const cat = (t.category || '').trim();
      if (cat) {
        if (!byCategory[cat]) {
          byCategory[cat] = 0;
        }
        byCategory[cat] += Number(t.amount) || 0;
      }
    }
  });

  return byCategory;
}

/**
 * Remove all transactions for a specific user (Reset data).
 */
async function removeAllByUserId(userId) {
  if (isMongoConnected()) {
    const result = await TransactionModel.deleteMany({ userId });
    return result.deletedCount;
  }

  const transactions = readData(FILE);
  const remaining = transactions.filter(t => t.userId !== userId);
  const removedCount = transactions.length - remaining.length;
  writeData(FILE, remaining);
  return removedCount;
}

module.exports = {
  TransactionModel,
  findByUserId,
  findById,
  create,
  update,
  remove,
  removeAllByUserId,
  getSummary,
  getCurrentMonthExpensesByCategory
};
