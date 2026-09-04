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
  const { category, monthlyLimit, month } = req.body;
  const errors = [];

  if (!category || !CATEGORIES.includes(category)) {
    errors.push(`Category must be one of: ${CATEGORIES.join(', ')}.`);
  }
  if (monthlyLimit === undefined || isNaN(monthlyLimit) || Number(monthlyLimit) <= 0) {
    errors.push('Monthly limit must be a positive number.');
  }
  if (month !== undefined && month !== null && String(month).trim() !== '') {
    const monthStr = String(month).trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthStr)) {
      errors.push('Invalid month format. Expected YYYY-MM.');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }

  req.body.monthlyLimit = Number(req.body.monthlyLimit);
  next();
}

/**
 * Validate password change input.
 */
function validatePasswordChange(req, res, next) {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push('Current password is required.');
  }
  if (!newPassword || newPassword.length < 6) {
    errors.push('New password must be at least 6 characters.');
  }
  if (confirmPassword !== undefined && newPassword !== confirmPassword) {
    errors.push('New password and confirm password do not match.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate profile update input.
 */
function validateProfileUpdate(req, res, next) {
  const { name, currency } = req.body;
  const errors = [];

  if (name !== undefined && (!name || name.trim().length < 2)) {
    errors.push('Name must be at least 2 characters.');
  }
  if (currency !== undefined && (!currency || typeof currency !== 'string')) {
    errors.push('Valid currency code is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate route ID parameter.
 */
function validateIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return res.status(400).json({ success: false, message: 'Invalid ID parameter.' });
  }
  next();
}

module.exports = {
  validateRegister,
  validateLogin,
  validateTransaction,
  validateBudget,
  validatePasswordChange,
  validateProfileUpdate,
  validateIdParam
};
