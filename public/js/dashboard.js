/**
 * ExpenseIQ — Dashboard Logic
 * Loads summary data, renders Chart.js charts, and populates recent transactions.
 */

let myCategoryChart = null;
let myMonthlyChart = null;
let myDailyTrendChart = null;
let myIncomeBreakdownChart = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('dashboard');
  loadDashboard();
});

async function loadDashboard() {
  try {
    // Load summary, recent transactions, and AI insights in parallel
    const [summaryData, transactionsData, insightsData] = await Promise.all([
      apiGetSummary(),
      apiGetTransactions(),
      apiGetInsights().catch(() => null)
    ]);

    renderSummaryCards(summaryData);
    renderCategoryChart(summaryData.categoryBreakdown);
    renderMonthlyChart(summaryData.monthlyData);
    renderDailyTrendChart(summaryData.dailyData);
    renderIncomeBreakdownChart(summaryData.incomeBreakdown);
    renderRecentTransactions(transactionsData.transactions.slice(0, 5));
    if (insightsData) {
      renderAIHealthWidget(insightsData);
    }
    updateGreeting();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Summary Cards ──────────────────────────────────────────
function renderSummaryCards(data) {
  const user = getUser();
  const currency = user?.currency || 'INR';

  animateValue(document.getElementById('totalIncome'), 0, data.totalIncome);
  animateValue(document.getElementById('totalExpense'), 0, data.totalExpense);
  animateValue(document.getElementById('totalBalance'), 0, data.balance);

  // Savings rate
  const savingsRate = data.totalIncome > 0
    ? Math.round(((data.totalIncome - data.totalExpense) / data.totalIncome) * 100)
    : 0;

  const rateEl = document.getElementById('savingsRate');
  rateEl.textContent = `${Math.max(0, savingsRate)}%`;
  if (savingsRate < 0) rateEl.style.color = 'var(--color-expense)';
}

// ─── Pie Chart: Spending by Category ────────────────────────
function renderCategoryChart(breakdown) {
  const categories = Object.keys(breakdown);
  const values = Object.values(breakdown);

  if (categories.length === 0) {
    document.getElementById('categoryChart').style.display = 'none';
    document.getElementById('pieEmpty').classList.remove('hidden');
    return;
  }

  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (myCategoryChart && typeof myCategoryChart.destroy === 'function') {
    myCategoryChart.destroy();
  }

  myCategoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: values,
        backgroundColor: CHART_COLORS.slice(0, categories.length),
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'hsl(220, 15%, 60%)',
            padding: 16,
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'hsl(230, 22%, 11%)',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((context.parsed / total) * 100);
              return ` ${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ─── Bar Chart: Income vs Expense Monthly ───────────────────
function renderMonthlyChart(monthlyData) {
  if (!monthlyData || monthlyData.length === 0) {
    document.getElementById('monthlyChart').style.display = 'none';
    document.getElementById('barEmpty').classList.remove('hidden');
    return;
  }

  const labels = monthlyData.map(m => formatMonthYear(m.month));
  const incomeData = monthlyData.map(m => m.income);
  const expenseData = monthlyData.map(m => m.expense);

  const ctx = document.getElementById('monthlyChart').getContext('2d');

  if (myMonthlyChart && typeof myMonthlyChart.destroy === 'function') {
    myMonthlyChart.destroy();
  }

  myMonthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          backgroundColor: 'hsla(160, 84%, 50%, 0.7)',
          borderColor: 'hsl(160, 84%, 50%)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: 'hsla(0, 85%, 62%, 0.7)',
          borderColor: 'hsl(0, 85%, 62%)',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'hsl(220, 15%, 55%)',
            font: { family: 'Inter', size: 11 }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(255,255,255,0.05)',
            drawBorder: false
          },
          ticks: {
            color: 'hsl(220, 15%, 55%)',
            font: { family: 'Inter', size: 11 },
            callback: function(value) {
              if (value >= 100000) return '₹' + (value / 100000).toFixed(1) + 'L';
              if (value >= 1000) return '₹' + (value / 1000).toFixed(0) + 'K';
              return '₹' + value;
            }
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            color: 'hsl(220, 15%, 60%)',
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: 'hsl(230, 22%, 11%)',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: function(context) {
              return ` ${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      }
    }
  });
}

