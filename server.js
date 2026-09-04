const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const mongoose = require('mongoose');
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

const isProduction = process.env.NODE_ENV === 'production';

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === FRONTEND_URL) return callback(null, true);
    if (!isProduction && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return callback(null, true);
    }
    return callback(new Error('CORS request rejected: origin not allowed by policy.'));
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

// --------------- Production Database Guard Middleware ---------------
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (process.env.NODE_ENV === 'production' && mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database service unavailable. API operations suspended in production mode.'
    });
  }
  next();
});

// --------------- Health Endpoint ---------------
app.get('/api/health', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (isConnected) {
    return res.status(200).json({
      success: true,
      status: 'ok',
      database: 'connected',
      storage: 'mongodb'
    });
  }
  return res.status(503).json({
    success: false,
    status: 'degraded',
    database: 'disconnected'
  });
});

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

// --------------- Start Server & Graceful Shutdown ---------------
let server;

async function startServer() {
  const connected = await connectDB();
  if (connected) {
    await migrateJsonToMongo();
  }

  server = app.listen(PORT, () => {
    console.log(`  🚀 ExpenseIQ server running at http://localhost:${PORT}\n`);
  });
}

function handleShutdown(signal) {
  console.log(`\n  🛑 ${signal} received. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('  🔒 HTTP server closed.');
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        console.log('  🍃 MongoDB connection closed.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer();
