/**
 * ExpenseIQ — MongoDB Seed Script
 * Seeds 3 months of demo transactions for the logged-in demo user via API.
 * Run: node seed_via_api.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Categories matching server config exactly
const transactions = [
  // JULY 2026
  { type: 'income',  amount: 75000, category: 'Salary',        date: '2026-07-01', note: 'Monthly salary' },
  { type: 'income',  amount: 8000,  category: 'Freelance',     date: '2026-07-10', note: 'Web project payment' },
  { type: 'expense', amount: 18000, category: 'Rent',          date: '2026-07-02', note: 'Monthly rent' },
  { type: 'expense', amount: 4500,  category: 'Food',          date: '2026-07-05', note: 'BigBasket groceries' },
  { type: 'expense', amount: 1200,  category: 'Transport',     date: '2026-07-06', note: 'Metro & auto' },
  { type: 'expense', amount: 3200,  category: 'Food',          date: '2026-07-08', note: 'Zomato orders' },
  { type: 'expense', amount: 999,   category: 'Entertainment', date: '2026-07-09', note: 'Netflix subscription' },
  { type: 'expense', amount: 2500,  category: 'Shopping',      date: '2026-07-12', note: 'Myntra clothes' },
  { type: 'expense', amount: 1800,  category: 'Health',        date: '2026-07-14', note: 'Gym membership' },
  { type: 'expense', amount: 600,   category: 'Utilities',     date: '2026-07-15', note: 'Electricity bill' },
  { type: 'expense', amount: 850,   category: 'Food',          date: '2026-07-17', note: 'Restaurant dinner' },
  { type: 'expense', amount: 1500,  category: 'Transport',     date: '2026-07-20', note: 'Ola cabs' },
  { type: 'expense', amount: 3800,  category: 'Shopping',      date: '2026-07-22', note: 'Amazon electronics' },
  { type: 'expense', amount: 700,   category: 'Food',          date: '2026-07-25', note: 'Local market' },
  { type: 'expense', amount: 1200,  category: 'Food',          date: '2026-07-28', note: 'Swiggy orders' },
  { type: 'income',  amount: 3000,  category: 'Investment',    date: '2026-07-30', note: 'Mutual fund dividend' },

  // AUGUST 2026
  { type: 'income',  amount: 75000, category: 'Salary',        date: '2026-08-01', note: 'Monthly salary' },
  { type: 'income',  amount: 12000, category: 'Freelance',     date: '2026-08-15', note: 'App design project' },
  { type: 'expense', amount: 18000, category: 'Rent',          date: '2026-08-02', note: 'Monthly rent' },
  { type: 'expense', amount: 5200,  category: 'Food',          date: '2026-08-04', note: 'Weekly groceries' },
  { type: 'expense', amount: 2800,  category: 'Food',          date: '2026-08-07', note: 'Team lunch' },
  { type: 'expense', amount: 999,   category: 'Entertainment', date: '2026-08-09', note: 'Netflix subscription' },
  { type: 'expense', amount: 4500,  category: 'Shopping',      date: '2026-08-10', note: 'Birthday gift shopping' },
  { type: 'expense', amount: 1800,  category: 'Health',        date: '2026-08-12', note: 'Gym membership' },
  { type: 'expense', amount: 1100,  category: 'Transport',     date: '2026-08-13', note: 'Ola & metro' },
  { type: 'expense', amount: 700,   category: 'Utilities',     date: '2026-08-14', note: 'Internet bill' },
  { type: 'expense', amount: 9500,  category: 'Other',         date: '2026-08-16', note: 'Weekend trip to Manali' },
  { type: 'expense', amount: 2200,  category: 'Food',          date: '2026-08-18', note: 'Hotel restaurant' },
  { type: 'expense', amount: 3500,  category: 'Shopping',      date: '2026-08-21', note: 'Clothes shopping' },
  { type: 'expense', amount: 1400,  category: 'Food',          date: '2026-08-24', note: 'D-Mart groceries' },
  { type: 'expense', amount: 900,   category: 'Food',          date: '2026-08-27', note: 'Cafe & snacks' },
  { type: 'expense', amount: 2000,  category: 'Health',        date: '2026-08-29', note: 'Doctor consultation' },
  { type: 'income',  amount: 5000,  category: 'Investment',    date: '2026-08-31', note: 'SIP return' },

  // SEPTEMBER 2026
  { type: 'expense', amount: 3600,  category: 'Food',          date: '2026-09-02', note: 'BigBasket groceries' },
  { type: 'expense', amount: 1800,  category: 'Food',          date: '2026-09-03', note: 'Swiggy & Zomato' },
  { type: 'expense', amount: 999,   category: 'Entertainment', date: '2026-09-04', note: 'Netflix subscription' },
  { type: 'expense', amount: 1200,  category: 'Transport',     date: '2026-09-04', note: 'Ola & metro' },
  { type: 'expense', amount: 1800,  category: 'Health',        date: '2026-09-05', note: 'Gym membership' },
];

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(data && { 'Content-Length': Buffer.byteLength(data) })
      }
    };

    const req = http.request(options, res => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, body: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🌱 Seeding via API...\n');

  // Step 1: Login
  const loginRes = await apiRequest('POST', '/api/auth/login', {
    email: 'demo@expenseiq.com',
    password: 'demo1234'
  });

  if (!loginRes.body.success) {
    console.error('❌ Login failed:', loginRes.body.message);
    process.exit(1);
  }

  const token = loginRes.body.token;
  const userId = loginRes.body.user.id;
  console.log(`✅ Logged in as: ${loginRes.body.user.name} (id: ${userId})`);

  // Step 2: Add all transactions
  let success = 0, failed = 0;
  for (const txn of transactions) {
    const res = await apiRequest('POST', '/api/transactions', txn, token);
    if (res.body.success) {
      success++;
    } else {
      console.warn(`  ⚠️  Failed: ${txn.type} ${txn.category} ${txn.date} — ${res.body.message}`);
      failed++;
    }
  }
  console.log(`✅ Transactions: ${success} added, ${failed} failed`);

  // Step 3: Add budgets
  const budgets = [
    { category: 'Food',          monthlyLimit: 8000,  month: '2026-09' },
    { category: 'Shopping',      monthlyLimit: 6000,  month: '2026-09' },
    { category: 'Transport',     monthlyLimit: 2000,  month: '2026-09' },
    { category: 'Entertainment', monthlyLimit: 2000,  month: '2026-09' },
    { category: 'Health',        monthlyLimit: 3000,  month: '2026-09' },
  ];

  let budgetOk = 0;
  for (const b of budgets) {
    const res = await apiRequest('POST', '/api/budgets', b, token);
    if (res.body.success) budgetOk++;
    else console.warn(`  ⚠️  Budget failed: ${b.category} — ${res.body.message}`);
  }
  console.log(`✅ Budgets: ${budgetOk}/${budgets.length} added`);

  // Step 4: Add goals
  const goals = [
    { name: 'Emergency Fund', targetAmount: 200000, currentAmount: 45000, targetDate: '2027-03-31', note: '6 months of expenses saved' },
    { name: 'New Laptop',     targetAmount: 90000,  currentAmount: 30000, targetDate: '2026-12-31', note: 'MacBook Pro' },
    { name: 'Goa Trip',       targetAmount: 35000,  currentAmount: 15000, targetDate: '2026-12-15', note: 'Family vacation' },
  ];

  let goalOk = 0;
  for (const g of goals) {
    const res = await apiRequest('POST', '/api/goals', g, token);
    if (res.body.success) goalOk++;
    else console.warn(`  ⚠️  Goal failed: ${g.name} — ${res.body.message}`);
  }
  console.log(`✅ Goals: ${goalOk}/${goals.length} added`);

  console.log('\n🎉 Done! Now refresh your browser dashboard to see data.');
  console.log('   Login: demo@expenseiq.com / demo1234');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
