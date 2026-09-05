const RecurringTransaction = require('../models/RecurringTransaction');
const { calculateNextDueDate, processDueRecurringTransactions } = require('../services/recurringTransactionService');

/**
 * GET /api/recurring
 * List recurring transactions for authenticated user.
 */
async function getRecurringTransactions(req, res, next) {
  try {
    const userId = req.user.id;
    const { active, page, limit } = req.query;

    const result = await RecurringTransaction.findByUserId(userId, { active, page, limit });
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/recurring/:id
 * Get single recurring transaction by ID.
 */
async function getRecurringTransactionById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const item = await RecurringTransaction.findById(id, userId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Recurring transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      recurring: item
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/recurring
 * Create a new recurring transaction.
 */
async function createRecurringTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      type, amount, category, description, frequency,
      startDate, nextDueDate, endDate, active, autoCreate, notes
    } = req.body;

    // Calculate initial nextDueDate if not explicitly provided
    const initialNextDueDate = nextDueDate || startDate;

    const newRecurring = await RecurringTransaction.create({
      userId,
      type,
      amount,
      category,
      description,
      frequency,
      startDate,
      nextDueDate: initialNextDueDate,
      endDate,
      active,
      autoCreate,
      notes
    });

    return res.status(201).json({
      success: true,
      message: 'Recurring transaction created successfully',
      recurring: newRecurring
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/recurring/:id
 * Update an existing recurring transaction.
 */
async function updateRecurringTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await RecurringTransaction.findById(id, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Recurring transaction not found'
      });
    }

    const updated = await RecurringTransaction.update(id, userId, req.body);
    return res.status(200).json({
      success: true,
      message: 'Recurring transaction updated successfully',
      recurring: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/recurring/:id
 * Delete a recurring transaction by ID.
 */
async function deleteRecurringTransaction(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await RecurringTransaction.delete(id, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Recurring transaction not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recurring transaction deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/recurring/process
 * Trigger processing of due auto-create recurring transactions for user.
 */
async function processDueTransactions(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await processDueRecurringTransactions(userId);

    return res.status(200).json({
      success: true,
      message: `Processed ${result.processedCount} due recurring transactions`,
      processedCount: result.processedCount,
      transactions: result.createdTransactions
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRecurringTransactions,
  getRecurringTransactionById,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  processDueTransactions
};
