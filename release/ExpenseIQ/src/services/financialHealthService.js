const analyticsService = require('./analyticsService');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');

/**
 * Calculate Financial Health Score 2.0 (0-100) with transparent components.
 * @param {string} userId
 */
async function calculateHealthScore(userId) {
  const overview = await analyticsService.getOverview(userId);
  const monthlyRes = await analyticsService.getMonthly(userId, 6);
  const monthlyHistory = monthlyRes.history || [];
  const budgetsRes = await Budget.findByUserId(userId);
  const budgets = budgetsRes.budgets || [];
  const goalsRes = await Goal.findByUserId(userId);
  const goals = goalsRes.goals || [];

  const strengths = [];
  const weaknesses = [];

  // Component 1: Savings Rate (25% Weight)
  const savingsRate = overview.savingsRate;
  let savingsScore = 10;
  let savingsExpl = 'Savings rate is low or negative.';
  if (savingsRate >= 30) {
    savingsScore = 100;
    savingsExpl = `Outstanding savings rate of ${savingsRate}%.`;
    strengths.push(`High savings rate of ${savingsRate}%.`);
  } else if (savingsRate >= 20) {
    savingsScore = 80;
    savingsExpl = `Solid savings rate of ${savingsRate}%.`;
    strengths.push(`Healthy savings rate of ${savingsRate}%.`);
  } else if (savingsRate >= 10) {
    savingsScore = 60;
    savingsExpl = `Moderate savings rate of ${savingsRate}%.`;
  } else if (savingsRate > 0) {
    savingsScore = 40;
    savingsExpl = `Low savings rate of ${savingsRate}%.`;
    weaknesses.push(`Low savings rate of ${savingsRate}%. Consider reducing discretionary spending.`);
  } else {
    weaknesses.push('Expenses match or exceed total income.');
  }

  // Component 2: Spending Control (20% Weight)
  const income = overview.totalIncome;
  const expense = overview.totalExpenses;
  const expenseRatio = income > 0 ? (expense / income) * 100 : 100;
  let spendingScore = 10;
  let spendingExpl = 'Spending consumes more than 100% of income.';
  if (expenseRatio <= 60) {
    spendingScore = 100;
    spendingExpl = `Excellent spending control (expenses are ${Math.round(expenseRatio)}% of income).`;
    strengths.push('Disciplined expense control below 60% of income.');
  } else if (expenseRatio <= 80) {
    spendingScore = 75;
    spendingExpl = `Good spending control (expenses are ${Math.round(expenseRatio)}% of income).`;
  } else if (expenseRatio <= 100) {
    spendingScore = 50;
    spendingExpl = `Moderate spending control (expenses consume ${Math.round(expenseRatio)}% of income).`;
    weaknesses.push('High spending ratio relative to total income.');
  } else {
    weaknesses.push('Spending exceeds total income for the period.');
  }

  // Component 3: Budget Adherence (20% Weight)
  let budgetScore = 70;
  let budgetExpl = 'No active budgets set. Default neutral score applied.';
  if (budgets.length > 0) {
    let adnCount = 0;
    budgets.forEach(b => {
      if (b.spent <= b.monthlyLimit) adnCount++;
    });
    const adhRatio = adnCount / budgets.length;
    budgetScore = Math.round(adhRatio * 100);
    budgetExpl = `${adnCount} of ${budgets.length} budgets adhering to monthly limits.`;
    if (adhRatio >= 0.8) {
      strengths.push('Strong budget adherence across categories.');
    } else {
      weaknesses.push(`${budgets.length - adnCount} category budget(s) currently exceeded.`);
    }
  }

  // Component 4: Cash-Flow Stability (15% Weight)
  let stabilityScore = 70;
  let stabilityExpl = 'Insufficient monthly history to determine cash flow stability.';
  if (monthlyHistory.length > 0) {
    const positiveMonths = monthlyHistory.filter(m => m.net > 0).length;
    const stabilityRatio = positiveMonths / monthlyHistory.length;
    stabilityScore = Math.round(stabilityRatio * 100);
    stabilityExpl = `${positiveMonths} of ${monthlyHistory.length} recent months maintained positive net cash flow.`;
    if (stabilityRatio >= 0.8) {
      strengths.push('Consistent positive cash flow over recent months.');
    } else if (stabilityRatio < 0.5) {
      weaknesses.push('Frequent months with negative cash flow.');
    }
  }

  // Component 5: Goal Progress (10% Weight)
  let goalScore = 70;
  let goalExpl = 'No active financial goals set. Default neutral score applied.';
  if (goals.length > 0) {
    let totalProgress = 0;
    goals.forEach(g => {
      const target = Number(g.targetAmount) || 1;
      const saved = Number(g.savedAmount) || 0;
      totalProgress += Math.min(100, (saved / target) * 100);
    });
    goalScore = Math.round(totalProgress / goals.length);
    goalExpl = `Average goal progress is ${goalScore}% across ${goals.length} active goals.`;
    if (goalScore >= 75) {
      strengths.push('Excellent progress on savings goals.');
    }
  }

  // Component 6: Consistency (10% Weight)
  let consistencyScore = 50;
  let consistencyExpl = 'Basic financial tracking consistency.';
  if (overview.totalCount >= 10) {
    consistencyScore = 100;
    consistencyExpl = 'Regular and consistent transaction logging.';
  } else if (overview.totalCount >= 3) {
    consistencyScore = 75;
    consistencyExpl = 'Moderate transaction logging activity.';
  }

  // Calculate Weighted Total
  const totalScore = Math.max(0, Math.min(100, Math.round(
    (savingsScore * 0.25) +
    (spendingScore * 0.20) +
    (budgetScore * 0.20) +
    (stabilityScore * 0.15) +
    (goalScore * 0.10) +
    (consistencyScore * 0.10)
  )));

  let letterGrade = 'C';
  if (totalScore >= 90) letterGrade = 'A';
  else if (totalScore >= 80) letterGrade = 'B';
  else if (totalScore >= 70) letterGrade = 'C';
  else if (totalScore >= 50) letterGrade = 'D';
  else letterGrade = 'F';

  const componentObj = {
    savingsRateScore: { score: savingsScore, weight: '25%', maxScore: 100, rating: savingsScore >= 80 ? 'Good' : 'Moderate', explanation: savingsExpl },
    budgetAdherenceScore: { score: budgetScore, weight: '20%', maxScore: 100, rating: budgetScore >= 80 ? 'Good' : 'Moderate', explanation: budgetExpl },
    goalProgressScore: { score: goalScore, weight: '15%', maxScore: 100, rating: goalScore >= 75 ? 'Good' : 'Moderate', explanation: goalExpl },
    debtRatioScore: { score: spendingScore, weight: '15%', maxScore: 100, rating: spendingScore >= 75 ? 'Good' : 'Moderate', explanation: spendingExpl },
    expenseStabilityScore: { score: stabilityScore, weight: '15%', maxScore: 100, rating: stabilityScore >= 75 ? 'Good' : 'Moderate', explanation: stabilityExpl },
    emergencyFundRatioScore: { score: consistencyScore, weight: '10%', maxScore: 100, rating: consistencyScore >= 75 ? 'Good' : 'Moderate', explanation: consistencyExpl }
  };

  const recommendations = await getRecommendations(userId, { overview, budgets, goals, savingsRate });

  return {
    overallScore: totalScore,
    score: totalScore,
    grade: letterGrade,
    disclaimer: 'The Financial Health Score is an estimate based on activity recorded in ExpenseIQ.',
    components: componentObj,
    strengths,
    weaknesses,
    recommendations
  };
}

