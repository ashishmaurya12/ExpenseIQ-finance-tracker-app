const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateNotification, validateIdParam } = require('../middlewares/validator');
const notificationController = require('../controllers/notificationController');

// All routes require JWT authentication
router.use(auth);

// GET /api/notifications - List notifications
router.get('/', notificationController.getNotifications);

// POST /api/notifications/read-all - Mark all notifications as read
router.post('/read-all', notificationController.markAllNotificationsAsRead);

// PUT /api/notifications/:id/read - Mark single notification as read
router.put('/:id/read', validateIdParam, notificationController.markNotificationAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', validateIdParam, notificationController.deleteNotification);

module.exports = router;
