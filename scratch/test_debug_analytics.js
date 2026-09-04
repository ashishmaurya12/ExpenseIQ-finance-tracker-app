process.env.NODE_ENV = 'test';
const http = require('http');
const app = require('../server');
const { connectDB } = require('../src/config/db');

let server;
let baseUrl;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function debug() {
  await connectDB();
  server = app.listen(0, async () => {
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
    const timestamp = Date.now();
    const regA = await request('POST', '/auth/register', {
      name: 'Analytics User A',
      email: `analy_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    const token = regA.body.token;

    await request('POST', '/transactions', { type: 'income', amount: 50000, category: 'Salary', date: '2026-08-01', note: 'Aug Salary' }, token);
    await request('POST', '/transactions', { type: 'expense', amount: 15000, category: 'Housing', date: '2026-08-05', note: 'Rent' }, token);
    await request('POST', '/transactions', { type: 'expense', amount: 5000, category: 'Food', date: '2026-08-10', note: 'Groceries' }, token);

    await request('POST', '/transactions', { type: 'income', amount: 55000, category: 'Salary', date: '2026-09-01', note: 'Sep Salary' }, token);
    await request('POST', '/transactions', { type: 'expense', amount: 16000, category: 'Housing', date: '2026-09-05', note: 'Rent' }, token);
    await request('POST', '/transactions', { type: 'expense', amount: 6000, category: 'Food', date: '2026-09-12', note: 'Groceries' }, token);

    const res = await request('GET', '/analytics/overview?month=2026-09', null, token);
    console.log('OVERVIEW RESPONSE:', JSON.stringify(res, null, 2));

    const catRes = await request('GET', '/analytics/categories?month=2026-09', null, token);
    console.log('CATEGORIES RESPONSE:', JSON.stringify(catRes, null, 2));

    server.close();
    process.exit(0);
  });
}

debug();
