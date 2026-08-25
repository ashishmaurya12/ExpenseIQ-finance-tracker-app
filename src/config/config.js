const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseiq',

  // Data storage directory
  DATA_DIR: path.join(__dirname, '..', '..', 'data'),

  // Default categories
  CATEGORIES: [
    'Food',
    'Transport',
    'Rent',
    'Utilities',
    'Entertainment',
    'Health',
    'Shopping',
    'Education',
    'Salary',
    'Freelance',
    'Investment',
    'Gift',
    'Other'
  ],

  // Transaction types
  TRANSACTION_TYPES: ['income', 'expense'],

  // Default currency
  DEFAULT_CURRENCY: 'INR'
};
