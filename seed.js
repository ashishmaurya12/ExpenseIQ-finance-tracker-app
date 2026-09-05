/**
 * ExpenseIQ — Demo Seed Script
 * Injects a demo user + 3 months of realistic transactions
 * Run: node seed.js
 */

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

function writeJSON(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), 'utf8');
}

function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

async function seed() {
  console.log('🌱 Seeding demo data...\n');

  // ── 1. Create Demo User ──────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('demo1234', salt);
  const userId = 'demo_user_001';

  const users = [
    {
      id: userId,
      name: 'Ashish Maurya',
      email: 'demo@expenseiq.com',
      password: hashedPassword,
      currency: 'INR',
      notificationsEnabled: true,
      reminderAlertsEnabled: true,
      createdAt: new Date('2026-07-01').toISOString()
    }
  ];

  writeJSON('users.json', users);
  console.log('✅ User created: demo@expenseiq.com / demo1234');

  // ── 2. Generate Transactions (3 months) ──────────────────────
  // Categories MUST match server config:
  // 'Food', 'Transport', 'Rent', 'Utilities', 'Entertainment',
  // 'Health', 'Shopping', 'Education', 'Salary', 'Freelance',
  // 'Investment', 'Gift', 'Other'
  const transactions = [];

  function addTxn(type, amount, category, date, note) {
    transactions.push({
      id: generateId(),
      userId,
      type,
      amount,
      category,
      date,
      note,
      createdAt: new Date(date).toISOString()
    });
  }

  // ── JULY 2026 ────────────────────────────────────────────────
  addTxn('income',  75000, 'Salary',        '2026-07-01', 'Monthly salary');
  addTxn('income',  8000,  'Freelance',     '2026-07-10', 'Web project payment');
  addTxn('expense', 18000, 'Rent',          '2026-07-02', 'Monthly rent');
  addTxn('expense', 4500,  'Food',          '2026-07-05', 'BigBasket groceries');
  addTxn('expense', 1200,  'Transport',     '2026-07-06', 'Metro & auto');
  addTxn('expense', 3200,  'Food',          '2026-07-08', 'Zomato orders');
  addTxn('expense', 999,   'Entertainment', '2026-07-09', 'Netflix subscription');
  addTxn('expense', 2500,  'Shopping',      '2026-07-12', 'Myntra clothes');
  addTxn('expense', 1800,  'Health',        '2026-07-14', 'Gym membership');
  addTxn('expense', 600,   'Utilities',     '2026-07-15', 'Electricity bill');
  addTxn('expense', 850,   'Food',          '2026-07-17', 'Restaurant dinner');
  addTxn('expense', 1500,  'Transport',     '2026-07-20', 'Ola cabs');
  addTxn('expense', 3800,  'Shopping',      '2026-07-22', 'Amazon electronics');
  addTxn('expense', 700,   'Food',          '2026-07-25', 'Local market');
  addTxn('expense', 1200,  'Food',          '2026-07-28', 'Swiggy orders');
  addTxn('income',  3000,  'Investment',    '2026-07-30', 'Mutual fund dividend');

  // ── AUGUST 2026 ──────────────────────────────────────────────
  addTxn('income',  75000, 'Salary',        '2026-08-01', 'Monthly salary');
  addTxn('income',  12000, 'Freelance',     '2026-08-15', 'App design project');
  addTxn('expense', 18000, 'Rent',          '2026-08-02', 'Monthly rent');
  addTxn('expense', 5200,  'Food',          '2026-08-04', 'Weekly groceries');
  addTxn('expense', 2800,  'Food',          '2026-08-07', 'Team lunch');
  addTxn('expense', 999,   'Entertainment', '2026-08-09', 'Netflix subscription');
  addTxn('expense', 4500,  'Shopping',      '2026-08-10', 'Birthday gift shopping');
  addTxn('expense', 1800,  'Health',        '2026-08-12', 'Gym membership');
  addTxn('expense', 1100,  'Transport',     '2026-08-13', 'Ola & metro');
  addTxn('expense', 700,   'Utilities',     '2026-08-14', 'Internet bill');
  addTxn('expense', 9500,  'Other',         '2026-08-16', 'Weekend trip to Manali');
  addTxn('expense', 2200,  'Food',          '2026-08-18', 'Hotel restaurant');
  addTxn('expense', 3500,  'Shopping',      '2026-08-21', 'Clothes shopping');
  addTxn('expense', 1400,  'Food',          '2026-08-24', 'D-Mart groceries');
  addTxn('expense', 900,   'Food',          '2026-08-27', 'Cafe & snacks');
  addTxn('expense', 2000,  'Health',        '2026-08-29', 'Doctor consultation');
  addTxn('income',  5000,  'Investment',    '2026-08-31', 'SIP return');

  // ── SEPTEMBER 2026 (current month) ──────────────────────────
  addTxn('income',  75000, 'Salary',        '2026-09-01', 'Monthly salary');
  addTxn('expense', 18000, 'Rent',          '2026-09-01', 'Monthly rent');
  addTxn('expense', 3600,  'Food',          '2026-09-02', 'BigBasket groceries');
  addTxn('expense', 1800,  'Food',          '2026-09-03', 'Swiggy & Zomato');
  addTxn('expense', 999,   'Entertainment', '2026-09-04', 'Netflix subscription');
  addTxn('expense', 1200,  'Transport',     '2026-09-04', 'Ola & metro');
  addTxn('expense', 1800,  'Health',        '2026-09-05', 'Gym membership');

  writeJSON('transactions.json', transactions);
  console.log(`✅ ${transactions.length} transactions created across 3 months`);

  // ── 3. Budgets ───────────────────────────────────────────────
  const budgets = [
    { id: generateId(), userId, category: 'Food',          monthlyLimit: 8000,  month: '2026-09', createdAt: new Date().toISOString() },
    { id: generateId(), userId, category: 'Shopping',      monthlyLimit: 6000,  month: '2026-09', createdAt: new Date().toISOString() },
    { id: generateId(), userId, category: 'Transport',     monthlyLimit: 2000,  month: '2026-09', createdAt: new Date().toISOString() },
    { id: generateId(), userId, category: 'Entertainment', monthlyLimit: 2000,  month: '2026-09', createdAt: new Date().toISOString() },
    { id: generateId(), userId, category: 'Health',        monthlyLimit: 3000,  month: '2026-09', createdAt: new Date().toISOString() }
  ];
  writeJSON('budgets.json', budgets);
  console.log('✅ 5 budgets created for Sep 2026');

  // ── 4. Goals ─────────────────────────────────────────────────
  const goals = [
    {
      id: generateId(), userId,
      name: 'Emergency Fund',
      targetAmount: 200000,
      currentAmount: 45000,
      targetDate: '2027-03-31',
      category: 'Other',
      note: '6 months of expenses saved',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(), userId,
      name: 'New Laptop',
      targetAmount: 90000,
      currentAmount: 30000,
      targetDate: '2026-12-31',
      category: 'Shopping',
      note: 'MacBook Pro',
      createdAt: new Date().toISOString()
    },
    {
      id: generateId(), userId,
      name: 'Goa Trip',
      targetAmount: 35000,
      currentAmount: 15000,
      targetDate: '2026-12-15',
      category: 'Other',
      note: 'Family vacation',
      createdAt: new Date().toISOString()
    }
  ];
  writeJSON('goals.json', goals);
  console.log('✅ 3 savings goals created');

  console.log('\n🎉 Done! Login with:');
  console.log('   Email   : demo@expenseiq.com');
  console.log('   Password: demo1234');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
