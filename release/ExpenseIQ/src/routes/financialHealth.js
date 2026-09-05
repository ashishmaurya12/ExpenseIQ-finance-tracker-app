const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const financialHealthController = require('../controllers/financialHealthController');

router.use(authMiddleware);

router.get('/', financialHealthController.getFinancialHealth);
router.get('/recommendations', financialHealthController.getRecommendations);

module.exports = router;
