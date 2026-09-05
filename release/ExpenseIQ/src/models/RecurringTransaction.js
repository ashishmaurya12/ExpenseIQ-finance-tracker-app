const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId, assertProductionStorage } = require('../utils/helpers');

const FILE = 'recurring_transactions.json';

// Mongoose RecurringTransaction Schema
const recurringTransactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  amount: { type: Number, required: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  frequency: { type: String, required: true, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] },
  startDate: { type: String, required: true },
  nextDueDate: { type: String, required: true, index: true },
  endDate: { type: String, default: null },
  active: { type: Boolean, default: true, index: true },
  autoCreate: { type: Boolean, default: false },
  notes: { type: String, default: '', trim: true },
  lastProcessedDate: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

recurringTransactionSchema.index({ userId: 1, nextDueDate: 1 });
recurringTransactionSchema.index({ userId: 1, active: 1 });

const RecurringTransactionModel = mongoose.models.RecurringTransaction || mongoose.model('RecurringTransaction', recurringTransactionSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Find recurring transactions by user ID with optional filters & pagination.
 */
async function findByUserId(userId, options = {}) {
  const { active, page = 1, limit = 20 } = options;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  if (isMongoConnected()) {
    const query = { userId };
    if (typeof active === 'boolean') query.active = active;
    else if (active === 'true' || active === 'false') query.active = active === 'true';

    const [items, total] = await Promise.all([
      RecurringTransactionModel.find(query)
        .sort({ nextDueDate: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      RecurringTransactionModel.countDocuments(query)
    ]);

    const sanitized = items.map(item => {
      delete item._id;
      delete item.__v;
      return item;
    });

    return {
      recurring: sanitized,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit) || 1
      }
    };
  }

  assertProductionStorage();
  let items = readData(FILE).filter(item => item.userId === userId);
  if (typeof active === 'boolean') {
    items = items.filter(item => Boolean(item.active) === active);
  } else if (active === 'true' || active === 'false') {
    items = items.filter(item => Boolean(item.active) === (active === 'true'));
  }

  items.sort((a, b) => (a.nextDueDate || '').localeCompare(b.nextDueDate || ''));
  const total = items.length;
  const paginated = items.slice(skip, skip + parsedLimit);

  return {
    recurring: paginated,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1
    }
  };
}

/**
 * Find active due recurring transactions across all users or single user (for auto-processor).
 */
async function findActiveDue(currentDateStr, userId = null) {
  if (isMongoConnected()) {
    const query = {
      active: true,
      nextDueDate: { $lte: currentDateStr }
    };
    if (userId) query.userId = userId;

    const items = await RecurringTransactionModel.find(query).lean();
    return items.map(item => {
      delete item._id;
      delete item.__v;
      return item;
    });
  }

  assertProductionStorage();
  const all = readData(FILE);
  return all.filter(item =>
    item.active &&
    item.nextDueDate &&
    item.nextDueDate <= currentDateStr &&
    (!userId || item.userId === userId)
  );
}

/**
 * Find single recurring transaction by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const item = await RecurringTransactionModel.findOne({ id, userId }).lean();
    if (!item) return null;
    delete item._id;
    delete item.__v;
    return item;
  }

  assertProductionStorage();
  const all = readData(FILE);
  return all.find(item => item.id === id && item.userId === userId) || null;
}

/**
 * Create a new recurring transaction.
 */
async function create(data) {
  const item = {
    id: generateId(),
    userId: data.userId,
    type: data.type,
    amount: Number(data.amount),
    category: data.category.trim(),
    description: data.description ? data.description.trim() : '',
    frequency: data.frequency,
    startDate: data.startDate,
    nextDueDate: data.nextDueDate || data.startDate,
    endDate: data.endDate || null,
    active: data.active !== undefined ? Boolean(data.active) : true,
    autoCreate: data.autoCreate !== undefined ? Boolean(data.autoCreate) : false,
    notes: data.notes ? data.notes.trim() : '',
    lastProcessedDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    const doc = await RecurringTransactionModel.create(item);
    const obj = doc.toObject();
    delete obj._id;
    delete obj.__v;
    return obj;
  }

  assertProductionStorage();
  const all = readData(FILE);
  all.push(item);
  writeData(FILE, all);
  return item;
}

/**
 * Update an existing recurring transaction by ID.
 */
async function update(id, userId, updates) {
  const allowed = [
    'type', 'amount', 'category', 'description', 'frequency',
    'startDate', 'nextDueDate', 'endDate', 'active', 'autoCreate',
    'notes', 'lastProcessedDate'
  ];

  const patch = { updatedAt: new Date().toISOString() };
  Object.keys(updates).forEach(key => {
    if (allowed.includes(key) && updates[key] !== undefined) {
      patch[key] = updates[key];
    }
  });

  if (isMongoConnected()) {
    const updated = await RecurringTransactionModel.findOneAndUpdate(
      { id, userId },
      { $set: patch },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return null;
    delete updated._id;
    delete updated.__v;
    return updated;
  }

  assertProductionStorage();
  const all = readData(FILE);
  const index = all.findIndex(item => item.id === id && item.userId === userId);
  if (index === -1) return null;

  all[index] = { ...all[index], ...patch };
  writeData(FILE, all);
  return all[index];
}

/**
 * Delete a recurring transaction by ID.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const res = await RecurringTransactionModel.deleteOne({ id, userId });
    return res.deletedCount > 0;
  }

  assertProductionStorage();
  const all = readData(FILE);
  const initialLength = all.length;
  const filtered = all.filter(item => !(item.id === id && item.userId === userId));

  if (filtered.length !== initialLength) {
    writeData(FILE, filtered);
    return true;
  }
  return false;
}

/**
 * Atomically claim and advance a due occurrence to prevent concurrent processing races.
 */
async function claimDueOccurrence(id, userId, currentDueDate, calculatedNextDueDate, shouldDeactivate) {
  if (isMongoConnected()) {
    const updated = await RecurringTransactionModel.findOneAndUpdate(
      {
        id,
        userId,
        active: true,
        lastProcessedDate: { $ne: currentDueDate }
      },
      {
        $set: {
          lastProcessedDate: currentDueDate,
          nextDueDate: calculatedNextDueDate,
          active: !shouldDeactivate,
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

  assertProductionStorage();
  const all = readData(FILE);
  const index = all.findIndex(item =>
    item.id === id &&
    item.userId === userId &&
    item.active &&
    item.lastProcessedDate !== currentDueDate
  );
  if (index === -1) return null;

  all[index].lastProcessedDate = currentDueDate;
  all[index].nextDueDate = calculatedNextDueDate;
  all[index].active = !shouldDeactivate;
  all[index].updatedAt = new Date().toISOString();
  writeData(FILE, all);
  return all[index];
}

module.exports = {
  RecurringTransactionModel,
  findByUserId,
  findActiveDue,
  findById,
  create,
  update,
  claimDueOccurrence,
  delete: remove
};
