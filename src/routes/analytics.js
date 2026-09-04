const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const analyticsController = require('../controllers/analyticsController');

router.use(authMiddleware);

router.get('/overview', analyticsController.getOverview);
router.get('/trends', analyticsController.getTrends);
router.get('/categories', analyticsController.getCategories);
router.get('/monthly', analyticsController.getMonthly);
router.get('/comparison', analyticsController.getComparison);

module.exports = router;