/**
 * Generate structured, actionable financial recommendations.
 */
async function getRecommendations(userId, contextData = {}) {
  const overview = contextData.overview || await analyticsService.getOverview(userId);
  const budgetsRes = contextData.budgets ? { budgets: contextData.budgets } : await Budget.findByUserId(userId);
  const budgets = budgetsRes.budgets || [];
  const goalsRes = contextData.goals ? { goals: contextData.goals } : await Goal.findByUserId(userId);
  const goals = goalsRes.goals || [];

  const recs = [];

  // Rec 1: Overspending / High Expense Ratio
  if (overview.totalIncome > 0 && (overview.totalExpenses / overview.totalIncome) > 0.8) {
    recs.push({
      title: 'Reduce Top Discretionary Expenses',
      priority: 'high',
      reason: `Expenses consume ${Math.round((overview.totalExpenses / overview.totalIncome) * 100)}% of monthly income.`,
      expectedBenefit: 'Increases net savings buffer and improves health score.',
      category: overview.largestExpenseCategory ? overview.largestExpenseCategory.category : 'General'
    });
  }

  // Rec 2: Exceeded Budgets
  const exceeded = budgets.filter(b => b.spent > b.monthlyLimit);
  if (exceeded.length > 0) {
    recs.push({
      title: 'Review Exceeded Category Budgets',
      priority: 'high',
      reason: `${exceeded.length} budget(s) have exceeded monthly limits (${exceeded[0].category}: ₹${exceeded[0].spent} / ₹${exceeded[0].monthlyLimit}).`,
      expectedBenefit: 'Prevents budget overruns and stabilizes monthly cash flow.',
      category: exceeded[0].category
    });
  }

  // Rec 3: Low Savings Rate
  if (overview.savingsRate < 20) {
    recs.push({
      title: 'Target 20% Monthly Savings Goal',
      priority: 'medium',
      reason: `Current savings rate is ${overview.savingsRate}%, below recommended 20% benchmark.`,
      expectedBenefit: 'Builds long-term emergency fund reserves.',
      category: 'Savings'
    });
  }

  // Rec 4: Goal Contributions
  if (goals.length > 0) {
    const laggingGoal = goals.find(g => (Number(g.savedAmount) / Number(g.targetAmount)) < 0.5);
    if (laggingGoal) {
      const gTitle = laggingGoal.title || laggingGoal.name || 'Goal';
      recs.push({
        title: `Increase Contribution to ${gTitle}`,
        priority: 'medium',
        reason: `Goal "${gTitle}" is under 50% funded (₹${laggingGoal.savedAmount} / ₹${laggingGoal.targetAmount}).`,
        expectedBenefit: 'Accelerates target deadline completion.',
        category: 'Goals'
      });
    }
  }

  if (recs.length === 0) {
    recs.push({
      title: 'Maintain Current Financial Discipline',
      priority: 'low',
      reason: 'All spending, budget, and savings metrics are performing within healthy parameters.',
      expectedBenefit: 'Sustains strong financial health score.',
      category: 'General'
    });
  }

  return recs;
}

module.exports = {
  calculateHealthScore,
  getRecommendations
};
