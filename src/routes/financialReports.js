const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth');
const financialReportController = require('../controllers/financialReportController');

router.use(authMiddleware);

router.get('/monthly', financialReportController.generateMonthlyReport);
router.post('/monthly', financialReportController.generateMonthlyReport);

module.exports = router;
