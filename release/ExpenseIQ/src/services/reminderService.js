const Reminder = require('../models/Reminder');
const RecurringTransaction = require('../models/RecurringTransaction');

/**
 * Mark pending reminders as overdue if their dueDate is prior to today.
 * Completed or dismissed reminders are untouched.
 * @param {string|null} userId - optional user filter
 * @returns {Promise<number>} count of updated overdue reminders
 */
async function markOverdueReminders(userId = null) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const result = await Reminder.findByUserId(userId || '', { status: 'pending', page: 1, limit: 50 });
  const pendingItems = result.reminders || [];

  let updatedCount = 0;
  for (const item of pendingItems) {
    if (item.dueDate < todayStr && item.status === 'pending') {
      await Reminder.update(item.id, item.userId, { status: 'overdue' });
      updatedCount++;
    }
  }

  return updatedCount;
}

/**
 * Get upcoming pending & overdue reminders for user within N days ahead.
 */
async function getUpcomingReminders(userId, daysAhead = 7) {
  await markOverdueReminders(userId);

  const todayStr = new Date().toISOString().slice(0, 10);
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + Math.max(1, daysAhead));
  const futureDateStr = futureDate.toISOString().slice(0, 10);

  const allRemindersResult = await Reminder.findByUserId(userId, { status: 'all', page: 1, limit: 50 });
  const reminders = allRemindersResult.reminders || [];

  return reminders.filter(r =>
    (r.status === 'pending' || r.status === 'overdue') &&
    r.dueDate <= futureDateStr
  );
}

/**
 * Get overdue reminders for user.
 */
async function getOverdueReminders(userId) {
  await markOverdueReminders(userId);
  const result = await Reminder.findByUserId(userId, { status: 'overdue', page: 1, limit: 50 });
  return result.reminders || [];
}

/**
 * Complete a reminder by ID.
 */
async function completeReminder(id, userId) {
  const existing = await Reminder.findById(id, userId);
  if (!existing) return null;

  return await Reminder.update(id, userId, {
    status: 'completed',
    completedAt: new Date().toISOString()
  });
}

/**
 * Automatically sync upcoming bill reminders from active recurring transactions.
 */
async function syncRemindersFromRecurring(userId) {
  const recurringResult = await RecurringTransaction.findByUserId(userId, { active: true, page: 1, limit: 50 });
  const activeRecurring = recurringResult.recurring || [];

  const existingRemindersResult = await Reminder.findByUserId(userId, { status: 'all', page: 1, limit: 50 });
  const existingReminders = existingRemindersResult.reminders || [];

  let syncedCount = 0;

  for (const item of activeRecurring) {
    if (!item.nextDueDate) continue;

    // Check if a reminder already exists for this recurring transaction and nextDueDate
    const exists = existingReminders.some(r =>
      r.recurringTransactionId === item.id &&
      r.dueDate === item.nextDueDate
    );

    if (!exists) {
      await Reminder.create({
        userId,
        title: item.description ? `${item.category} (${item.description})` : `${item.category} Payment`,
        amount: item.amount,
        dueDate: item.nextDueDate,
        category: item.category,
        recurringTransactionId: item.id,
        status: 'pending',
        priority: item.amount >= 5000 ? 'high' : 'medium',
        reminderDaysBefore: 3,
        notes: `Auto-generated from recurring ${item.frequency} ${item.type}`
      });
      syncedCount++;
    }
  }

  return syncedCount;
}

module.exports = {
  markOverdueReminders,
  getUpcomingReminders,
  getOverdueReminders,
  completeReminder,
  syncRemindersFromRecurring
};
