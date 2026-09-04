const Transaction = require('../models/Transaction');
const RecurringTransaction = require('../models/RecurringTransaction');
const { getMonthFromDate } = require('../utils/helpers');

/**
 * Generate a deterministic cash-flow forecast for 1 to 12 months ahead.
 * @param {string} userId
 * @param {number} horizonMonths - 1 to 12
 */
async function getForecast(userId, horizonMonths = 3) {
  const months = Math.max(1, Math.min(12, parseInt(horizonMonths, 10) || 3));
  const transactions = await Transaction.findByUserId(userId);
  const recurringRes = await RecurringTransaction.findByUserId(userId, { active: true });
  const activeRecurring = recurringRes.recurring || [];

  // Group historical data by month
  const monthlyData = {};
  const monthSet = new Set();
  transactions.forEach(t => {
    const m = getMonthFromDate(t.date);
    if (m) {
      monthSet.add(m);
      if (!monthlyMap(monthlyData, m)) {
        monthlyData[m] = { income: 0, expense: 0 };
      }
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') monthlyData[m].income += amt;
      else if (t.type === 'expense') monthlyData[m].expense += amt;
    }
  });

  function monthlyMap(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  const historicalMonths = Array.from(monthSet).sort();
  const historyCount = historicalMonths.length;

  let confidence = 'high';
  let confidenceReason = 'Forecast based on robust 6+ months of historical data.';
  if (historyCount < 3) {
    confidence = 'low';
    confidenceReason = 'Forecast confidence is low due to less than 3 months of historical transactions.';
  } else if (historyCount < 6) {
    confidence = 'medium';
    confidenceReason = 'Forecast confidence is medium based on 3-5 months of transaction history.';
  }

  // Calculate weighted moving averages (weights: most recent month gets highest weight)
  let weightedIncomeSum = 0;
  let weightedExpenseSum = 0;
  let totalWeight = 0;

  const recentMonths = historicalMonths.slice(-6);
  recentMonths.forEach((m, idx) => {
    const weight = idx + 1;
    weightedIncomeSum += monthlyData[m].income * weight;
    weightedExpenseSum += monthlyData[m].expense * weight;
    totalWeight += weight;
  });

  const baseMonthlyIncome = totalWeight > 0 ? weightedIncomeSum / totalWeight : 0;
  const baseMonthlyExpense = totalWeight > 0 ? weightedExpenseSum / totalWeight : 0;

  // Build projected months
  const today = new Date();
  const forecast = [];

  for (let i = 1; i <= months; i++) {
    const projDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthStr = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;

    // Sum active recurring transactions due in this projected month
    let recurringIncome = 0;
    let recurringExpense = 0;

    activeRecurring.forEach(rec => {
      const amt = Number(rec.amount) || 0;
      if (rec.type === 'income') recurringIncome += amt;
      else if (rec.type === 'expense') recurringExpense += amt;
    });

    const expectedIncome = Math.round((baseMonthlyIncome + (recurringIncome * 0.3)) * 100) / 100;
    const expectedExpenses = Math.round((baseMonthlyExpense + (recurringExpense * 0.3)) * 100) / 100;
    const expectedNet = Math.round((expectedIncome - expectedExpenses) * 100) / 100;

    const margin = Math.abs(expectedNet) * 0.15;
    const lowerBound = Math.round((expectedNet - margin) * 100) / 100;
    const upperBound = Math.round((expectedNet + margin) * 100) / 100;

    forecast.push({
      month: monthStr,
      expectedIncome,
      expectedExpenses,
      expectedNet,
      lowerBound,
      upperBound,
      confidence,
      disclaimer: 'Projections based on historical activity and active recurring schedules.'
    });
  }

  return {
    horizonMonths: months,
    historicalMonthsCount: historyCount,
    confidence,
    confidenceReason,
    forecast
  };
}

/**
 * Evaluate cash-flow risk levels and structured risk factors.
 */
async function getRisk(userId) {
  const forecastRes = await getForecast(userId, 3);
  const forecast = forecastRes.forecast;
  const recurringRes = await RecurringTransaction.findByUserId(userId, { active: true });
  const activeRecurring = recurringRes.recurring || [];

  const reasons = [];
  let riskLevel = 'low';

  // Risk Check 1: Negative net cash flow projected
  const negativeMonths = forecast.filter(f => f.expectedNet < 0);
  if (negativeMonths.length > 0) {
    riskLevel = negativeMonths.length >= 2 ? 'high' : 'medium';
    reasons.push({
      title: 'Projected Cash Flow Deficit',
      message: `Negative net cash flow projected in ${negativeMonths.length} of the next 3 months (e.g. ${negativeMonths[0].month}: ₹${negativeMonths[0].expectedNet}).`,
      severity: negativeMonths.length >= 2 ? 'high' : 'medium'
    });
  }

  // Risk Check 2: Large recurring obligations
  const avgIncome = forecast[0] ? forecast[0].expectedIncome : 0;
  const largeRecurring = activeRecurring.filter(r => r.type === 'expense' && r.amount >= (avgIncome * 0.4) && avgIncome > 0);
  if (largeRecurring.length > 0) {
    if (riskLevel !== 'high') riskLevel = 'medium';
    reasons.push({
      title: 'High Recurring Obligation Ratio',
      message: `${largeRecurring.length} recurring expense(s) consume over 40% of estimated monthly income (e.g. ${largeRecurring[0].category}: ₹${largeRecurring[0].amount}).`,
      severity: 'medium'
    });
  }

  // Risk Check 3: Low or declining savings trend
  const totalProjectedNet = forecast.reduce((acc, f) => acc + f.expectedNet, 0);
  if (totalProjectedNet <= 0 && reasons.length === 0) {
    riskLevel = 'medium';
    reasons.push({
      title: 'Minimal Projected Surplus',
      message: 'Estimated 3-month net savings surplus is near zero or negative.',
      severity: 'medium'
    });
  }

  if (reasons.length === 0) {
    reasons.push({
      title: 'Healthy Cash Flow Outlook',
      message: 'Positive net cash flow projected with balanced recurring obligations.',
      severity: 'low'
    });
  }

  return {
    riskLevel,
    reasonsCount: reasons.length,
    reasons
  };
}

module.exports = {
  getForecast,
  getRisk
};
