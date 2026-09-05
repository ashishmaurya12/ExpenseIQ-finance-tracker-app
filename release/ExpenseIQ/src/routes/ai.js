const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { aiRateLimiter } = require('../middlewares/rateLimiter');
const aiController = require('../controllers/aiController');

// All AI routes require authentication
router.use(auth);

// Apply dedicated AI rate limiting
router.use(aiRateLimiter);

// POST /api/ai/chat
router.post('/chat', aiController.chat);

// GET /api/ai/insights
router.get('/insights', aiController.getPersonalizedInsights);

module.exports = router;
