const Transaction = require('../models/Transaction');

/**
 * GET /api/transactions
 */
async function getAll(req, res, next) {
  try {
    const { type, category, month, from, to } = req.query;
    const transactions = await Transaction.findByUserId(req.user.id, { type, category, month, from, to });

    res.json({
      success: true,
      count: transactions.length,
      transactions
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/transactions
 */
async function create(req, res, next) {
  try {
    const { type, amount, category, date, note } = req.body;

    const transaction = await Transaction.create({
      userId: req.user.id,
      type,
      amount,
      category,
      date,
      note
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully.',
      transaction
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/transactions/:id
 */
async function update(req, res, next) {
  try {
    const transaction = await Transaction.update(req.params.id, req.user.id, req.body);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    res.json({
      success: true,
      message: 'Transaction updated successfully.',
      transaction
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/transactions/:id
 */
async function remove(req, res, next) {
  try {
    const deleted = await Transaction.remove(req.params.id, req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found.'
      });
    }

    res.json({
      success: true,
      message: 'Transaction deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/transactions/meta/clear-all
 */
async function removeAll(req, res, next) {
  try {
    const count = await Transaction.removeAllByUserId(req.user.id);
    res.json({
      success: true,
      message: `Successfully cleared all ${count} transaction records.`,
      count
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/transactions/meta/summary
 */
async function getSummary(req, res, next) {
  try {
    const month = req.query.month || null;
    const summary = await Transaction.getSummary(req.user.id, month);
    res.json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, create, update, remove, removeAll, getSummary };
