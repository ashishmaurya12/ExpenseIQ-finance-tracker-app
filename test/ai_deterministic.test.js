const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const mongoose = require('mongoose');
const app = require('../server');
const { connectDB } = require('../src/config/db');
const { setOpenAIClient } = require('../src/services/aiService');

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
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('Deterministic AI Endpoints & Fallback Contract Suite', async (t) => {
  const timestamp = Date.now();
  let userToken, userId;

  t.before(async () => {
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Register User
    const reg = await request('POST', '/auth/register', {
      name: 'Deterministic AI User',
      email: `det_ai_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userToken = reg.body.token;
    userId = reg.body.user.id;
  });

  t.after(async () => {
    setOpenAIClient(null);
    delete process.env.AI_ENABLED;
    if (server) {
      await new Promise(res => server.close(res));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  await t.test('TEST A — AI Success returns HTTP 200 & reply', async () => {
    process.env.AI_ENABLED = 'true';
    const mockClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: 'Your current food expense is ₹6,500, which is within your monthly limit of ₹10,000.'
                }
              }
            ]
          })
        }
      }
    };
    setOpenAIClient(mockClient);

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I overspending?' }, userToken);
    assert.equal(chatRes.status, 200, 'Mocked OpenAI success returns exact HTTP 200');
    assert.equal(chatRes.body.success, true);
    assert.ok(typeof chatRes.body.reply === 'string' && chatRes.body.reply.length > 0);
  });

  await t.test('TEST B — AI Provider Error returns exact HTTP 503', async () => {
    process.env.AI_ENABLED = 'true';
    const mockErrorClient = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('OpenAI API Quota Exceeded / Network Timeout');
          }
        }
      }
    };
    setOpenAIClient(mockErrorClient);

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I overspending?' }, userToken);
    assert.equal(chatRes.status, 503, 'Mocked OpenAI error returns exact HTTP 503');
    assert.equal(chatRes.body.success, false);
    assert.equal(chatRes.body.message, 'AI assistant is temporarily unavailable.');
  });

  await t.test('TEST C — AI Disabled returns exact HTTP 503', async () => {
    process.env.AI_ENABLED = 'false';

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I overspending?' }, userToken);
    assert.equal(chatRes.status, 503, 'AI_ENABLED=false returns exact HTTP 503');
    assert.equal(chatRes.body.success, false);
    assert.equal(chatRes.body.message, 'AI features are currently unavailable.');

    process.env.AI_ENABLED = 'true'; // restore
  });

  await t.test('TEST D — Missing API Key returns exact HTTP 503', async () => {
    process.env.AI_ENABLED = 'true';
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    setOpenAIClient(null);

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I overspending?' }, userToken);
    assert.equal(chatRes.status, 503, 'Missing OPENAI_API_KEY returns exact HTTP 503');
    assert.equal(chatRes.body.success, false);
    assert.equal(chatRes.body.message, 'AI assistant is temporarily unavailable.');

    if (savedKey) process.env.OPENAI_API_KEY = savedKey;
  });

  await t.test('AI Insights Success & Malformed JSON Validation', async () => {
    process.env.AI_ENABLED = 'true';
    const mockInsightsClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify([
                    {
                      title: 'Reduce Dining Out',
                      description: 'Your Food expenses are 20% higher than last month.',
                      category: 'Food',
                      priority: 'high'
                    }
                  ])
                }
              }
            ]
          })
        }
      }
    };
    setOpenAIClient(mockInsightsClient);

    const insightsRes = await request('GET', '/ai/insights', null, userToken);
    assert.equal(insightsRes.status, 200, 'Mocked valid AI insights returns HTTP 200');
    assert.equal(insightsRes.body.success, true);
    assert.equal(insightsRes.body.insights.length, 1);
    assert.equal(insightsRes.body.insights[0].priority, 'high');

    // Test Malformed Insights JSON
    const mockMalformedClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: 'Not a valid JSON array string'
                }
              }
            ]
          })
        }
      }
    };
    setOpenAIClient(mockMalformedClient);

    const malformedRes = await request('GET', '/ai/insights', null, userToken);
    assert.equal(malformedRes.status, 503, 'Malformed AI insights JSON returns exact HTTP 503');
    assert.equal(malformedRes.body.success, false);
    assert.equal(malformedRes.body.message, 'AI insights are temporarily unavailable.');
  });
});
