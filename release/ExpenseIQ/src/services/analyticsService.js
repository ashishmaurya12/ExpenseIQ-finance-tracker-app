const Transaction = require('../models/Transaction');
const { getMonthFromDate, getCurrentMonth } = require('../utils/helpers');

/**
 * Get analytics overview metrics for a given date range.
 * @param {string} userId
 * @param {string|null} fromDate - YYYY-MM-DD
 * @param {string|null} toDate - YYYY-MM-DD
 */
async function getOverview(userId, fromDate = null, toDate = null) {
  const transactions = await Transaction.findByUserId(userId, {
    from: fromDate || undefined,
    to: toDate || undefined
  });

  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let largestTxn = null;
  const catMap = {};
  const monthSet = new Set();

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    const m = getMonthFromDate(t.date);
    if (m) monthSet.add(m);

    if (t.type === 'income') {
      totalIncome += amt;
      incomeCount++;
    } else if (t.type === 'expense') {
      totalExpenses += amt;
      expenseCount++;
      const cat = (t.category || 'Other').trim();
      catMap[cat] = (catMap[cat] || 0) + amt;
    }

    if (!largestTxn || amt > Number(largestTxn.amount)) {
      largestTxn = {
        id: t.id,
        type: t.type,
        amount: amt,
        category: t.category,
        date: t.date,
        note: t.note || ''
      };
    }
  });

  totalIncome = Math.round(totalIncome * 100) / 100;
  totalExpenses = Math.round(totalExpenses * 100) / 100;
  const netCashFlow = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const savingsRate = totalIncome > 0
    ? Math.max(0, Math.round(((totalIncome - totalExpenses) / totalIncome) * 100 * 100) / 100)
    : 0;

  const monthsCount = Math.max(1, monthSet.size || 1);
  const averageMonthlyIncome = Math.round((totalIncome / monthsCount) * 100) / 100;
  const averageMonthlyExpenses = Math.round((totalExpenses / monthsCount) * 100) / 100;

  let largestCategory = { category: 'None', amount: 0 };
  Object.entries(catMap).forEach(([cat, amt]) => {
    if (amt > largestCategory.amount) {
      largestCategory = { category: cat, amount: Math.round(amt * 100) / 100 };
    }
  });

  return {
    totalIncome,
    totalExpenses,
    netCashFlow,
    savingsRate,
    averageMonthlyIncome,
    averageMonthlyExpenses,
    largestExpenseCategory: largestCategory,
    largestTransaction: largestTxn,
    totalCount: transactions.length,
    incomeCount,
    expenseCount
  };
}

/**
 * Get category spending breakdown with trends and comparison.
 */
async function getCategories(userId, fromDate = null, toDate = null) {
  const currentTxns = await Transaction.findByUserId(userId, {
    type: 'expense',
    from: fromDate || undefined,
    to: toDate || undefined
  });

  // Calculate duration in days/months to query previous equivalent period
  let prevFromDate = null;
  let prevToDate = null;
  if (fromDate && toDate) {
    const currStart = new Date(fromDate);
    const currEnd = new Date(toDate);
    const diffMs = currEnd.getTime() - currStart.getTime();
    const prevEnd = new Date(currStart.getTime() - (24 * 60 * 60 * 1000));
    const prevStart = new Date(prevEnd.getTime() - diffMs);
    prevFromDate = prevStart.toISOString().slice(0, 10);
    prevToDate = prevEnd.toISOString().slice(0, 10);
  }

  const prevTxns = prevFromDate && prevToDate
    ? await Transaction.findByUserId(userId, { type: 'expense', from: prevFromDate, to: prevToDate })
    : [];

  const currCatMap = {};
  let totalCurrentSpending = 0;
  const currMonths = new Set();

  currentTxns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const cat = (t.category || 'Other').trim();
    currCatMap[cat] = (currCatMap[cat] || 0) + amt;
    totalCurrentSpending += amt;
    const m = getMonthFromDate(t.date);
    if (m) currMonths.add(m);
  });

  const prevCatMap = {};
  prevTxns.forEach(t => {
    const amt = Number(t.amount) || 0;
    const cat = (t.category || 'Other').trim();
    prevCatMap[cat] = (prevCatMap[cat] || 0) + amt;
  });

  const monthsCount = Math.max(1, currMonths.size || 1);
  const categories = Object.keys(currCatMap).map(cat => {
    const amount = Math.round(currCatMap[cat] * 100) / 100;
    const prevAmount = Math.round((prevCatMap[cat] || 0) * 100) / 100;

    const percentage = totalCurrentSpending > 0
      ? Math.round((amount / totalCurrentSpending) * 100 * 100) / 100
      : 0;

    const avgMonthlySpending = Math.round((amount / monthsCount) * 100) / 100;

    let changePercentage = 0;
    if (prevAmount > 0) {
      changePercentage = Math.round(((amount - prevAmount) / prevAmount) * 100 * 100) / 100;
    } else if (amount > 0) {
      changePercentage = 100;
    }

    return {
      category: cat,
      amount,
      percentage,
      averageMonthlySpending: avgMonthlySpending,
      previousAmount: prevAmount,
      changePercentage
    };
  });

  categories.sort((a, b) => b.amount - a.amount);

  return {
    totalSpending: Math.round(totalCurrentSpending * 100) / 100,
    categories
  };
}

