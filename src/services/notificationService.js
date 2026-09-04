const Notification = require('../models/Notification');
const Reminder = require('../models/Reminder');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');

/**
 * Generate deduplicated notifications for due/overdue reminders.
 */
async function generateReminderNotifications(userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const remindersResult = await Reminder.findByUserId(userId, { status: 'all', page: 1, limit: 50 });
  const reminders = remindersResult.reminders || [];

  let count = 0;

  for (const r of reminders) {
    if (r.status === 'completed' || r.status === 'dismissed') continue;

    if (r.dueDate === todayStr) {
      const dedupKey = `reminder_today_${r.id}_${todayStr}`;
      const created = await Notification.create({
        userId,
        type: 'reminder',
        title: 'Bill Due Today',
        message: `${r.title} (₹${r.amount}) is due today.`,
        priority: 'high',
        dedupKey,
        relatedEntityId: r.id
      });
      if (created) count++;
    } else if (r.dueDate === tomorrowStr) {
      const dedupKey = `reminder_tomorrow_${r.id}_${todayStr}`;
      const created = await Notification.create({
        userId,
        type: 'reminder',
        title: 'Bill Due Tomorrow',
        message: `${r.title} (₹${r.amount}) is due tomorrow.`,
        priority: 'medium',
        dedupKey,
        relatedEntityId: r.id
      });
      if (created) count++;
    } else if (r.dueDate < todayStr && (r.status === 'pending' || r.status === 'overdue')) {
      const dedupKey = `reminder_overdue_${r.id}_${todayStr}`;
      const created = await Notification.create({
        userId,
        type: 'reminder',
        title: 'Overdue Bill Alert',
        message: `${r.title} (₹${r.amount}) was due on ${r.dueDate}.`,
        priority: 'high',
        dedupKey,
        relatedEntityId: r.id
      });
      if (created) count++;
    }
  }

  return count;
}

/**
 * Generate deduplicated notifications for budget thresholds (70%, 90%, 100%).
 */
async function generateBudgetAlertNotifications(userId) {
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const budgets = await Budget.getWithSpending(userId, currentMonthStr);

  let count = 0;

  for (const b of budgets) {
    const limit = Number(b.monthlyLimit) || 0;
    const spent = Number(b.spent) || 0;
    if (limit <= 0) continue;

    const pct = (spent / limit) * 100;

    if (pct >= 70) {
      const dedupKey = `budget_70_${b.id}_${currentMonthStr}`;
      const created = await Notification.create({
        userId,
        type: 'budget',
        title: '70% Budget Alert',
        message: `You have reached the 70% threshold for your ${b.category} budget (${Math.round(pct)}% used).`,
        priority: 'medium',
        dedupKey,
        relatedEntityId: b.id
      });
      if (created) count++;
    }

    if (pct >= 90) {
      const dedupKey = `budget_90_${b.id}_${currentMonthStr}`;
      const created = await Notification.create({
        userId,
        type: 'budget',
        title: '90% Budget Warning',
        message: `You have reached the 90% threshold for your ${b.category} budget (${Math.round(pct)}% used).`,
        priority: 'high',
        dedupKey,
        relatedEntityId: b.id
      });
      if (created) count++;
    }

    if (pct >= 100) {
      const dedupKey = `budget_100_${b.id}_${currentMonthStr}`;
      const created = await Notification.create({
        userId,
        type: 'budget',
        title: 'Budget Exceeded',
        message: `You have exceeded your ${b.category} budget (₹${spent} spent of ₹${limit} limit).`,
        priority: 'high',
        dedupKey,
        relatedEntityId: b.id
      });
      if (created) count++;
    }
  }

  return count;
}

/**
 * Generate deduplicated notifications for savings goal milestones and deadlines.
 */
async function generateGoalAlertNotifications(userId) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const goals = await Goal.findByUserId(userId);

  let count = 0;

  for (const g of goals) {
    const target = Number(g.targetAmount) || 0;
    const saved = Number(g.savedAmount) || 0;
    if (target <= 0) continue;

    const pct = (saved / target) * 100;

    if (pct >= 100) {
      const dedupKey = `goal_completed_${g.id}`;
      const created = await Notification.create({
        userId,
        type: 'goal',
        title: 'Goal Achieved! 🎉',
        message: `Congratulations! You have reached 100% of your savings goal: ${g.name}.`,
        priority: 'high',
        dedupKey,
        relatedEntityId: g.id
      });
      if (created) count++;
    } else if (pct >= 75) {
      const dedupKey = `goal_milestone_75_${g.id}`;
      const created = await Notification.create({
        userId,
        type: 'goal',
        title: 'Goal Milestone: 75%',
        message: `You are 75% of the way to achieving your ${g.name} goal!`,
        priority: 'medium',
        dedupKey,
        relatedEntityId: g.id
      });
      if (created) count++;
    }

    // Deadline approaching check (within 7 days)
    if (g.deadline && g.deadline >= todayStr && pct < 100) {
      const diffDays = Math.ceil((new Date(g.deadline) - new Date(todayStr)) / (1000 * 60 * 60 * 24));
      if (diffDays <= 7 && diffDays >= 0) {
        const dedupKey = `goal_deadline_${g.id}_${todayStr}`;
        const created = await Notification.create({
          userId,
          type: 'goal',
          title: 'Goal Deadline Approaching',
          message: `Goal ${g.name} deadline is in ${diffDays} day(s). Saved ₹${saved} of ₹${target}.`,
          priority: 'medium',
          dedupKey,
          relatedEntityId: g.id
        });
        if (created) count++;
      }
    }
  }

  return count;
}

/**
 * Trigger all automatic notification generators for a user.
 */
async function syncUserNotifications(userId) {
  const [remindersCount, budgetCount, goalCount] = await Promise.all([
    generateReminderNotifications(userId),
    generateBudgetAlertNotifications(userId),
    generateGoalAlertNotifications(userId)
  ]);

  return {
    remindersCount,
    budgetCount,
    goalCount,
    totalNew: remindersCount + budgetCount + goalCount
  };
}

module.exports = {
  generateReminderNotifications,
  generateBudgetAlertNotifications,
  generateBudgetNotifications: generateBudgetAlertNotifications,
  generateGoalAlertNotifications,
  generateGoalNotifications: generateGoalAlertNotifications,
  syncUserNotifications
};
