const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const { generateInsights } = require('./insightEngine');
const { DEFAULT_CURRENCY } = require('../config/config');

/**
 * Currency Symbol mapping helper
 */
function getCurrencySymbol(currencyCode) {
  const code = (currencyCode || DEFAULT_CURRENCY).toUpperCase();
  const map = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF'
  };
  return map[code] || code;
}

/**
 * Format month string YYYY-MM
 */
function getMonthString(dateObj = new Date()) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getPreviousMonthString(dateObj = new Date()) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth() - 1, 1);
  return getMonthString(d);
}

/**
 * Sanitize untrusted user text (notes, categories, goal names) for AI context inclusion.
 * Preserves all Unicode languages (Hindi, Spanish, Japanese, etc.) while stripping
 * control characters, dangerous HTML markup, and excessive whitespace.
 */
function sanitizeText(text, maxLen = 60) {
  if (!text || typeof text !== 'string') return '';

  let sanitized = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[\r\n\t\x00-\x1F\x7F]+/g, ' ') // Remove control characters & newlines
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();

  // Neutralize common prompt injection directives (defense-in-depth)
  const injectionPatterns = [
    /ignore\s+previous\s+(instructions|directives)/gi,
    /reveal\s+(system\s+prompt|secrets|api\s*keys?|credentials)/gi,
    /system\s+prompt/gi,
    /forget\s+(all\s+)?instructions/gi,
    /override\s+rules/gi,
    /act\s+as\s+admin/gi
  ];

  injectionPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[filtered]');
  });

  return sanitized.slice(0, maxLen);
}

/**
 * Build structured, size-capped financial context for LLM prompt injection.
 * Strict user isolation: ALWAYS scoped to userId.
 * Guarantees 100% valid JSON payload without post-serialization truncation.
 */
async function buildFinancialContext(userId) {
  if (!userId) {
    throw new Error('buildFinancialContext requires a valid userId');
  }

  // 1. Fetch User Profile (Currency)
  const user = await User.findById(userId);
  const currencyCode = user ? user.currency || DEFAULT_CURRENCY : DEFAULT_CURRENCY;
  const currencySymbol = getCurrencySymbol(currencyCode);

  const currentMonthStr = getMonthString();
  const previousMonthStr = getPreviousMonthString();

  // 2. Fetch Summaries & Data
  const [currentSummary, previousSummary, userBudgets, userGoals, insightsData] = await Promise.all([
    Transaction.getSummary(userId, currentMonthStr),
    Transaction.getSummary(userId, previousMonthStr),
    Budget.findByUserId(userId),
    Goal.findByUserId(userId),
    generateInsights(userId).catch(() => null)
  ]);

  // Current Month Stats
  const cIncome = currentSummary ? currentSummary.totalIncome || 0 : 0;
  const cExpenses = currentSummary ? currentSummary.totalExpenses || 0 : 0;
  const cSavings = cIncome - cExpenses;
  const cSavingsRate = cIncome > 0 ? ((cSavings / cIncome) * 100).toFixed(1) : '0.0';

  // Category spending breakdown (current month, limited to top 8)
  const categoryBreakdown = {};
  if (currentSummary && Array.isArray(currentSummary.byCategory)) {
    currentSummary.byCategory.slice(0, 8).forEach(c => {
      categoryBreakdown[sanitizeText(c.category, 30)] = c.total;
    });
  }

  // Previous Month Stats
  const pIncome = previousSummary ? previousSummary.totalIncome || 0 : 0;
  const pExpenses = previousSummary ? previousSummary.totalExpenses || 0 : 0;
  const pSavings = pIncome - pExpenses;

  // Month-over-Month % change in expenses
  let momExpenseChange = '0%';
  if (pExpenses > 0) {
    const diffPct = (((cExpenses - pExpenses) / pExpenses) * 100).toFixed(1);
    momExpenseChange = `${diffPct > 0 ? '+' : ''}${diffPct}%`;
  }

  // Top Recent Expenses (max 5, sanitized)
  let topRecentExpenses = [];
  try {
    const recentTxnsResult = await Transaction.findByUserId(userId, {
      type: 'expense',
      month: currentMonthStr,
      page: 1,
      limit: 5
    });
    const txnsList = Array.isArray(recentTxnsResult) ? recentTxnsResult : (recentTxnsResult.transactions || []);
    topRecentExpenses = txnsList.slice(0, 5).map(t => ({
      category: sanitizeText(t.category, 30),
      amount: t.amount,
      date: t.date ? String(t.date).slice(0, 10) : '',
      note: sanitizeText(t.note, 50)
    }));
  } catch (e) {
    topRecentExpenses = [];
  }

  // Active Budgets Summary (Current Month, max 10)
  const activeBudgets = (userBudgets || [])
    .filter(b => !b.month || b.month === currentMonthStr)
    .slice(0, 10)
    .map(b => {
      const spent = b.spent || 0;
      const limit = b.amount || 0;
      const remaining = limit - spent;
      const utilPct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      return {
        category: sanitizeText(b.category, 30),
        limit,
        spent,
        remaining,
        utilizationPct: `${utilPct}%`
      };
    });

  // Goals Summary (max 5)
  const goalsSummary = (userGoals || []).slice(0, 5).map(g => {
    const target = g.targetAmount || 0;
    const current = g.currentAmount || 0;
    const pct = target > 0 ? Math.round((current / target) * 100) : 0;
    return {
      name: sanitizeText(g.name, 35),
      targetAmount: target,
      currentAmount: current,
      progressPct: `${pct}%`,
      targetDate: g.targetDate ? String(g.targetDate).slice(0, 10) : 'N/A'
    };
  });

  // Health & Insights summary (max 3 anomalies, max 3 key insights)
  const healthScore = insightsData ? insightsData.healthScore || 100 : 100;
  const anomalies = insightsData && Array.isArray(insightsData.anomalies) ? insightsData.anomalies.slice(0, 3) : [];
  const topInsights = insightsData && Array.isArray(insightsData.insights) ? insightsData.insights.slice(0, 3) : [];

  // Build Structured Payload
  const financialContextPayload = {
    currencySymbol,
    currencyCode,
    currentMonth: {
      month: currentMonthStr,
      totalIncome: cIncome,
      totalExpenses: cExpenses,
      netSavings: cSavings,
      savingsRatePct: `${cSavingsRate}%`,
      categoryBreakdown,
      topRecentExpenses
    },
    previousMonth: {
      month: previousMonthStr,
      totalIncome: pIncome,
      totalExpenses: pExpenses,
      netSavings: pSavings,
      momExpenseChange
    },
    budgets: activeBudgets,
    goals: goalsSummary,
    healthAndInsights: {
      healthScore,
      anomaliesCount: anomalies.length,
      anomalies: anomalies.map(a => ({
        category: sanitizeText(a.category, 30),
        amount: a.amount,
        average: a.average,
        ratio: a.ratio
      })),
      keyInsights: topInsights.map(i => sanitizeText(i.title || i.message || i, 60))
    }
  };

  // Convert to formatted valid JSON string (no post-string slicing)
  const contextString = JSON.stringify(financialContextPayload, null, 2);

  return {
    rawPayload: financialContextPayload,
    contextString,
    currencySymbol,
    currencyCode
  };
}

module.exports = {
  buildFinancialContext,
  getCurrencySymbol,
  sanitizeText
};
