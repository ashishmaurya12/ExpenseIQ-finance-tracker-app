const Goal = require('../models/Goal');

/**
 * GET /api/goals
 */
async function getAll(req, res, next) {
  try {
    const goals = await Goal.getWithProgress(req.user.id);
    res.json({ success: true, count: goals.length, goals });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/goals
 */
async function create(req, res, next) {
  try {
    const { name, targetAmount, savedAmount, deadline, icon } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Goal name must be at least 2 characters.' });
    }
    if (!targetAmount || Number(targetAmount) <= 0) {
      return res.status(400).json({ success: false, message: 'Target amount must be a positive number.' });
    }

    const goal = await Goal.create({
      userId: req.user.id,
      name, targetAmount, savedAmount, deadline, icon
    });

    res.status(201).json({ success: true, message: 'Goal created!', goal });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/goals/:id
 */
async function update(req, res, next) {
  try {
    const goal = await Goal.update(req.params.id, req.user.id, req.body);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }
    res.json({ success: true, message: 'Goal updated!', goal });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/goals/:id/fund
 */
async function addFunds(req, res, next) {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number.' });
    }
    const goal = await Goal.addFunds(req.params.id, req.user.id, Number(amount));
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }
    res.json({ success: true, message: `₹${Number(amount).toLocaleString()} added to goal!`, goal });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/goals/:id
 */
async function remove(req, res, next) {
  try {
    const deleted = await Goal.remove(req.params.id, req.user.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Goal not found.' });
    }
    res.json({ success: true, message: 'Goal deleted.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, addFunds, remove };
