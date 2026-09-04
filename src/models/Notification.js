const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId, assertProductionStorage } = require('../utils/helpers');

const FILE = 'notifications.json';

// Mongoose Notification Schema
const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['reminder', 'budget', 'goal', 'system', 'anomaly', 'ai_insight'],
    index: true
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  priority: { type: String, default: 'medium', enum: ['low', 'medium', 'high'] },
  read: { type: Boolean, default: false, index: true },
  dedupKey: { type: String, default: null, index: true },
  relatedEntityId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now, index: true }
});

notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index(
  { userId: 1, dedupKey: 1 },
  {
    name: 'userId_dedupKey_unique',
    unique: true,
    partialFilterExpression: { dedupKey: { $type: 'string' } }
  }
);

const NotificationModel = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
if (mongoose.connection.readyState === 1) {
  NotificationModel.ensureIndexes().catch(() => {});
}

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Find notifications for user ID with optional read filter and pagination.
 */
async function findByUserId(userId, options = {}) {
  const { read, page = 1, limit = 20 } = options;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (parsedPage - 1) * parsedLimit;

  if (isMongoConnected()) {
    const query = { userId };
    if (typeof read === 'boolean') {
      query.read = read;
    } else if (read === 'true' || read === 'false') {
      query.read = read === 'true';
    }

    const [items, total, unreadCount] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
      NotificationModel.countDocuments(query),
      NotificationModel.countDocuments({ userId, read: false })
    ]);

    const sanitized = items.map(item => {
      delete item._id;
      delete item.__v;
      return item;
    });

    return {
      notifications: sanitized,
      unreadCount,
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
  const unreadCount = items.filter(item => !item.read).length;

  if (typeof read === 'boolean') {
    items = items.filter(item => Boolean(item.read) === read);
  } else if (read === 'true' || read === 'false') {
    items = items.filter(item => Boolean(item.read) === (read === 'true'));
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const total = items.length;
  const paginated = items.slice(skip, skip + parsedLimit);

  return {
    notifications: paginated,
    unreadCount,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1
    }
  };
}

/**
 * Find single notification by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const item = await NotificationModel.findOne({ id, userId }).lean();
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
 * Check if a notification with dedupKey already exists for user.
 */
async function existsByDedupKey(userId, dedupKey) {
  if (!dedupKey) return false;

  if (isMongoConnected()) {
    const count = await NotificationModel.countDocuments({ userId, dedupKey });
    return count > 0;
  }

  assertProductionStorage();
  const all = readData(FILE);
  return all.some(item => item.userId === userId && item.dedupKey === dedupKey);
}

/**
 * Create a new notification (with optional deduplication).
 */
async function create(data) {
  const { userId, type, title, message, priority, dedupKey, relatedEntityId } = data;

  if (dedupKey) {
    const exists = await existsByDedupKey(userId, dedupKey);
    if (exists) {
      return null; // Suppress duplicate notification
    }
  }

  const item = {
    id: generateId(),
    userId,
    type,
    title: title.trim(),
    message: message.trim(),
    priority: priority || 'medium',
    read: false,
    dedupKey: dedupKey || null,
    relatedEntityId: relatedEntityId || null,
    createdAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    try {
      const doc = await NotificationModel.create(item);
      const obj = doc.toObject();
      delete obj._id;
      delete obj.__v;
      return obj;
    } catch (err) {
      if (err.code === 11000 || (err.message && (err.message.includes('E11000') || err.message.includes('duplicate key')))) {
        return null; // Suppress duplicate key error silently
      }
      throw err;
    }
  }

  assertProductionStorage();
  const all = readData(FILE);
  if (dedupKey && all.some(existing => existing.userId === userId && existing.dedupKey === dedupKey)) {
    return null; // Suppress duplicate notification in JSON storage
  }

  all.push(item);
  writeData(FILE, all);
  return item;
}

/**
 * Mark a notification as read.
 */
async function markAsRead(id, userId) {
  if (isMongoConnected()) {
    const updated = await NotificationModel.findOneAndUpdate(
      { id, userId },
      { $set: { read: true } },
      { new: true }
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

  all[index].read = true;
  writeData(FILE, all);
  return all[index];
}

/**
 * Mark all notifications as read for a user.
 */
async function markAllAsRead(userId) {
  if (isMongoConnected()) {
    const res = await NotificationModel.updateMany(
      { userId, read: false },
      { $set: { read: true } }
    );
    return res.modifiedCount || 0;
  }

  assertProductionStorage();
  const all = readData(FILE);
  let updatedCount = 0;
  all.forEach(item => {
    if (item.userId === userId && !item.read) {
      item.read = true;
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    writeData(FILE, all);
  }
  return updatedCount;
}

/**
 * Delete a notification by ID.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const res = await NotificationModel.deleteOne({ id, userId });
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
 * Find notifications matching custom filter (e.g. userId, relatedEntityId).
 */
async function find(filter = {}) {
  if (isMongoConnected()) {
    const items = await NotificationModel.find(filter).lean();
    return items.map(item => {
      delete item._id;
      delete item.__v;
      return item;
    });
  }

  assertProductionStorage();
  const all = readData(FILE);
  return all.filter(item => {
    return Object.entries(filter).every(([key, val]) => item[key] === val);
  });
}

module.exports = {
  NotificationModel,
  findByUserId,
  findById,
  existsByDedupKey,
  find,
  create,
  markAsRead,
  markAllAsRead,
  delete: remove
};
