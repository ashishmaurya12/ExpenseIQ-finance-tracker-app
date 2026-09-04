const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const cashFlowController = require('../controllers/cashFlowController');

router.use(authMiddleware);

router.get('/forecast', cashFlowController.getForecast);
router.get('/risk', cashFlowController.getRisk);

module.exports = router;
