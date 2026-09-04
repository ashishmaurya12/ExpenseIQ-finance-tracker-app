const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

const MIN_HISTORY_COUNT = 3;
const CATEGORY_DEVIATION_THRESHOLD = 1.5;
const TRANSACTION_Z_SCORE_THRESHOLD = 2.0;

/**
 * Detect unusual spending anomalies deterministically using category statistics.
 * @param {string} userId
 * @returns {Promise<Array>} list of detected anomaly objects
 */
async function detectAnomalies(userId) {
  const transactions = await Transaction.findByUserId(userId, { type: 'expense' });
  if (!transactions || transactions.length < MIN_HISTORY_COUNT) {
    return [];
  }

  // Group transactions by category
  const catMap = {};
  transactions.forEach(t => {
    const cat = (t.category || 'Other').trim();
    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push({ id: t.id, amount: Number(t.amount) || 0, date: t.date, note: t.note || '' });
  });

  const anomalies = [];

  Object.entries(catMap).forEach(([cat, txns]) => {
    if (txns.length < MIN_HISTORY_COUNT) return;

    const amounts = txns.map(t => t.amount);
    const sum = amounts.reduce((a, b) => a + b, 0);
    const mean = sum / txns.length;

    const variance = amounts.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / txns.length;
    const stdDev = Math.sqrt(variance);

    txns.forEach(t => {
      const deviationRatio = mean > 0 ? t.amount / mean : 0;
      const zScore = stdDev > 0 ? (t.amount - mean) / stdDev : 0;

      if (deviationRatio >= CATEGORY_DEVIATION_THRESHOLD || zScore >= TRANSACTION_Z_SCORE_THRESHOLD) {
        let severity = 'HIGH';
        let priority = 'high';
        if (zScore >= 3.0 || deviationRatio >= 2.5) {
          severity = 'CRITICAL';
          priority = 'high';
        } else if (zScore >= 2.0 || deviationRatio >= 1.8) {
          severity = 'HIGH';
          priority = 'high';
        } else {
          severity = 'MEDIUM';
          priority = 'medium';
        }

        const expectedMin = Math.max(0, Math.round((mean - stdDev) * 100) / 100);
        const expectedMax = Math.round((mean + (stdDev * 1.5)) * 100) / 100;

        anomalies.push({
          id: t.id,
          transactionId: t.id,
          category: cat,
          amount: Math.round(t.amount * 100) / 100,
          expectedAvg: Math.round(mean * 100) / 100,
          expectedRange: { min: expectedMin, max: expectedMax, categoryAverage: Math.round(mean * 100) / 100 },
          deviationMultiplier: Math.round(deviationRatio * 100) / 100,
          deviationRatio: Math.round(deviationRatio * 100) / 100,
          zScore: Math.round(zScore * 100) / 100,
          severity,
          priority,
          reason: `Unusual spending of ₹${t.amount} in ${cat} is ${deviationRatio.toFixed(1)}x higher than category average of ₹${Math.round(mean)}.`,
          date: t.date,
          detectedAt: new Date().toISOString()
        });
      }
    });
  });

  anomalies.sort((a, b) => new Date(b.date) - new Date(a.date));
  return anomalies;
}

/**
 * Run anomaly analysis and create deduplicated notifications.
 */
async function analyzeAnomalies(userId) {
  const anomalies = await detectAnomalies(userId);
  let newNotificationsCount = 0;

  for (const anomaly of anomalies) {
    const dedupKey = `anomaly_${anomaly.transactionId}`;
    const created = await Notification.create({
      userId,
      type: 'anomaly',
      title: 'Unusual Spending Detected',
      message: anomaly.reason,
      priority: anomaly.priority,
      relatedEntityId: anomaly.transactionId,
      dedupKey
    });

    if (created) {
      newNotificationsCount++;
    }
  }

  return {
    detectedCount: anomalies.length,
    analyzedCount: anomalies.length,
    newNotificationsCount,
    anomalies
  };
}

module.exports = {
  MIN_HISTORY_COUNT,
  CATEGORY_DEVIATION_THRESHOLD,
  TRANSACTION_Z_SCORE_THRESHOLD,
  detectAnomalies,
  analyzeAnomalies
};
