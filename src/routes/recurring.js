const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateRecurringTransaction, validateIdParam } = require('../middlewares/validator');
const recurringController = require('../controllers/recurringController');

// All routes require JWT authentication
router.use(auth);

// GET /api/recurring - List recurring transactions
router.get('/', recurringController.getRecurringTransactions);

// POST /api/recurring - Create recurring transaction
router.post('/', validateRecurringTransaction, recurringController.createRecurringTransaction);

// POST /api/recurring/process - Trigger auto-processing of due recurring items
router.post('/process', recurringController.processDueTransactions);

// GET /api/recurring/:id - Get single recurring transaction
router.get('/:id', validateIdParam, recurringController.getRecurringTransactionById);

// PUT /api/recurring/:id - Update recurring transaction
router.put('/:id', validateIdParam, validateRecurringTransaction, recurringController.updateRecurringTransaction);

// DELETE /api/recurring/:id - Delete recurring transaction
router.delete('/:id', validateIdParam, recurringController.deleteRecurringTransaction);

module.exports = router;
