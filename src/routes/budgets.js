const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateBudget } = require('../middlewares/validator');
const budgetController = require('../controllers/budgetController');

// All routes require authentication
router.use(auth);

// GET /api/budgets
router.get('/', budgetController.getAll);

// POST /api/budgets
router.post('/', validateBudget, budgetController.create);

// PUT /api/budgets/:id
router.put('/:id', validateBudget, budgetController.update);

// DELETE /api/budgets/:id
router.delete('/:id', budgetController.remove);

module.exports = router;
