const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { PORT } = require('./src/config/config');
const { connectDB } = require('./src/config/db');
const { migrateJsonToMongo } = require('./src/utils/migrateJsonToMongo');
const errorHandler = require('./src/middlewares/errorHandler');

const app = express();

// --------------- Middleware ---------------
app.use(helmet({
  contentSecurityPolicy: false,   // Allow inline scripts for Chart.js / CDN
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --------------- Static Files ---------------
app.use(express.static(path.join(__dirname, 'public')));

// --------------- API Routes ---------------
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/transactions', require('./src/routes/transactions'));
app.use('/api/budgets', require('./src/routes/budgets'));
app.use('/api/goals', require('./src/routes/goals'));
app.use('/api/insights', require('./src/routes/insights'));

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
