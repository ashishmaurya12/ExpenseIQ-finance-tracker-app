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
  populateDashboardCategoryDropdown();
  attachDashboardModalListeners();
  
  const monthSelect = document.getElementById('dashboardMonthSelect');
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      loadDashboard(monthSelect.value);
    });
  }

  loadDashboard();

  window.addEventListener('themeChanged', () => {
    const selectedMonth = monthSelect ? monthSelect.value : null;
    loadDashboard(selectedMonth);
  });
});

function populateDashboardCategoryDropdown() {
  const txnCat = document.getElementById('txnCategory');
  if (!txnCat) return;
  txnCat.innerHTML = '';
  CATEGORIES.forEach(cat => {
    txnCat.insertAdjacentHTML('beforeend',
      `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`
    );
  });
}

function attachDashboardModalListeners() {
  const modalClose = document.getElementById('modalClose');
  const btnCancel = document.getElementById('btnCancelTxn');
  const modalOverlay = document.getElementById('transactionModal');
  const btnSave = document.getElementById('btnSaveTxn');

  if (modalClose) modalClose.addEventListener('click', () => closeModal('transactionModal'));
  if (btnCancel) btnCancel.addEventListener('click', () => closeModal('transactionModal'));
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) closeModal('transactionModal');
    });
  }
  if (btnSave) btnSave.addEventListener('click', handleDashboardSave);

  const form = document.getElementById('transactionForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleDashboardSave();
    });
  }
}

