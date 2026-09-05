const Budget = require('../models/Budget');

/**
 * GET /api/budgets
 */
async function getAll(req, res, next) {
  try {
    const month = req.query.month || null;
    const budgets = await Budget.getWithSpending(req.user.id, month);
    const totalBudget = budgets.reduce((sum, b) => sum + (Number(b.monthlyLimit) || 0), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (Number(b.spent) || 0), 0);
    const totalRemaining = Math.max(0, totalBudget - totalSpent);

    res.json({
      success: true,
      count: budgets.length,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      budgets
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/budgets
 */
async function create(req, res, next) {
  try {
    const { category, monthlyLimit, month } = req.body;
    const targetMonth = month ? month.trim() : null;

    const existing = await Budget.findByCategory(req.user.id, category, targetMonth);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A budget already exists for this category and month.'
      });
    }

    const budget = await Budget.create({
      userId: req.user.id,
      category,
      monthlyLimit,
      month: targetMonth
    });

    res.status(201).json({
      success: true,
      message: 'Budget created successfully.',
      budget
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A budget already exists for this category and month.'
      });
    }
    next(err);
  }
}

/**
 * PUT /api/budgets/:id
 */
async function update(req, res, next) {
  try {
    const current = await Budget.findById(req.params.id, req.user.id);
    if (!current) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found.'
      });
    }

    const { category, month } = req.body;
    if (category || month !== undefined) {
      const newCat = category || current.category;
      const newMonth = month !== undefined ? (month ? month.trim() : null) : current.month;
      
      const existing = await Budget.findByCategory(req.user.id, newCat, newMonth);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({
          success: false,
          message: 'A budget already exists for this category and month.'
        });
      }
    }

    const budget = await Budget.update(req.params.id, req.user.id, req.body);

    res.json({
      success: true,
      message: 'Budget updated successfully.',
      budget
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A budget already exists for this category and month.'
      });
    }
    next(err);
  }
}

/**
 * DELETE /api/budgets/:id
 */
async function remove(req, res, next) {
  try {
    const deleted = await Budget.remove(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found.'
      });
    }

    res.json({
      success: true,
      message: 'Budget deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, remove };
