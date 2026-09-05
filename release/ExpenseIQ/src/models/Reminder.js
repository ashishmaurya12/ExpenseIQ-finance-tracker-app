const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId, assertProductionStorage } = require('../utils/helpers');

const FILE = 'reminders.json';

// Mongoose Reminder Schema
const reminderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, default: 0 },
  dueDate: { type: String, required: true, index: true },
  category: { type: String, default: 'General', trim: true },
  recurringTransactionId: { type: String, default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'completed', 'overdue', 'dismissed'], index: true },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
  reminderDaysBefore: { type: Number, default: 3 },
  notes: { type: String, default: '', trim: true },
  completedAt: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

reminderSchema.index({ userId: 1, dueDate: 1 });
reminderSchema.index({ userId: 1, status: 1 });

const ReminderModel = mongoose.models.Reminder || mongoose.model('Reminder', reminderSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Find reminders for user ID with status filter and pagination.
 */
async function findByUserId(userId, options = {}) {
  const { status, page = 1, limit = 20 } = options;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  if (isMongoConnected()) {
    const query = { userId };
    if (status && status !== 'all') {
      query.status = status;
    }

    const [items, total] = await Promise.all([
      ReminderModel.find(query)
        .sort({ dueDate: 1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      ReminderModel.countDocuments(query)
    ]);

    const sanitized = items.map(item => {
      delete item._id;
      delete item.__v;
      return item;
    });

    return {
      reminders: sanitized,
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
  if (status && status !== 'all') {
    items = items.filter(item => item.status === status);
  }

  items.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const total = items.length;
  const paginated = items.slice(skip, skip + parsedLimit);

  return {
    reminders: paginated,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1
    }
  };
}

/**
 * Find single reminder by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const item = await ReminderModel.findOne({ id, userId }).lean();
    if (!item) return null;
    delete item._id;
    delete item.__v;
    return item;
  }

  assertProductionStorage();
  const all = readData(FILE);
  return all.find(item => item.id === id && item.userId === userId) || null;
}

function parseReminderDaysBefore(val) {
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(30, parsed)) : 3;
}

/**
 * Create a new reminder.
 */
async function create(data) {
  const item = {
    id: generateId(),
    userId: data.userId,
    title: data.title.trim(),
    amount: Number(data.amount || 0),
    dueDate: data.dueDate,
    category: data.category ? data.category.trim() : 'General',
    recurringTransactionId: data.recurringTransactionId || null,
    status: data.status || 'pending',
    priority: data.priority || 'medium',
    reminderDaysBefore: parseReminderDaysBefore(data.reminderDaysBefore),
    notes: data.notes ? data.notes.trim() : '',
    completedAt: data.completedAt || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    const doc = await ReminderModel.create(item);
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
 * Update an existing reminder.
 */
async function update(id, userId, updates) {
  const allowed = [
    'title', 'amount', 'dueDate', 'category', 'recurringTransactionId',
    'status', 'priority', 'reminderDaysBefore', 'notes', 'completedAt'
  ];

  const patch = { updatedAt: new Date().toISOString() };
  Object.keys(updates).forEach(key => {
    if (allowed.includes(key) && updates[key] !== undefined) {
      if (key === 'reminderDaysBefore') {
        patch[key] = parseReminderDaysBefore(updates[key]);
      } else {
        patch[key] = updates[key];
      }
    }
  });

  if (isMongoConnected()) {
    const updated = await ReminderModel.findOneAndUpdate(
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
 * Delete a reminder by ID.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const res = await ReminderModel.deleteOne({ id, userId });
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

module.exports = {
  ReminderModel,
  findByUserId,
  findById,
  create,
  update,
  delete: remove
};
