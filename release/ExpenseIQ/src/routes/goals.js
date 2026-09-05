const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateIdParam } = require('../middlewares/validator');
const goalController = require('../controllers/goalController');

// All routes require authentication
router.use(auth);

// GET /api/goals
router.get('/', goalController.getAll);

// POST /api/goals
router.post('/', goalController.create);

// PUT /api/goals/:id
router.put('/:id', validateIdParam, goalController.update);

// POST /api/goals/:id/fund
router.post('/:id/fund', validateIdParam, goalController.addFunds);

// DELETE /api/goals/:id
router.delete('/:id', validateIdParam, goalController.remove);

module.exports = router;
