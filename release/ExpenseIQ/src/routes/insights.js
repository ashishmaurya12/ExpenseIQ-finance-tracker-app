const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const insightController = require('../controllers/insightController');

// Require authentication for all insight endpoints
router.use(auth);

// GET /api/insights
router.get('/', insightController.getInsights);

module.exports = router;
