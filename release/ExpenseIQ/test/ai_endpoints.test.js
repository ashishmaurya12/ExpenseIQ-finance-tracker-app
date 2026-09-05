process.env.NODE_ENV = 'test';
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

const { setupTestIsolation } = require('./helpers/testSetup');

test('AI Endpoints & Security Hardening Suite', async (t) => {
  const timestamp = Date.now();
  let userAToken, userAId, userBToken, userBId;
  let isolation;

  t.before(async () => {
    isolation = setupTestIsolation('ai_endpoints');
    await connectDB();

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}/api`;
        resolve();
      });
    });

    // Register User A
    const regA = await request('POST', '/auth/register', {
      name: 'AI Test User A',
      email: `ai_user_a_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userAToken = regA.body ? regA.body.token : null;
    userAId = regA.body && regA.body.user ? regA.body.user.id : null;

    // Register User B
    const regB = await request('POST', '/auth/register', {
      name: 'AI Test User B',
      email: `ai_user_b_${timestamp}@example.com`,
      password: 'Password123!',
      currency: 'INR'
    });
    userBToken = regB.body ? regB.body.token : null;
    userBId = regB.body && regB.body.user ? regB.body.user.id : null;
  });

  t.after(async () => {
    setOpenAIClient(null);
    delete process.env.AI_ENABLED;
    if (server) {
      await new Promise(res => server.close(res));
      server = null;
    }
    if (mongoose.connection.readyState === 1) {
      try {
        await mongoose.connection.close(true);
      } catch {}
    }
    if (isolation) isolation.cleanup();
  });

  await t.test('1. Authentication & JWT Validation (401 Unauthorized)', async () => {
    const unauth = await request('POST', '/ai/chat', { message: 'Hello' });
    assert.equal(unauth.status, 401, 'Unauthenticated POST /api/ai/chat returns HTTP 401');
    assert.equal(unauth.body.success, false);

    const invalidToken = await request('POST', '/ai/chat', { message: 'Hello' }, 'bad.jwt.token');
    assert.equal(invalidToken.status, 401, 'Invalid JWT token returns HTTP 401');
    assert.equal(invalidToken.body.success, false);

    const unauthInsights = await request('GET', '/ai/insights');
    assert.equal(unauthInsights.status, 401, 'Unauthenticated GET /api/ai/insights returns HTTP 401');
    assert.equal(unauthInsights.body.success, false);
  });

  await t.test('2. Input Validation (400 Bad Request)', async () => {
    const emptyMsg = await request('POST', '/ai/chat', { message: '' }, userAToken);
    assert.equal(emptyMsg.status, 400, 'Empty message returns HTTP 400');
    assert.equal(emptyMsg.body.success, false);

    const whitespaceMsg = await request('POST', '/ai/chat', { message: '   ' }, userAToken);
    assert.equal(whitespaceMsg.status, 400, 'Whitespace message returns HTTP 400');
    assert.equal(whitespaceMsg.body.success, false);

    const longMsg = await request('POST', '/ai/chat', { message: 'A'.repeat(505) }, userAToken);
    assert.equal(longMsg.status, 400, 'Overlong message returns HTTP 400');
    assert.equal(longMsg.body.success, false);
  });

  await t.test('3. Test A — Successful Mocked AI Chat returns HTTP 200', async () => {
    process.env.AI_ENABLED = 'true';
    const mockSuccessClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: 'Your financial balance looks healthy. Top expense category is Food.'
                }
              }
            ]
          })
        }
      }
    };
    setOpenAIClient(mockSuccessClient);

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I spending most?' }, userAToken);
    assert.equal(chatRes.status, 200, 'Successful AI chat returns HTTP 200');
    assert.equal(chatRes.body.success, true, 'success field is true');
    assert.ok(typeof chatRes.body.reply === 'string' && chatRes.body.reply.length > 0, 'reply is a non-empty string');
    assert.equal(chatRes.body.reply, 'Your financial balance looks healthy. Top expense category is Food.');
  });

  await t.test('4. Test B — Mocked Provider Failure returns HTTP 503', async () => {
    process.env.AI_ENABLED = 'true';
    const mockFailureClient = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('simulated provider failure');
          }
        }
      }
    };
    setOpenAIClient(mockFailureClient);

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I spending most?' }, userAToken);
    assert.equal(chatRes.status, 503, 'Provider failure returns exact HTTP 503');
    assert.equal(chatRes.body.success, false);
    assert.equal(chatRes.body.message, 'AI assistant is temporarily unavailable.');

    // Confirm no raw error info leaked in error response
    assert.equal(chatRes.body.error, undefined, 'No raw error property exposed');
    assert.equal(chatRes.body.stack, undefined, 'No stack trace exposed');
  });

  await t.test('5. Test C — AI Disabled returns HTTP 503', async () => {
    process.env.AI_ENABLED = 'false';

    const chatRes = await request('POST', '/ai/chat', { message: 'Where am I spending most?' }, userAToken);
    assert.equal(chatRes.status, 503, 'AI disabled returns exact HTTP 503');
    assert.equal(chatRes.body.success, false);
    assert.equal(chatRes.body.message, 'AI features are currently unavailable.');

    const insightsRes = await request('GET', '/ai/insights', null, userAToken);
    assert.equal(insightsRes.status, 503, 'AI disabled insights returns exact HTTP 503');
    assert.equal(insightsRes.body.success, false);
    assert.equal(insightsRes.body.message, 'AI features are currently unavailable.');

    process.env.AI_ENABLED = 'true'; // Restore AI
  });

  await t.test('6. Test D — Valid Mocked AI Insights returns HTTP 200', async () => {
    process.env.AI_ENABLED = 'true';
    const validInsightsData = [
      {
        title: 'Reduce Dining Expenses',
        description: 'Your Food spending is ₹5,000 this month.',
        category: 'Food',
        priority: 'high'
      },
      {
        title: 'Increase Monthly Savings',
        description: 'You can allocate ₹2,000 extra to Emergency Fund.',
        category: 'Savings',
        priority: 'medium'
      }
    ];

    const mockInsightsClient = {
      chat: {
        completions: {
          create: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify(validInsightsData)
                }
              }
            ]
          })
        }
      }
    };
    setOpenAIClient(mockInsightsClient);

    const insightsRes = await request('GET', '/ai/insights', null, userAToken);
    assert.equal(insightsRes.status, 200, 'Valid insights return HTTP 200');
    assert.equal(insightsRes.body.success, true);
    assert.ok(Array.isArray(insightsRes.body.insights), 'insights property is an array');
    assert.equal(insightsRes.body.insights.length, 2);

    for (const item of insightsRes.body.insights) {
      assert.ok(typeof item.title === 'string' && item.title.trim().length > 0);
      assert.ok(typeof item.description === 'string' && item.description.trim().length > 0);
      assert.ok(typeof item.category === 'string' && item.category.trim().length > 0);
      assert.ok(['high', 'medium', 'low'].includes(item.priority), 'priority is high, medium, or low');
    }
  });

  await t.test('7. Test E — Malformed AI Insights returns HTTP 503', async () => {
    process.env.AI_ENABLED = 'true';
    const malformedPayloads = [
      'this is not json',
      '[]',
      '{}',
      JSON.stringify([{ title: '' }]),
      JSON.stringify([{ title: 'Valid', description: 'Desc', category: 'Cat', priority: 'invalid_priority' }])
    ];

    for (const rawPayload of malformedPayloads) {
      const mockMalformedClient = {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: rawPayload
                  }
                }
              ]
            })
          }
        }
      };
      setOpenAIClient(mockMalformedClient);

      const malformedRes = await request('GET', '/ai/insights', null, userAToken);
      assert.equal(malformedRes.status, 503, `Malformed payload returns HTTP 503 for: ${rawPayload.slice(0, 30)}`);
      assert.equal(malformedRes.body.success, false);
      assert.equal(malformedRes.body.message, 'AI insights are temporarily unavailable.');
    }
  });

  await t.test('8. User Isolation & Body UserID Spoofing Protection', async () => {
    process.env.AI_ENABLED = 'true';
    let passedUserId = null;

    setOpenAIClient({
      chat: {
        completions: {
          create: async (payload) => {
            const sysMsg = payload.messages.find(m => m.role === 'system');
            passedUserId = sysMsg ? sysMsg.content : '';
            return {
              choices: [{ message: { content: 'User A budget status.' } }]
            };
          }
        }
      }
    });

    const spoofed = await request('POST', '/ai/chat', {
      message: 'What is my budget?',
      userId: userBId
    }, userAToken);

    assert.equal(spoofed.status, 200, 'Authenticated request succeeds as User A');
    assert.equal(spoofed.body.success, true);
    assert.equal(spoofed.body.reply, 'User A budget status.');
  });
});
