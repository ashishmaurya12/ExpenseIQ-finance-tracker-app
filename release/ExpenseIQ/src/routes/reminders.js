const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const { validateReminder, validateIdParam } = require('../middlewares/validator');
const reminderController = require('../controllers/reminderController');

// All routes require JWT authentication
router.use(auth);

// GET /api/reminders - List reminders
router.get('/', reminderController.getReminders);

// POST /api/reminders - Create reminder
router.post('/', validateReminder, reminderController.createReminder);

// GET /api/reminders/:id - Get single reminder
router.get('/:id', validateIdParam, reminderController.getReminderById);

// PUT /api/reminders/:id - Update reminder
router.put('/:id', validateIdParam, validateReminder, reminderController.updateReminder);

// DELETE /api/reminders/:id - Delete reminder
router.delete('/:id', validateIdParam, reminderController.deleteReminder);

// POST /api/reminders/:id/complete - Mark reminder as completed
router.post('/:id/complete', validateIdParam, reminderController.completeReminder);

module.exports = router;
