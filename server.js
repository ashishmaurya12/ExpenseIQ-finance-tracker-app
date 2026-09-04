const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { PORT, FRONTEND_URL } = require('./src/config/config');
const { connectDB } = require('./src/config/db');
const { migrateJsonToMongo } = require('./src/utils/migrateJsonToMongo');
const errorHandler = require('./src/middlewares/errorHandler');
const { authRateLimiter, apiRateLimiter } = require('./src/middlewares/rateLimiter');

const app = express();

// --------------- Security & CORS ---------------
app.use(helmet({
  contentSecurityPolicy: false,   // Allow inline scripts for Chart.js / CDN
  crossOriginEmbedderPolicy: false
}));

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || origin === FRONTEND_URL || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true);
    } else {
      callback(new Error('CORS request rejected: origin not allowed by policy.'));
    }
  },
  credentials: true
};
app.use(cors(corsOptions));

// --------------- Body Parsing & Request Limits ---------------
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ limit: '100kb', extended: true }));

// --------------- Rate Limiting ---------------
app.use('/api/', apiRateLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// --------------- Static Files ---------------
app.use(express.static(path.join(__dirname, 'public')));

// --------------- API Routes ---------------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/budgets', require('./src/routes/budgets'));
app.use('/api/goals', require('./src/routes/goals'));
app.use('/api/insights', require('./src/routes/insights'));

// --------------- API 404 Catch-All ---------------
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// --------------- SPA Fallback ---------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --------------- Error Handler ---------------
app.use(errorHandler);

// --------------- Start Server ---------------
async function startServer() {
  const connected = await connectDB();
  if (connected) {
    await migrateJsonToMongo();
  }

  app.listen(PORT, () => {
    console.log(`  🚀 ExpenseIQ server running at http://localhost:${PORT}\n`);
  });
}

startServer();
