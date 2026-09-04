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

const SUPPORTED_CURRENCIES = [
  'INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'HKD', 'NZD', 'SEK', 'KRW', 'SGD', 'NOK', 'MXN', 'BRL', 'RUB', 'ZAR', 'TRY', 'SAR', 'AED'
];

/**
 * Validate profile update input.
 */
function validateProfileUpdate(req, res, next) {
  const { name, currency, notificationsEnabled, reminderAlertsEnabled } = req.body;
  const errors = [];

  if (name !== undefined && (!name || name.trim().length < 2)) {
    errors.push('Name must be at least 2 characters.');
  }
  if (currency !== undefined) {
    const currStr = String(currency).trim().toUpperCase();
    if (!currStr || !/^[A-Z]{3}$/.test(currStr) || !SUPPORTED_CURRENCIES.includes(currStr)) {
      errors.push(`Valid 3-letter currency code (e.g. ${SUPPORTED_CURRENCIES.slice(0, 5).join(', ')}) is required.`);
    }
  }
  if (notificationsEnabled !== undefined && typeof notificationsEnabled !== 'boolean') {
    errors.push('notificationsEnabled must be a boolean.');
  }
  if (reminderAlertsEnabled !== undefined && typeof reminderAlertsEnabled !== 'boolean') {
    errors.push('reminderAlertsEnabled must be a boolean.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }

  if (req.body.currency) {
    req.body.currency = req.body.currency.trim().toUpperCase();
  }
  next();
}

/**
 * Validate route ID parameter.
 */
function validateIdParam(req, res, next) {
  const { id } = req.params;
  if (!id || typeof id !== 'string' || id.trim() === '' || id.length > 100 || !/^[a-zA-Z0-9_\-]+$/.test(id.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid ID parameter.' });
  }
  next();
}

/**
 * Validate recurring transaction input.
 */
function validateRecurringTransaction(req, res, next) {
  const { type, amount, category, frequency, startDate, nextDueDate, endDate, description, notes } = req.body;
  const errors = [];
  const ALLOWED_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  if (type !== undefined || req.method === 'POST') {
    if (!type || !['income', 'expense'].includes(type)) {
      errors.push("Type must be either 'income' or 'expense'.");
    }
  }

  if (amount !== undefined || req.method === 'POST') {
    if (amount === undefined || amount === null || isNaN(amount) || !isFinite(amount) || Number(amount) <= 0) {
      errors.push('Amount must be a positive finite number.');
    }
  }

  if (category !== undefined || req.method === 'POST') {
    if (!category || typeof category !== 'string' || !category.trim() || category.length > 50) {
      errors.push('Category is required and must not exceed 50 characters.');
    }
  }

  if (frequency !== undefined || req.method === 'POST') {
    if (!frequency || !ALLOWED_FREQUENCIES.includes(frequency)) {
      errors.push(`Frequency must be one of: ${ALLOWED_FREQUENCIES.join(', ')}.`);
    }
  }

  if (startDate !== undefined || req.method === 'POST') {
    if (!startDate || !DATE_REGEX.test(startDate) || isNaN(Date.parse(startDate))) {
      errors.push('startDate must be a valid date in YYYY-MM-DD format.');
    }
  }

  if (nextDueDate !== undefined && nextDueDate !== null) {
    if (!DATE_REGEX.test(nextDueDate) || isNaN(Date.parse(nextDueDate))) {
      errors.push('nextDueDate must be a valid date in YYYY-MM-DD format.');
    }
  }

  if (endDate !== undefined && endDate !== null && endDate !== '') {
    if (!DATE_REGEX.test(endDate) || isNaN(Date.parse(endDate))) {
      errors.push('endDate must be a valid date in YYYY-MM-DD format.');
    } else if (startDate && endDate < startDate) {
      errors.push('endDate cannot be before startDate.');
    }
  }

  if (description !== undefined && description !== null && String(description).length > 200) {
    errors.push('Description must not exceed 200 characters.');
  }

  if (notes !== undefined && notes !== null && String(notes).length > 500) {
    errors.push('Notes must not exceed 500 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate reminder input.
 */
function validateReminder(req, res, next) {
  const { title, amount, dueDate, priority, status, reminderDaysBefore, notes } = req.body;
  const errors = [];
  const ALLOWED_STATUSES = ['pending', 'completed', 'overdue', 'dismissed'];
  const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];
  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  if (title !== undefined || req.method === 'POST') {
    if (!title || typeof title !== 'string' || !title.trim() || title.length > 100) {
      errors.push('Title is required and must not exceed 100 characters.');
    }
  }

  if (amount !== undefined && amount !== null && amount !== '') {
    if (isNaN(amount) || !isFinite(amount) || Number(amount) < 0) {
      errors.push('Amount must be a non-negative finite number.');
    }
  }

  if (dueDate !== undefined || req.method === 'POST') {
    if (!dueDate || !DATE_REGEX.test(dueDate) || isNaN(Date.parse(dueDate))) {
      errors.push('dueDate must be a valid date in YYYY-MM-DD format.');
    }
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}.`);
  }

  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    errors.push(`Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}.`);
  }

  if (reminderDaysBefore !== undefined && reminderDaysBefore !== null) {
    const days = parseInt(reminderDaysBefore, 10);
    if (isNaN(days) || days < 0 || days > 30) {
      errors.push('reminderDaysBefore must be an integer between 0 and 30.');
    }
  }

  if (notes !== undefined && notes !== null && String(notes).length > 500) {
    errors.push('Notes must not exceed 500 characters.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
}

/**
 * Validate notification query/input parameters.
 */
function validateNotification(req, res, next) {
  const { type, priority } = req.body;
  const errors = [];
  const ALLOWED_TYPES = ['reminder', 'budget', 'goal', 'system', 'anomaly', 'ai_insight'];
  const ALLOWED_PRIORITIES = ['low', 'medium', 'high'];

  if (type !== undefined && !ALLOWED_TYPES.includes(type)) {
    errors.push(`Type must be one of: ${ALLOWED_TYPES.join(', ')}.`);
  }

  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    errors.push(`Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}.`);
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
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
  validateIdParam,
  validateRecurringTransaction,
  validateReminder,
  validateNotification
};
