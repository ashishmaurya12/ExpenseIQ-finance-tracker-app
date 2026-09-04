const RecurringTransaction = require('../models/RecurringTransaction');
const Transaction = require('../models/Transaction');

/**
 * Calculate the next due date based on frequency with safe month-end handling.
 * @param {string} currentDateStr - YYYY-MM-DD
 * @param {string} frequency - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
 * @returns {string} YYYY-MM-DD
 */
function calculateNextDueDate(currentDateStr, frequency) {
  if (!currentDateStr || typeof currentDateStr !== 'string') {
    return new Date().toISOString().slice(0, 10);
  }

  const [yearStr, monthStr, dayStr] = currentDateStr.split('-').map(Number);
  const year = yearStr || new Date().getFullYear();
  const month = (monthStr ? monthStr - 1 : 0);
  const day = dayStr || 1;

  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;

  switch (frequency) {
    case 'daily': {
      const d = new Date(Date.UTC(year, month, day + 1));
      return d.toISOString().slice(0, 10);
    }
    case 'weekly': {
      const d = new Date(Date.UTC(year, month, day + 7));
      return d.toISOString().slice(0, 10);
    }
    case 'monthly': {
      targetMonth += 1;
      if (targetMonth > 11) {
        targetYear += Math.floor(targetMonth / 12);
        targetMonth = targetMonth % 12;
      }
      break;
    }
    case 'quarterly': {
      targetMonth += 3;
      if (targetMonth > 11) {
        targetYear += Math.floor(targetMonth / 12);
        targetMonth = targetMonth % 12;
      }
      break;
    }
    case 'yearly': {
      targetYear += 1;
      break;
    }
    default:
      return currentDateStr;
  }

  // Safe Month-End handling (e.g., Jan 31 + 1 month -> Feb 28/29)
  const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const safeDay = Math.min(targetDay, maxDaysInTargetMonth);

  const result = new Date(Date.UTC(targetYear, targetMonth, safeDay));
  return result.toISOString().slice(0, 10);
}

/**
 * Process due recurring transactions for a user or system-wide (idempotent autoCreate processing).
 * @param {string|null} userId - optional filter
 * @returns {Promise<{ processedCount: number, createdTransactions: Array }>}
 */
async function processDueRecurringTransactions(userId = null) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dueItems = await RecurringTransaction.findActiveDue(todayStr, userId);

  let processedCount = 0;
  const createdTransactions = [];

  for (const item of dueItems) {
    // Only auto-create if enabled and due date is reached
    if (!item.autoCreate || item.nextDueDate > todayStr) {
      continue;
    }

    const currentDueDate = item.nextDueDate;
    const calculatedNextDueDate = calculateNextDueDate(currentDueDate, item.frequency);
    const shouldDeactivate = Boolean(item.endDate && calculatedNextDueDate > item.endDate);

    // Atomically claim occurrence to prevent duplicate creation during concurrent execution
    const claimed = await RecurringTransaction.claimDueOccurrence(
      item.id,
      item.userId,
      currentDueDate,
      calculatedNextDueDate,
      shouldDeactivate
    );

    if (!claimed) {
      continue; // Skip if already claimed by concurrent execution
    }

    try {
      const note = item.description ? `[Auto-recurring] ${item.description}` : `[Auto-recurring] ${item.category}`;

      // Create the actual financial transaction
      const newTxn = await Transaction.create({
        userId: item.userId,
        type: item.type,
        amount: item.amount,
        category: item.category,
        date: currentDueDate,
        note
      });

      createdTransactions.push(newTxn);
      processedCount++;
    } catch (err) {
      console.error(`Error creating transaction for recurring item ${item.id}:`, err.message);
      // Recovery: Revert claimed schedule state so occurrence remains recoverable on retry
      await RecurringTransaction.update(item.id, item.userId, {
        lastProcessedDate: item.lastProcessedDate || null,
        nextDueDate: currentDueDate,
        active: true
      });
    }
  }

  return {
    processedCount,
    createdTransactions
  };
}

module.exports = {
  calculateNextDueDate,
  processDueRecurringTransactions
};
