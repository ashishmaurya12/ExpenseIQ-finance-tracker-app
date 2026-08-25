const { CATEGORIES, TRANSACTION_TYPES } = require('../config/config');

/**
 * Validate registration input.
 */
function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email address is required.');
  }
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate login input.
 */
function validateLogin(req, res, next) {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('A valid email address is required.');
  }
  if (!password) {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate transaction input.
 */
function validateTransaction(req, res, next) {
  const { type, amount, category, date } = req.body;
  const errors = [];

  if (!type || !TRANSACTION_TYPES.includes(type)) {
    errors.push(`Type must be one of: ${TRANSACTION_TYPES.join(', ')}.`);
  }
  if (amount === undefined || amount === null || isNaN(amount) || Number(amount) <= 0) {
    errors.push('Amount must be a positive number.');
  }
  if (!category || !CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }
  if (!date || isNaN(new Date(date).getTime())) {
    errors.push('A valid date is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }

  // Normalize
  req.body.amount = Number(req.body.amount);
  next();
}

/**
 * Validate budget input.
 */
function validateBudget(req, res, next) {
  const { category, monthlyLimit } = req.body;
  const errors = [];

  if (!category || !CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }
  if (monthlyLimit === undefined || isNaN(monthlyLimit) || Number(monthlyLimit) <= 0) {
    errors.push('Monthly limit must be a positive number.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }

  req.body.monthlyLimit = Number(req.body.monthlyLimit);
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateTransaction,
  validateBudget
};