async function loadDashboard(selectedMonth = null) {
  try {
    const monthSelect = document.getElementById('dashboardMonthSelect');
    const monthToFetch = selectedMonth !== null ? selectedMonth : (monthSelect ? monthSelect.value : null);

    const [summaryData, transactionsData, insightsData] = await Promise.all([
      apiGetSummary(monthToFetch && monthToFetch !== 'all' ? monthToFetch : null),
      apiGetTransactions(monthToFetch && monthToFetch !== 'all' ? { month: monthToFetch } : {}),
      apiGetInsights().catch(() => null)
    ]);

    populateDashboardMonthDropdown(summaryData.availableMonths, summaryData.selectedMonth || monthToFetch);
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
    loadDashboardPhase4AWidgets();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function populateDashboardMonthDropdown(availableMonths, selectedMonth) {
  const monthSelect = document.getElementById('dashboardMonthSelect');
  if (!monthSelect || !availableMonths || availableMonths.length === 0) return;

  const currentValue = selectedMonth || monthSelect.value || 'all';
  monthSelect.innerHTML = '<option value="all">All Time / Combined</option>';

  availableMonths.forEach(m => {
    const label = formatMonthYear(m);
    const isSelected = m === currentValue ? 'selected' : '';
    monthSelect.insertAdjacentHTML('beforeend',
      `<option value="${m}" ${isSelected}>${label}</option>`
    );
  });
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

  const canvas = document.getElementById('categoryChart');
  canvas.style.display = 'block';
  document.getElementById('pieEmpty').classList.add('hidden');
  const ctx = canvas.getContext('2d');

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
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#475569',
            padding: 16,
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(226, 232, 240, 0.2)',
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

  const canvas = document.getElementById('monthlyChart');
  canvas.style.display = 'block';
  document.getElementById('barEmpty').classList.add('hidden');

  const labels = monthlyData.map(m => formatMonthYear(m.month));
  const incomeData = monthlyData.map(m => m.income);
  const expenseData = monthlyData.map(m => m.expense);

  const ctx = canvas.getContext('2d');

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
          backgroundColor: 'rgba(0, 201, 167, 0.8)',
          borderColor: '#00C9A7',
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false
        },
        {
          label: 'Expenses',
          data: expenseData,
          backgroundColor: 'rgba(244, 63, 94, 0.8)',
          borderColor: '#F43F5E',
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
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
        delay: (context) => (context.type === 'data' && context.mode === 'default' && !context.dropped) ? context.dataIndex * 100 : 0
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: 'Inter', size: 11 }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(15, 23, 42, 0.06)',
            drawBorder: false
          },
          ticks: {
            color: '#64748B',
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
            color: '#475569',
            font: { family: 'Inter', size: 12 },
            usePointStyle: true,
            pointStyleWidth: 8,
            padding: 16
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(226, 232, 240, 0.2)',
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
        borderColor: '#F43F5E',
        backgroundColor: 'rgba(244, 63, 94, 0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: '#F43F5E'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: { intersect: false, mode: 'index' },
      animation: {
        duration: 1200,
        easing: 'easeOutQuart',
        delay: (context) => (context.type === 'data' && context.mode === 'default' && !context.dropped) ? context.dataIndex * 35 : 0
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748B',
            font: { family: 'Inter', size: 10 },
            maxTicksLimit: 10
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(15, 23, 42, 0.06)' },
          ticks: {
            color: '#64748B',
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
          backgroundColor: '#0F172A',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(226, 232, 240, 0.2)',
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
          '#00C9A7',
          '#6366F1',
          '#8B5CF6',
          '#F97316',
          '#06B6D4'
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        animateScale: true,
        animateRotate: true,
        duration: 1200,
        easing: 'easeOutQuart'
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#475569',
            padding: 14,
            font: { family: 'Inter', size: 11 },
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          borderColor: 'rgba(226, 232, 240, 0.2)',
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
        <td colspan="6" class="text-center text-muted" style="padding:32px">
          No transactions yet. <a href="/transactions.html">Add your first one</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr data-id="${escapeHTML(t.id)}">
      <td>${formatDate(t.date)}</td>
      <td><span class="badge badge-${t.type === 'income' ? 'income' : 'expense'}">${escapeHTML(t.type)}</span></td>
      <td>${getCategoryIcon(t.category)} ${escapeHTML(t.category)}</td>
      <td class="text-muted">${t.note ? escapeHTML(t.note) : '—'}</td>
      <td style="text-align:right">
        <span class="amount ${t.type === 'income' ? 'income' : 'expense'}">
          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
        </span>
      </td>
      <td style="text-align:center">
        <div class="table-actions" style="justify-content:center">
          <button class="btn-icon edit" title="Edit" onclick="handleDashboardEdit('${escapeHTML(t.id)}')">✏️</button>
          <button class="btn-icon delete" title="Delete" onclick="handleDashboardDelete('${escapeHTML(t.id)}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function handleDashboardEdit(id) {
  try {
    const data = await apiGetTransactions();
    const txn = data.transactions.find(t => t.id === id);
    if (!txn) {
      showToast('Transaction not found.', 'error');
      return;
    }

    document.getElementById('txnId').value = txn.id;
    document.getElementById('txnAmount').value = txn.amount;
    document.getElementById('txnDate').value = txn.date;
    document.getElementById('txnCategory').value = txn.category;
    document.getElementById('txnNote').value = txn.note || '';
    document.getElementById('txnError').style.display = 'none';

    if (txn.type === 'income') {
      document.getElementById('typeIncome').checked = true;
    } else {
      document.getElementById('typeExpense').checked = true;
    }

    document.getElementById('modalTitle').textContent = 'Edit Transaction';
    document.getElementById('btnSaveTxn').textContent = 'Update Transaction';
    openModal('transactionModal');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleDashboardDelete(id) {
  showConfirm('Are you sure you want to delete this transaction? This cannot be undone.', async () => {
    try {
      await apiDeleteTransaction(id);
      showToast('Transaction deleted.', 'success');
      loadDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function handleDashboardSave() {
  const errorEl = document.getElementById('txnError');
  const btn = document.getElementById('btnSaveTxn');
  const idEl = document.getElementById('txnId');
  const id = idEl ? idEl.value : '';
  const typeEl = document.querySelector('input[name="txnType"]:checked');
  const type = typeEl ? typeEl.value : 'expense';
  const amount = document.getElementById('txnAmount').value;
  const category = document.getElementById('txnCategory').value;
  const date = document.getElementById('txnDate').value;
  const note = document.getElementById('txnNote').value.trim();

  if (!amount || Number(amount) <= 0) {
    errorEl.textContent = 'Please enter a valid amount.';
    errorEl.style.display = 'block';
    return;
  }
  if (!category) {
    errorEl.textContent = 'Please select a category.';
    errorEl.style.display = 'block';
    return;
  }
  if (!date) {
    errorEl.textContent = 'Please select a date.';
    errorEl.style.display = 'block';
    return;
  }

  const payload = { type, amount: Number(amount), category, date, note };

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    errorEl.style.display = 'none';

    if (id) {
      await apiUpdateTransaction(id, payload);
      showToast('Transaction updated!', 'success');
    } else {
      await apiCreateTransaction(payload);
      showToast('Transaction added!', 'success');
    }

    closeModal('transactionModal');
    loadDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Update Transaction' : 'Save Transaction';
  }
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
      <div class="ai-insight-card ${escapeHTML(i.type)}">
        <div class="ai-insight-icon">${i.icon}</div>
        <div class="ai-insight-content">
          <div class="ai-insight-title-row">
            <span class="ai-insight-title">${escapeHTML(i.title)}</span>
            ${i.badge ? `<span class="ai-insight-badge">${escapeHTML(i.badge)}</span>` : ''}
          </div>
          <p class="ai-insight-desc">${escapeHTML(i.description)}</p>
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
          <span><strong>${getCategoryIcon(a.category)} ${escapeHTML(a.category)}</strong> (${formatDate(a.date)}) — ${escapeHTML(a.note)}</span>
          <span style="font-weight:700;color:var(--color-expense)">${formatCurrency(a.amount)} (${a.ratio}x avg)</span>
        </div>
      `).join('');
    } else {
      anomalyBox.classList.add('hidden');
    }
  }

  // Bind Generate AI Insights button
  const btnAiInsights = document.getElementById('btnGenerateAiInsights');
  if (btnAiInsights) {
    btnAiInsights.addEventListener('click', async () => {
      const originalText = btnAiInsights.textContent;
      btnAiInsights.disabled = true;
      btnAiInsights.textContent = '⏳ Generating...';
      try {
        const res = await apiGetAiInsights();
        if (res && res.success && Array.isArray(res.insights)) {
          const insightsListEl = document.getElementById('aiInsightsList');
          if (insightsListEl) {
            insightsListEl.innerHTML = res.insights.map(i => `
              <div class="ai-insight-card positive" style="border-left: 3px solid var(--accent-purple);">
                <div class="ai-insight-icon">🤖</div>
                <div class="ai-insight-content">
                  <div class="ai-insight-title-row">
                    <span class="ai-insight-title">${escapeHTML(i.title)}</span>
                    <span class="ai-insight-badge" style="background:var(--accent-purple);color:#fff">${escapeHTML(i.category || 'AI')}</span>
                  </div>
                  <p class="ai-insight-desc">${escapeHTML(i.description)}</p>
                </div>
              </div>
            `).join('');
          }
        }
      } catch (err) {
        alert(err.message || 'AI insights temporarily unavailable.');
      } finally {
        btnAiInsights.disabled = false;
        btnAiInsights.textContent = originalText;
      }
    });
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

// ─── Phase 4A Intelligence Widgets ─────────────────────────
async function loadDashboardPhase4AWidgets() {
  const billsContainer = document.getElementById('dashUpcomingBillsList');
  const notifsContainer = document.getElementById('dashRecentNotificationsList');
  const recurringContainer = document.getElementById('dashRecurringList');

  // 1. Upcoming Dues
  if (billsContainer && typeof apiGetReminders === 'function') {
    try {
      const res = await apiGetReminders({ limit: 4 });
      const items = (res.reminders || []).slice(0, 4);
      if (items.length === 0) {
        billsContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">No upcoming bill dues.</div>';
      } else {
        const todayStr = new Date().toISOString().slice(0, 10);
        billsContainer.innerHTML = items.map(r => {
          const isOverdue = r.status === 'overdue' || (r.status === 'pending' && r.dueDate < todayStr);
          const color = isOverdue ? '#ef4444' : r.dueDate === todayStr ? '#f59e0b' : 'inherit';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-color)">
              <div style="min-width:0;flex:1;margin-right:8px">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(r.title)}</div>
                <div style="font-size:0.75rem;color:${color}">Due: ${escapeHTML(r.dueDate)}</div>
              </div>
              <div style="font-weight:700;flex-shrink:0">₹${Number(r.amount).toLocaleString('en-IN')}</div>
            </div>
          `;
        }).join('');
      }
    } catch {
      billsContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">Unable to load dues.</div>';
    }
  }

  // 2. Recent Notifications
  if (notifsContainer && typeof apiGetNotifications === 'function') {
    try {
      const res = await apiGetNotifications({ limit: 4 });
      const items = (res.notifications || []).slice(0, 4);
      if (items.length === 0) {
        notifsContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">No recent notifications.</div>';
      } else {
        notifsContainer.innerHTML = items.map(n => {
          return `
            <div style="display:flex;gap:8px;align-items:flex-start;font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-color)">
              <span style="font-size:0.85rem;line-height:1;margin-top:2px">${!n.read ? '🔵' : '⚪'}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(n.title)}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(n.message)}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    } catch {
      notifsContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">Unable to load notifications.</div>';
    }
  }

  // 3. Recurring Payments
  if (recurringContainer && typeof apiGetRecurringTransactions === 'function') {
    try {
      const res = await apiGetRecurringTransactions({ limit: 4 });
      const items = (res.recurring || []).filter(i => i.active).slice(0, 4);
      if (items.length === 0) {
        recurringContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">No active recurring schedules.</div>';
      } else {
        recurringContainer.innerHTML = items.map(rec => {
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.85rem;padding:6px 0;border-bottom:1px solid var(--border-color)">
              <div style="min-width:0;flex:1;margin-right:8px">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(rec.description || rec.category)}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary);text-transform:capitalize">${escapeHTML(rec.frequency)} • Next: ${escapeHTML(rec.nextDueDate)}</div>
              </div>
              <div style="font-weight:700;color:${rec.type === 'income' ? '#10b981' : 'inherit'};flex-shrink:0">₹${Number(rec.amount).toLocaleString('en-IN')}</div>
            </div>
          `;
        }).join('');
      }
    } catch {
      recurringContainer.innerHTML = '<div class="text-muted" style="font-size:0.85rem;padding:8px 0">Unable to load recurring schedules.</div>';
    }
  }
}
