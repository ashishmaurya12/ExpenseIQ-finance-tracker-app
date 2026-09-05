const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const anomalyController = require('../controllers/anomalyController');

router.use(authMiddleware);

router.get('/', anomalyController.getAnomalies);
router.post('/analyze', anomalyController.analyzeAnomalies);

module.exports = router;
