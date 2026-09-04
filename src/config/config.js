const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not defined.');
  process.exit(1);
}

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expenseiq',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Data storage directory
  get DATA_DIR() {
    return process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  },

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
  DEFAULT_CURRENCY: 'INR',

  // AI Configuration
  AI_ENABLED: process.env.AI_ENABLED !== 'false',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini'
};

