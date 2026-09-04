const mongoose = require('mongoose');
const { readData, writeData } = require('../utils/fileStore');
const { generateId, assertProductionStorage } = require('../utils/helpers');

const FILE = 'goals.json';

// Mongoose Goal Schema
const goalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  targetAmount: { type: Number, required: true },
  savedAmount: { type: Number, default: 0 },
  deadline: { type: String, default: null },
  icon: { type: String, default: '🎯' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date }
});

const GoalModel = mongoose.models.Goal || mongoose.model('Goal', goalSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Get all savings goals for a user.
 */
async function findByUserId(userId) {
  if (isMongoConnected()) {
    const goals = await GoalModel.find({ userId }).lean();
    return goals.map(g => {
      delete g._id;
      delete g.__v;
      return g;
    });
  }
  assertProductionStorage();
  return readData(FILE).filter(g => g.userId === userId);
}

/**
 * Find a specific goal by ID, owned by userId.
 */
async function findById(id, userId) {
  if (isMongoConnected()) {
    const g = await GoalModel.findOne({ id, userId }).lean();
    if (!g) return null;
    delete g._id;
    delete g.__v;
    return g;
  }
  assertProductionStorage();
  const goals = readData(FILE);
  return goals.find(g => g.id === id && g.userId === userId) || null;
}

/**
 * Create a new savings goal.
 */
async function create({ userId, name, targetAmount, savedAmount, deadline, icon }) {
  const newGoal = {
    id: generateId(),
    userId,
    name: name.trim(),
    targetAmount: Number(targetAmount),
    savedAmount: Number(savedAmount || 0),
    deadline: deadline || null,
    icon: icon || '🎯',
    createdAt: new Date().toISOString()
  };

  if (isMongoConnected()) {
    const created = await GoalModel.create(newGoal);
    const obj = created.toObject();
    delete obj._id;
    delete obj.__v;
    return obj;
  }

  assertProductionStorage();
  const goals = readData(FILE);
  goals.push(newGoal);
  writeData(FILE, goals);
  return newGoal;
}

/**
 * Update an existing goal.
 */
async function update(id, userId, data) {
  if (isMongoConnected()) {
    const updated = await GoalModel.findOneAndUpdate(
      { id, userId },
      {
        $set: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.targetAmount !== undefined && { targetAmount: Number(data.targetAmount) }),
          ...(data.savedAmount !== undefined && { savedAmount: Number(data.savedAmount) }),
          ...(data.deadline !== undefined && { deadline: data.deadline }),
          ...(data.icon && { icon: data.icon }),
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
  const goals = readData(FILE);
  const index = goals.findIndex(g => g.id === id && g.userId === userId);
  if (index === -1) return null;

  const updatedGoal = {
    ...goals[index],
    name: data.name !== undefined ? data.name.trim() : goals[index].name,
    targetAmount: data.targetAmount !== undefined ? Number(data.targetAmount) : goals[index].targetAmount,
    savedAmount: data.savedAmount !== undefined ? Number(data.savedAmount) : goals[index].savedAmount,
    deadline: data.deadline !== undefined ? data.deadline : goals[index].deadline,
    icon: data.icon || goals[index].icon,
    updatedAt: new Date().toISOString()
  };

  goals[index] = updatedGoal;
  writeData(FILE, goals);
  return updatedGoal;
}

/**
 * Add funds to a savings goal.
 */
async function addFunds(id, userId, amount) {
  if (isMongoConnected()) {
    const updated = await GoalModel.findOneAndUpdate(
      { id, userId },
      {
        $inc: { savedAmount: Number(amount) },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    ).lean();

    if (!updated) return null;
    delete updated._id;
    delete updated.__v;
    return updated;
  }

  assertProductionStorage();
  const goals = readData(FILE);
  const index = goals.findIndex(g => g.id === id && g.userId === userId);
  if (index === -1) return null;

  goals[index].savedAmount = Math.round((goals[index].savedAmount + Number(amount)) * 100) / 100;
  goals[index].updatedAt = new Date().toISOString();

  writeData(FILE, goals);
  return goals[index];
}

/**
 * Delete a goal.
 */
async function remove(id, userId) {
  if (isMongoConnected()) {
    const result = await GoalModel.deleteOne({ id, userId });
    return result.deletedCount > 0;
  }

  assertProductionStorage();
  const goals = readData(FILE);
  const index = goals.findIndex(g => g.id === id && g.userId === userId);
  if (index === -1) return false;

  goals.splice(index, 1);
  writeData(FILE, goals);
  return true;
}

/**
 * Get goals with computed progress data.
 */
async function getWithProgress(userId) {
  const goals = await findByUserId(userId);

  return goals.map(goal => {
    const percentSaved = goal.targetAmount > 0
      ? Math.round((goal.savedAmount / goal.targetAmount) * 100)
      : 0;
    const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
    const isCompleted = goal.savedAmount >= goal.targetAmount;

    let estimatedCompletion = null;
    if (!isCompleted && goal.savedAmount > 0) {
      const createdDate = new Date(goal.createdAt);
      const now = new Date();
      const monthsElapsed = Math.max(1,
        (now.getFullYear() - createdDate.getFullYear()) * 12 + (now.getMonth() - createdDate.getMonth())
      );
      const avgMonthlySaving = goal.savedAmount / monthsElapsed;
      if (avgMonthlySaving > 0) {
        const monthsToGoal = Math.ceil(remaining / avgMonthlySaving);
        const completionDate = new Date(now);
        completionDate.setMonth(completionDate.getMonth() + monthsToGoal);
        estimatedCompletion = completionDate.toISOString().split('T')[0];
      }
    }

    return {
      ...goal,
      percentSaved,
      remaining: Math.round(remaining * 100) / 100,
      isCompleted,
      estimatedCompletion
    };
  });
}

module.exports = {
  GoalModel,
  findByUserId,
  findById,
  create,
  update,
  addFunds,
  remove,
  getWithProgress
};
