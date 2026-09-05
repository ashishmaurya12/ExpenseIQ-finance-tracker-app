const analyticsService = require('./analyticsService');
const cashFlowService = require('./cashFlowService');
const anomalyService = require('./anomalyService');
const financialHealthService = require('./financialHealthService');

/**
 * Generate an AI-powered monthly financial report with 10 structured sections.
 * @param {string} userId
 * @param {string} monthStr - YYYY-MM
 */
async function generateMonthlyReport(userId, monthStr) {
  const targetMonth = (monthStr && typeof monthStr === 'string' && monthStr.match(/^\d{4}-\d{2}$/))
    ? monthStr
    : new Date().toISOString().slice(0, 7);

  const [yearStr, mStr] = targetMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const fromDate = `${targetMonth}-01`;
  const toDate = `${targetMonth}-${String(daysInMonth).padStart(2, '0')}`;

  const [overview, categories, health, forecastRes, anomalies] = await Promise.all([
    analyticsService.getOverview(userId, fromDate, toDate),
    analyticsService.getCategories(userId, fromDate, toDate),
    financialHealthService.calculateHealthScore(userId),
    cashFlowService.getForecast(userId, 3),
    anomalyService.detectAnomalies(userId)
  ]);

  const monthAnomalies = anomalies.filter(a => a.date && a.date.startsWith(targetMonth));

  const sections = [
    {
      title: 'Executive Summary',
      content: `Total Income: ₹${overview.totalIncome.toLocaleString()} | Total Expenses: ₹${overview.totalExpenses.toLocaleString()} | Net Cash Flow: ₹${overview.netCashFlow.toLocaleString()} | Savings Rate: ${overview.savingsRate}%. Overall Financial Health Rating is Grade ${health.grade} (${health.overallScore}/100).`
    },
    {
      title: 'Income Analysis',
      content: `Recorded ${overview.incomeCount} income transaction(s) totaling ₹${overview.totalIncome.toLocaleString()} for ${targetMonth}. Average monthly income is ₹${overview.averageMonthlyIncome.toLocaleString()}.`
    },
    {
      title: 'Expense Breakdown',
      content: `Recorded ${overview.expenseCount} expense transaction(s) totaling ₹${overview.totalExpenses.toLocaleString()} across ${categories.categories.length} categories. Top spending category is ${overview.largestExpenseCategory.category} (₹${overview.largestExpenseCategory.amount.toLocaleString()}).`
    },
    {
      title: 'Budget vs Actual Performance',
      content: health.components.budgetAdherenceScore.explanation || 'Budgets are actively monitored against monthly limits.'
    },
    {
      title: 'Goal Tracking',
      content: health.components.goalProgressScore.explanation || 'Savings goals are tracked towards targets.'
    },
    {
      title: 'Savings & Cash Flow',
      content: `Net monthly cash flow surplus of ₹${overview.netCashFlow.toLocaleString()} with a savings rate of ${overview.savingsRate}%.`
    },
    {
      title: 'Cash-Flow Risk',
      content: forecastRes.confidenceReason || 'Model indicates stable cash flow projections.'
    },
    {
      title: 'Anomaly Detection',
      content: monthAnomalies.length > 0
        ? `Flagged ${monthAnomalies.length} statistical spending anomaly(ies) in ${targetMonth}.`
        : 'No statistical spending anomalies detected in this period.'
    },
    {
      title: 'Financial Health Score 2.0 Breakdown',
      content: `Overall Score: ${health.overallScore}/100 (Grade ${health.grade}). Key Strengths: ${health.strengths.join('; ') || 'Balanced management'}.`
    },
    {
      title: 'Actionable AI Recommendations',
      content: health.recommendations.map(r => `• ${r.title}: ${r.reason}`).join('\n') || 'Maintain current financial discipline.'
    }
  ];

  const reportText = sections.map((sec, idx) => `### ${idx + 1}. ${sec.title}\n${sec.content}`).join('\n\n');

  return {
    title: `Financial Executive Report (${targetMonth})`,
    month: targetMonth,
    generatedAt: new Date().toISOString(),
    sections,
    sectionsCount: sections.length,
    reportText
  };
}

module.exports = {
  generateMonthlyReport
};