// ─── Line Chart: Daily Spending Trend (Last 30 Days) ────────
function renderDailyTrendChart(dailyData) {
  const canvas = document.getElementById('dailyTrendChart');
  const emptyEl = document.getElementById('dailyEmpty');
  if (!canvas) return;

  if (!dailyData || dailyData.length === 0 || dailyData.every(d => d.amount === 0)) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  canvas.style.display = 'block';
  if (emptyEl) emptyEl.classList.add('hidden');

  const labels = dailyData.map(d => {
    const parts = d.date.split('-');
    return `${parts[2]}/${parts[1]}`;
  });
  const values = dailyData.map(d => d.amount);

  const ctx = canvas.getContext('2d');
  if (myDailyTrendChart && typeof myDailyTrendChart.destroy === 'function') {
    myDailyTrendChart.destroy();
  }

  myDailyTrendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Expense',
        data: values,
        borderColor: 'hsl(0, 85%, 62%)',
        backgroundColor: 'hsla(0, 85%, 62%, 0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: 'hsl(0, 85%, 62%)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'hsl(220, 15%, 55%)',
            font: { family: 'Inter', size: 10 },
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'hsl(220, 15%, 55%)',
            font: { family: 'Inter', size: 10 },
            callback: function(val) {
              return '₹' + val;
            }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'hsl(230, 22%, 11%)',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: function(context) {
              return ` Spent: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      }
    }
  });
}

// ─── Pie Chart: Income Sources Breakdown ────────────────────
function renderIncomeBreakdownChart(breakdown) {
  const canvas = document.getElementById('incomeBreakdownChart');
  const emptyEl = document.getElementById('incomeEmpty');
  if (!canvas) return;

  const categories = Object.keys(breakdown || {});
  const values = Object.values(breakdown || {});

  if (categories.length === 0 || values.every(v => v === 0)) {
    canvas.style.display = 'none';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  canvas.style.display = 'block';
  if (emptyEl) emptyEl.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  if (myIncomeBreakdownChart && typeof myIncomeBreakdownChart.destroy === 'function') {
    myIncomeBreakdownChart.destroy();
  }

  myIncomeBreakdownChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: values,
        backgroundColor: [
          'hsl(160, 84%, 50%)',
          'hsl(220, 90%, 65%)',
          'hsl(270, 76%, 65%)',
          'hsl(45, 100%, 55%)',
          'hsl(190, 80%, 50%)'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'hsl(220, 15%, 60%)',
            padding: 14,
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'hsl(230, 22%, 11%)',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          callbacks: {
            label: function(context) {
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((context.parsed / total) * 100);
              return ` ${context.label}: ${formatCurrency(context.parsed)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ─── Recent Transactions ────────────────────────────────────
function renderRecentTransactions(transactions) {
  const tbody = document.getElementById('recentTransactions');

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted" style="padding:32px">
          No transactions yet. <a href="/transactions.html">Add your first one</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td>${getCategoryIcon(t.category)} ${t.category}</td>
      <td class="text-muted">${t.note || '—'}</td>
      <td style="text-align:right">
        <span class="amount ${t.type}">
          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
        </span>
      </td>
    </tr>
  `).join('');
}

// ─── AI Financial Insights & Health Score Widget ─────────────
function renderAIHealthWidget(data) {
  const widget = document.getElementById('healthWidget');
  if (!widget || !data) return;

  widget.classList.remove('hidden');

  // Score Value & Color Badge
  const scoreValEl = document.getElementById('healthScoreValue');
  const circleEl = document.getElementById('scoreCircle');
  const levelEl = document.getElementById('scoreLevel');
  const badgeEl = document.getElementById('scoreBadge');

  if (scoreValEl) animateValue(scoreValEl, 0, data.healthScore);
  if (levelEl) {
    levelEl.textContent = `${data.scoreLevel} Health`;
    levelEl.style.color = data.scoreColor;
  }
  if (badgeEl) badgeEl.textContent = data.scoreBadge;
  if (circleEl) {
    circleEl.style.borderColor = data.scoreColor;
    circleEl.style.boxShadow = `0 0 16px ${data.scoreColor}44`;
  }

  // AI Recommendation Cards
  const insightsListEl = document.getElementById('aiInsightsList');
  if (insightsListEl && data.insights && data.insights.length > 0) {
    insightsListEl.innerHTML = data.insights.map(i => `
      <div class="ai-insight-card ${i.type}">
        <div class="ai-insight-icon">${i.icon}</div>
        <div class="ai-insight-content">
          <div class="ai-insight-title-row">
            <span class="ai-insight-title">${i.title}</span>
            ${i.badge ? `<span class="ai-insight-badge">${i.badge}</span>` : ''}
          </div>
          <p class="ai-insight-desc">${i.description}</p>
        </div>
      </div>
    `).join('');
  }

  // Anomaly Detection Box
  const anomalyBox = document.getElementById('anomalyAlertBox');
  const anomalyList = document.getElementById('anomalyList');
  if (anomalyBox && anomalyList) {
    if (data.anomalies && data.anomalies.length > 0) {
      anomalyBox.classList.remove('hidden');
      anomalyList.innerHTML = data.anomalies.map(a => `
        <div class="anomaly-item">
          <span><strong>${getCategoryIcon(a.category)} ${a.category}</strong> (${formatDate(a.date)}) — ${a.note}</span>
          <span style="font-weight:700;color:var(--color-expense)">${formatCurrency(a.amount)} (${a.ratio}x avg)</span>
        </div>
      `).join('');
    } else {
      anomalyBox.classList.add('hidden');
    }
  }
}

// ─── Greeting ───────────────────────────────────────────────
function updateGreeting() {
  const user = getUser();
  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const el = document.getElementById('greetingText');
  if (el && user) {
    el.textContent = `${greeting}, ${user.name.split(' ')[0]}! Here's your financial overview.`;
  }
}
