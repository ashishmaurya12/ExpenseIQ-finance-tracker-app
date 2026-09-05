const Notification = require('../models/Notification');
const notificationService = require('../services/notificationService');

/**
 * GET /api/notifications
 * List notifications for authenticated user with read status filtering and pagination.
 */
async function getNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { read, page, limit } = req.query;

    // Automatically sync/generate due reminder, budget, and goal alerts
    await notificationService.syncUserNotifications(userId);

    const result = await Notification.findByUserId(userId, { read, page, limit });
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read.
 */
async function markNotificationAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const updated = await Notification.markAsRead(id, userId);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification: updated
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/notifications/read-all
 * Mark all notifications for authenticated user as read.
 */
async function markAllNotificationsAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    const updatedCount = await Notification.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      updatedCount
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete a notification by ID.
 */
async function deleteNotification(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Notification.delete(id, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
};
