const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const { getCurrentMonth, getMonthFromDate } = require('./helpers');

const mongoose = require('mongoose');

/**
 * Generate AI Financial Insights, Health Score, and Anomaly Detections for a user.
 * @param {string} userId 
 */
async function generateInsights(userId) {
  const currentMonth = getCurrentMonth();
  
  // Calculate previous month string (YYYY-MM)
  const [currYear, currMonthNum] = currentMonth.split('-').map(Number);
  const prevDate = new Date(currYear, currMonthNum - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

  const budgets = await Budget.getWithSpending(userId);

  let currentIncome = 0;
  let currentExpense = 0;
  let prevExpense = 0;
  const currentCategoryExpenses = {};
  const categoryTxnAmounts = {};

  const isMongo = mongoose.connection.readyState === 1;

  if (isMongo && Transaction.TransactionModel) {
    const [facetResult] = await Transaction.TransactionModel.aggregate([
      { $match: { userId } },
      {
        $facet: {
          currentMonthTotals: [
            { $match: { date: { $regex: `^${currentMonth}` } } },
            { $group: { _id: '$type', total: { $sum: '$amount' } } }
          ],
          currentMonthCategories: [
            { $match: { type: 'expense', date: { $regex: `^${currentMonth}` } } },
            { $group: { _id: '$category', total: { $sum: '$amount' } } }
          ],
          prevMonthTotals: [
            { $match: { type: 'expense', date: { $regex: `^${prevMonth}` } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          categoryAverages: [
            { $match: { type: 'expense' } },
            { $group: { _id: '$category', avgAmount: { $avg: '$amount' }, count: { $sum: 1 } } }
          ],
          currentMonthExpenses: [
            { $match: { type: 'expense', date: { $regex: `^${currentMonth}` }, amount: { $gte: 500 } } },
            { $project: { id: 1, date: 1, category: 1, amount: 1, note: 1 } }
          ]
        }
      }
    ]);

    if (facetResult && facetResult.currentMonthTotals) {
      facetResult.currentMonthTotals.forEach(item => {
        if (item._id === 'income') currentIncome = item.total;
        if (item._id === 'expense') currentExpense = item.total;
      });
    }

    if (facetResult && facetResult.currentMonthCategories) {
      facetResult.currentMonthCategories.forEach(item => {
        if (item._id) currentCategoryExpenses[item._id.trim()] = item.total;
      });
    }

    if (facetResult && facetResult.prevMonthTotals && facetResult.prevMonthTotals[0]) {
      prevExpense = facetResult.prevMonthTotals[0].total || 0;
    }

    const mongoAnomalies = [];
    const catStatsMap = {};
    if (facetResult && facetResult.categoryAverages) {
      facetResult.categoryAverages.forEach(item => {
        if (item._id) {
          catStatsMap[item._id.trim()] = { avgAmount: item.avgAmount, count: item.count };
        }
      });
    }

    if (facetResult && facetResult.currentMonthExpenses) {
      facetResult.currentMonthExpenses.forEach(t => {
        const cat = (t.category || 'Other').trim();
        const stats = catStatsMap[cat];
        if (stats && stats.count >= 2) {
          const avg = stats.avgAmount;
          if (t.amount >= 500 && t.amount >= avg * 2.0) {
            mongoAnomalies.push({
              id: t.id,
              date: t.date,
              category: cat,
              amount: t.amount,
              average: Math.round(avg),
              ratio: (t.amount / avg).toFixed(1),
              note: t.note || 'Unusually large transaction'
            });
          }
        }
      });
    }
    mongoAnomaliesComputed = mongoAnomalies;
  } else {
    const transactions = await Transaction.findByUserId(userId);

    transactions.forEach(t => {
      const tMonth = getMonthFromDate(t.date);
      const amount = Number(t.amount) || 0;
      const cat = (t.category || 'Other').trim();

      if (t.type === 'expense') {
        if (!categoryTxnAmounts[cat]) categoryTxnAmounts[cat] = [];
        categoryTxnAmounts[cat].push({ ...t, amount });
      }

      if (tMonth === currentMonth) {
        if (t.type === 'income') {
          currentIncome += amount;
        } else {
          currentExpense += amount;
          currentCategoryExpenses[cat] = (currentCategoryExpenses[cat] || 0) + amount;
        }
      } else if (tMonth === prevMonth && t.type === 'expense') {
        prevExpense += amount;
      }
    });
  }

  // 1. Savings Rate Score (0 - 40 pts)
  const netSavings = currentIncome - currentExpense;
  const savingsRate = currentIncome > 0 ? Math.max(0, netSavings / currentIncome) : 0;
  // Full 40 pts if savings rate >= 25%, scaled linearly
  const savingsScore = Math.min(40, Math.round((savingsRate / 0.25) * 40));

  // 2. Budget Adherence Score (0 - 40 pts)
  let budgetScore = 30; // default if no budgets set
  const overBudgetItems = [];
  const nearBudgetItems = [];

  if (budgets.length > 0) {
    let compliantCount = 0;
    budgets.forEach(b => {
      const spent = Number(b.spent) || 0;
      const limit = Number(b.monthlyLimit) || 0;
      if (spent > limit) {
        overBudgetItems.push(b);
      } else {
        compliantCount++;
        if (limit > 0 && (spent / limit) >= 0.8) {
          nearBudgetItems.push(b);
        }
      }
    });
    budgetScore = Math.round((compliantCount / budgets.length) * 40);
  }

  // 3. Spending Trend Score (0 - 20 pts)
  let trendScore = 15;
  if (prevExpense > 0) {
    if (currentExpense <= prevExpense) {
      trendScore = 20; // Reduced or equal spending
    } else {
      const increasePct = ((currentExpense - prevExpense) / prevExpense) * 100;
      if (increasePct <= 10) trendScore = 15;
      else if (increasePct <= 25) trendScore = 10;
      else trendScore = 5;
    }
  }

  // Overall Health Score (0 - 100)
  const healthScore = Math.min(100, Math.max(0, savingsScore + budgetScore + trendScore));

  let scoreLevel = 'Needs Attention';
  let scoreColor = '#ef4444'; // Red/Coral
  let scoreBadge = '⚠️';

  if (healthScore >= 80) {
    scoreLevel = 'Excellent';
    scoreColor = '#10b981'; // Emerald
    scoreBadge = '🌟';
  } else if (healthScore >= 65) {
    scoreLevel = 'Good';
    scoreColor = '#3b82f6'; // Blue
    scoreBadge = '👍';
  } else if (healthScore >= 50) {
    scoreLevel = 'Fair';
    scoreColor = '#f59e0b'; // Yellow/Orange
    scoreBadge = '⚡';
  }

  // 4. Generate AI Insights & Recommendations
  const insights = [];

  // Insight 1: Savings Performance
  if (currentIncome > 0) {
    const savingsPct = Math.round(savingsRate * 100);
    if (savingsPct >= 20) {
      insights.push({
        id: 'savings-good',
        type: 'success',
        icon: '💎',
        title: 'Strong Savings Rate',
        description: `You saved ${savingsPct}% of your income this month (₹${netSavings.toLocaleString('en-IN')}). Outstanding financial discipline!`,
        badge: 'Recommended: 20%'
      });
    } else if (savingsPct > 0) {
      insights.push({
        id: 'savings-moderate',
        type: 'warning',
        icon: '💡',
        title: 'Opportunity to Boost Savings',
        description: `Your savings rate is currently ${savingsPct}%. Aim for at least 20% by reviewing non-essential spending.`,
        badge: 'Target: 20%'
      });
    } else {
      insights.push({
        id: 'savings-negative',
        type: 'danger',
        icon: '⚠️',
        title: 'Spending Exceeds Income',
        description: `Your monthly expenses (₹${currentExpense.toLocaleString('en-IN')}) exceed income (₹${currentIncome.toLocaleString('en-IN')}). Consider pausing non-critical purchases.`,
        badge: 'Alert'
      });
    }
  }

  // Insight 2: Category Dominance
  if (currentExpense > 0) {
    let topCat = '';
    let maxExpense = 0;
    Object.entries(currentCategoryExpenses).forEach(([cat, amount]) => {
      if (amount > maxExpense) {
        maxExpense = amount;
        topCat = cat;
      }
    });

    if (topCat) {
      const sharePct = Math.round((maxExpense / currentExpense) * 100);
      insights.push({
        id: 'top-category',
        type: sharePct >= 40 ? 'warning' : 'info',
        icon: '📊',
        title: `Top Spending Category: ${topCat}`,
        description: `${topCat} accounts for ${sharePct}% (₹${maxExpense.toLocaleString('en-IN')}) of total expenses this month.`,
        badge: `${sharePct}% of total`
      });
    }
  }

  // Insight 3: Budget Compliance
  if (overBudgetItems.length > 0) {
    const names = overBudgetItems.map(b => b.category).join(', ');
    insights.push({
      id: 'over-budget',
      type: 'danger',
      icon: '🎯',
      title: `${overBudgetItems.length} Budget Category Exceeded`,
      description: `You have exceeded limits in: ${names}. Adjust remaining spending to stay on track.`,
      badge: 'Action Required'
    });
  } else if (nearBudgetItems.length > 0) {
    const names = nearBudgetItems.map(b => b.category).join(', ');
    insights.push({
      id: 'near-budget',
      type: 'warning',
      icon: '⚠️',
      title: `Approaching Limit in ${nearBudgetItems.length} Categories`,
      description: `Categories near capacity (>80% used): ${names}. Keep an eye on expenses here.`,
      badge: '>80% limit'
    });
  } else if (budgets.length > 0) {
    insights.push({
      id: 'budget-healthy',
      type: 'success',
      icon: '✅',
      title: 'All Budgets On Track',
      description: `All ${budgets.length} set budget categories are within their designated spending limits.`,
      badge: '100% Compliant'
    });
  }

  // Insight 4: Month-over-Month Trend
  if (prevExpense > 0 && currentExpense > 0) {
    const diff = currentExpense - prevExpense;
    const pct = Math.abs(Math.round((diff / prevExpense) * 100));
    if (diff > 0) {
      insights.push({
        id: 'trend-increase',
        type: pct > 20 ? 'warning' : 'info',
        icon: '📈',
        title: `Monthly Expenses Up by ${pct}%`,
        description: `You spent ₹${Math.abs(diff).toLocaleString('en-IN')} more this month compared to last month (₹${prevExpense.toLocaleString('en-IN')}).`,
        badge: `+${pct}% vs last month`
      });
    } else if (diff < 0) {
      insights.push({
        id: 'trend-decrease',
        type: 'success',
        icon: '📉',
        title: `Expenses Reduced by ${pct}%`,
        description: `Great progress! Spending is down by ₹${Math.abs(diff).toLocaleString('en-IN')} compared to last month.`,
        badge: `-${pct}% vs last month`
      });
    }
  }

  // 5. Anomaly Detection (> 2.0x category average and current month)
  let anomalies = [];
  if (isMongo && typeof mongoAnomaliesComputed !== 'undefined' && mongoAnomaliesComputed) {
    anomalies = mongoAnomaliesComputed;
  } else {
    Object.entries(categoryTxnAmounts).forEach(([cat, list]) => {
      if (list.length >= 2) {
        const totalAmount = list.reduce((sum, item) => sum + item.amount, 0);
        const avg = totalAmount / list.length;

        list.forEach(t => {
          const tMonth = getMonthFromDate(t.date);
          if (tMonth === currentMonth && t.amount >= 500 && t.amount >= avg * 2.0) {
            anomalies.push({
              id: t.id,
              date: t.date,
              category: cat,
              amount: t.amount,
              average: Math.round(avg),
              ratio: (t.amount / avg).toFixed(1),
              note: t.note || 'Unusually large transaction'
            });
          }
        });
      }
    });
  }

  return {
    healthScore,
    scoreLevel,
    scoreColor,
    scoreBadge,
    breakdown: {
      savingsScore,
      budgetScore,
      trendScore,
      savingsRatePct: Math.round(savingsRate * 100),
      netSavings,
      currentIncome,
      currentExpense
    },
    insights,
    anomalies
  };
}

module.exports = { generateInsights };
