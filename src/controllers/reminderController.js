const Reminder = require('../models/Reminder');
const reminderService = require('../services/reminderService');

/**
 * GET /api/reminders
 * List reminders for authenticated user with status filtering and pagination.
 */
async function getReminders(req, res, next) {
  try {
    const userId = req.user.id;
    const { status, page, limit } = req.query;

    // Automatically calculate overdue reminders before listing
    await reminderService.markOverdueReminders(userId);
    await reminderService.syncRemindersFromRecurring(userId);

    const result = await Reminder.findByUserId(userId, { status, page, limit });
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/reminders/:id
 * Get single reminder by ID.
 */
async function getReminderById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const item = await Reminder.findById(id, userId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    return res.status(200).json({
      success: true,
      reminder: item
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reminders
 * Create a new bill/payment reminder.
 */
async function createReminder(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      title, amount, dueDate, category, recurringTransactionId,
      status, priority, reminderDaysBefore, notes
    } = req.body;

    const newReminder = await Reminder.create({
      userId,
      title,
      amount,
      dueDate,
      category,
      recurringTransactionId,
      status,
      priority,
      reminderDaysBefore,
      notes
    });

    return res.status(201).json({
      success: true,
      message: 'Reminder created successfully',
      reminder: newReminder
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/reminders/:id
 * Update an existing reminder.
 */
async function updateReminder(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const existing = await Reminder.findById(id, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    const updated = await Reminder.update(id, userId, req.body);
    return res.status(200).json({
      success: true,
      message: 'Reminder updated successfully',
      reminder: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/reminders/:id
 * Delete a reminder by ID.
 */
async function deleteReminder(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Reminder.delete(id, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reminder deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/reminders/:id/complete
 * Mark a reminder as completed.
 */
async function completeReminder(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const completed = await reminderService.completeReminder(id, userId);
    if (!completed) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reminder marked as completed',
      reminder: completed
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getReminders,
  getReminderById,
  createReminder,
  updateReminder,
  deleteReminder,
  completeReminder
};
