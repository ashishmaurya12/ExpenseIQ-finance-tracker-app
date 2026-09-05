const { processDueRecurringTransactions } = require('./recurringTransactionService');

let timerRef = null;

/**
 * Start the recurring transaction processor background interval scheduler safely.
 */
function startScheduler() {
  if (timerRef) return; // Prevent duplicate timers

  const isEnabled = process.env.RECURRING_SCHEDULER_ENABLED === 'true';
  if (!isEnabled) {
    return;
  }

  const intervalMs = parseInt(process.env.RECURRING_SCHEDULER_INTERVAL, 10) || 3600000; // default 1 hr

  // Initial immediate run
  processDueRecurringTransactions().catch(err => {
    console.error('Error processing recurring transactions:', err.message);
  });

  // Scheduled interval
  timerRef = setInterval(() => {
    processDueRecurringTransactions().catch(err => {
      console.error('Error processing recurring transactions:', err.message);
    });
  }, intervalMs);

  if (timerRef.unref) {
    timerRef.unref(); // Prevent timer from keeping Node process alive needlessly
  }
}

/**
 * Stop and clear the recurring scheduler timer.
 */
function stopScheduler() {
  if (timerRef) {
    clearInterval(timerRef);
    timerRef = null;
  }
}

module.exports = {
  startScheduler,
  stopScheduler
};