/**
 * Get continuous monthly history for the last N months.
 */
async function getMonthly(userId, monthsCount = 12) {
  const limitMonths = Math.max(1, Math.min(24, parseInt(monthsCount, 10) || 12));
  const allTxns = await Transaction.findByUserId(userId);

  // Build contiguous list of last N months (YYYY-MM)
  const today = new Date();
  const monthsList = [];
  for (let i = limitMonths - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthsList.push(mStr);
  }

  const monthlyMap = {};
  monthsList.forEach(m => {
    monthlyMap[m] = { month: m, income: 0, expenses: 0 };
  });

  allTxns.forEach(t => {
    const m = getMonthFromDate(t.date);
    if (m && monthlyMap[m]) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        monthlyMap[m].income += amt;
      } else if (t.type === 'expense') {
        monthlyMap[m].expenses += amt;
      }
    }
  });

  const history = monthsList.map(m => {
    const data = monthlyMap[m];
    const income = Math.round(data.income * 100) / 100;
    const expenses = Math.round(data.expenses * 100) / 100;
    const net = Math.round((income - expenses) * 100) / 100;
    const savingsRate = income > 0
      ? Math.max(0, Math.round(((income - expenses) / income) * 100 * 100) / 100)
      : 0;

    return {
      month: m,
      income,
      expenses,
      net,
      savingsRate
    };
  });

  return {
    monthsCount: history.length,
    history
  };
}

/**
 * Compare current period vs previous equivalent period.
 */
async function getComparison(userId, currentFrom = null, currentTo = null, previousFrom = null, previousTo = null) {
  let currFrom = currentFrom;
  let currTo = currentTo;
  let prevFrom = previousFrom;
  let prevTo = previousTo;

  if (!currFrom || !currTo) {
    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth();
    const firstDayCurr = new Date(currYear, currMonth, 1);
    currFrom = firstDayCurr.toISOString().slice(0, 10);
    currTo = now.toISOString().slice(0, 10);
  }

  if (!prevFrom || !prevTo) {
    if (currFrom.endsWith('-01')) {
      const [cy, cm] = currFrom.split('-').map(Number);
      const prevMonthDate = new Date(cy, cm - 2, 1);
      const prevLastDay = new Date(cy, cm - 1, 0).getDate();
      const pMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
      prevFrom = `${pMonthStr}-01`;
      prevTo = `${pMonthStr}-${String(prevLastDay).padStart(2, '0')}`;
    } else {
      const currStart = new Date(currFrom);
      const currEnd = new Date(currTo);
      const diffMs = currEnd.getTime() - currStart.getTime();

      const pEnd = new Date(currStart.getTime() - (24 * 60 * 60 * 1000));
      const pStart = new Date(pEnd.getTime() - diffMs);
      prevFrom = pStart.toISOString().slice(0, 10);
      prevTo = pEnd.toISOString().slice(0, 10);
    }
  }

  const [currOverview, prevOverview] = await Promise.all([
    getOverview(userId, currFrom, currTo),
    getOverview(userId, prevFrom, prevTo)
  ]);

  const calcChange = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100 * 100) / 100;
  };

  return {
    currentPeriod: { from: currFrom, to: currTo, ...currOverview },
    previousPeriod: { from: prevFrom, to: prevTo, ...prevOverview },
    changes: {
      incomeChangePercent: calcChange(currOverview.totalIncome, prevOverview.totalIncome),
      expenseChangePercent: calcChange(currOverview.totalExpenses, prevOverview.totalExpenses),
      netCashFlowChangePercent: calcChange(currOverview.netCashFlow, prevOverview.netCashFlow),
      savingsRateChange: Math.round((currOverview.savingsRate - prevOverview.savingsRate) * 100) / 100
    }
  };
}

module.exports = {
  getOverview,
  getCategories,
  getMonthly,
  getComparison
};
