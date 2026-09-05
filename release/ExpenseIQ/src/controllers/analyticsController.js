const analyticsService = require('../services/analyticsService');

function parseQueryParams(query) {
  let { from, to, month, compareMonth } = query;
  if (!from && !to && month && month.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    from = `${month}-01`;
    to = `${month}-${String(lastDay).padStart(2, '0')}`;
  }

  let compareFrom = null;
  let compareTo = null;
  if (compareMonth && compareMonth.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = compareMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    compareFrom = `${compareMonth}-01`;
    compareTo = `${compareMonth}-${String(lastDay).padStart(2, '0')}`;
  }

  return { from, to, month, compareFrom, compareTo };
}

function validateDateRange(from, to) {
  if (from && !from.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return 'Invalid "from" date format. Expected YYYY-MM-DD.';
  }
  if (to && !to.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return 'Invalid "to" date format. Expected YYYY-MM-DD.';
  }
  if (from && to && from > to) {
    return '"from" date cannot be after "to" date.';
  }
  return null;
}

async function getOverview(req, res, next) {
  try {
    const { from, to, month } = parseQueryParams(req.query);
    const dateErr = validateDateRange(from, to);
    if (dateErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE_RANGE', message: dateErr }
      });
    }

    const overview = await analyticsService.getOverview(req.user.id, from, to);
    res.status(200).json({
      success: true,
      overview: {
        month: month || (from ? from.slice(0, 7) : 'all'),
        income: overview.totalIncome,
        expense: overview.totalExpenses,
        balance: overview.netCashFlow,
        savingsRate: overview.savingsRate,
        ...overview
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getTrends(req, res, next) {
  try {
    const { from, to } = parseQueryParams(req.query);
    const dateErr = validateDateRange(from, to);
    if (dateErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE_RANGE', message: dateErr }
      });
    }

    const overview = await analyticsService.getOverview(req.user.id, from, to);
    res.status(200).json({
      success: true,
      trends: [
        { period: 'Income', amount: overview.totalIncome, income: overview.totalIncome, expense: 0 },
        { period: 'Expense', amount: overview.totalExpenses, income: 0, expense: overview.totalExpenses }
      ]
    });
  } catch (err) {
    next(err);
  }
}

async function getCategories(req, res, next) {
  try {
    const { from, to } = parseQueryParams(req.query);
    const dateErr = validateDateRange(from, to);
    if (dateErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE_RANGE', message: dateErr }
      });
    }

    const categoryData = await analyticsService.getCategories(req.user.id, from, to);
    res.status(200).json({
      success: true,
      ...categoryData
    });
  } catch (err) {
    next(err);
  }
}

async function getMonthly(req, res, next) {
  try {
    const { months } = req.query;
    const parsedMonths = months ? parseInt(months, 10) : 12;
    if (months && (!Number.isFinite(parsedMonths) || parsedMonths < 1 || parsedMonths > 24)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAM', message: '"months" must be an integer between 1 and 24.' }
      });
    }

    const monthlyData = await analyticsService.getMonthly(req.user.id, parsedMonths);
    res.status(200).json({
      success: true,
      monthlyHistory: monthlyData.history,
      ...monthlyData
    });
  } catch (err) {
    next(err);
  }
}

async function getComparison(req, res, next) {
  try {
    const { from, to, compareFrom, compareTo } = parseQueryParams(req.query);
    const dateErr = validateDateRange(from, to);
    if (dateErr) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_DATE_RANGE', message: dateErr }
      });
    }

    const comparison = await analyticsService.getComparison(req.user.id, from, to, compareFrom, compareTo);
    res.status(200).json({
      success: true,
      comparison: {
        ...comparison,
        current: {
          income: comparison.currentPeriod.totalIncome,
          expense: comparison.currentPeriod.totalExpenses,
          balance: comparison.currentPeriod.netCashFlow,
          savingsRate: comparison.currentPeriod.savingsRate
        },
        previous: {
          income: comparison.previousPeriod.totalIncome,
          expense: comparison.previousPeriod.totalExpenses,
          balance: comparison.previousPeriod.netCashFlow,
          savingsRate: comparison.previousPeriod.savingsRate
        },
        changes: {
          incomeChangePercent: comparison.changes.incomeChangePercent,
          expenseChangePercent: comparison.changes.expenseChangePercent,
          netCashFlowChangePercent: comparison.changes.netCashFlowChangePercent,
          savingsRateChange: comparison.changes.savingsRateChange,
          income: { percentageChange: comparison.changes.incomeChangePercent },
          expense: { percentageChange: comparison.changes.expenseChangePercent },
          balance: { percentageChange: comparison.changes.netCashFlowChangePercent },
          savingsRate: { percentageChange: comparison.changes.savingsRateChange }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getTrends,
  getCategories,
  getMonthly,
  getComparison
};
