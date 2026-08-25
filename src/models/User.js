const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { readData, writeData } = require('../utils/fileStore');
const { generateId } = require('../utils/helpers');
const { DEFAULT_CURRENCY } = require('../config/config');

const FILE = 'users.json';

// Mongoose User Schema
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  currency: { type: String, default: DEFAULT_CURRENCY },
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Find a user by email.
 */
async function findByEmail(email) {
  if (isMongoConnected()) {
    const user = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean();
    return user || null;
  }
  const users = readData(FILE);
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Find a user by ID.
 */
async function findById(id) {
  if (isMongoConnected()) {
    const user = await UserModel.findOne({ id }).lean();
    return user || null;
  }
  const users = readData(FILE);
  return users.find(u => u.id === id) || null;
}

/**
 * Create a new user with hashed password.
 */
async function create({ name, email, password, currency }) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const userId = generateId();

  if (isMongoConnected()) {
    const newUser = await UserModel.create({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      currency: currency || DEFAULT_CURRENCY,
      createdAt: new Date()
    });

    const userObj = newUser.toObject();
    delete userObj.password;
    delete userObj._id;
    delete userObj.__v;
    return userObj;
  }

  const users = readData(FILE);
  const newUser = {
    id: userId,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password: hashedPassword,
    currency: currency || DEFAULT_CURRENCY,
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  writeData(FILE, users);

  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

/**
 * Compare a plain-text password with a hashed password.
 */
async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

module.exports = {
  UserModel,
  findByEmail,
  findById,
  create,
  comparePassword
};
