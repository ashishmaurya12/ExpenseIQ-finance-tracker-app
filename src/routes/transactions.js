const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateTransaction } = require('../middlewares/validator');
const transactionController = require('../controllers/transactionController');

// All routes require authentication
router.use(auth);

// GET /api/transactions/meta/summary  (must be before /:id routes)
router.get('/meta/summary', transactionController.getSummary);

// DELETE /api/transactions/meta/clear-all (must be before /:id routes)
router.delete('/meta/clear-all', transactionController.removeAll);

// GET /api/transactions
router.get('/', transactionController.getAll);

// POST /api/transactions
router.post('/', validateTransaction, transactionController.create);

// PUT /api/transactions/:id
router.put('/:id', validateTransaction, transactionController.update);

// DELETE /api/transactions/:id
router.delete('/:id', transactionController.remove);

module.exports = router;
