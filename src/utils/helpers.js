const { v4: uuidv4 } = require('uuid');

/**
 * Generate a UUID v4 string.
 */
function generateId() {
  return uuidv4();
}

/**
 * Get current month as "YYYY-MM" string.
 */
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Extract "YYYY-MM" from a date string.
 * @param {string} dateStr - ISO date string or "YYYY-MM-DD"
 */
function getMonthFromDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 7);
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Validate a date string is parseable.
 */
function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Get ISO date string for today ("YYYY-MM-DD").
 */
function getToday() {
  return new Date().toISOString().split('T')[0];
}

module.exports = {
  generateId,
  getCurrentMonth,
  getMonthFromDate,
  isValidDate,
  getToday
};
