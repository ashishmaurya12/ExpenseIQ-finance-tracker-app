/**
 * ExpenseIQ — Budgets Page Logic
 * CRUD operations and progress bar rendering.
 */

let allBudgets = [];
let myBudgetChart = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('budgets');
  attachBudgetListeners();
  loadBudgets();
});

let availableBudgetMonthsLoaded = false;

// ─── Event Listeners ────────────────────────────────────────
function attachBudgetListeners() {
  const monthSelect = document.getElementById('budgetMonthSelect');
  if (monthSelect) {
    monthSelect.addEventListener('change', () => {
      loadBudgets(monthSelect.value);
    });
  }

  document.getElementById('btnAddBudget').addEventListener('click', () => {
    resetBudgetForm();
    populateBudgetCategories();
    document.getElementById('budgetModalTitle').textContent = 'Add Budget';
    document.getElementById('btnSaveBudget').textContent = 'Save Budget';
    openModal('budgetModal');
  });

  document.getElementById('budgetModalClose').addEventListener('click', () => closeModal('budgetModal'));
  document.getElementById('btnCancelBudget').addEventListener('click', () => closeModal('budgetModal'));

  document.getElementById('budgetModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal('budgetModal');
  });

  document.getElementById('btnSaveBudget').addEventListener('click', handleSaveBudget);

  document.getElementById('budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveBudget();
  });
}

// ─── Populate Category Dropdown ─────────────────────────────
function populateBudgetCategories(excludeCategory) {
  const select = document.getElementById('budgetCategory');
  select.innerHTML = '';

  // Only show expense-type categories, excluding ones that already have a budget
  const usedCategories = allBudgets
    .filter(b => b.category !== excludeCategory)
    .map(b => b.category);

  const expenseCategories = CATEGORIES.filter(c =>
    !['Salary', 'Freelance', 'Investment'].includes(c)
  );

  const available = expenseCategories.filter(c => !usedCategories.includes(c));

  if (available.length === 0) {
    select.innerHTML = '<option value="">No categories available</option>';
    return;
  }

  available.forEach(cat => {
    select.insertAdjacentHTML('beforeend',
      `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`
    );
  });
}

// ─── Load & Render Budgets ──────────────────────────────────
async function loadBudgets(selectedMonth = null) {
  const monthSelect = document.getElementById('budgetMonthSelect');
  const monthToFetch = selectedMonth !== null ? selectedMonth : (monthSelect ? monthSelect.value : null);

  try {
    const data = await apiGetBudgets(monthToFetch || null);
    allBudgets = data.budgets || [];
    renderBudgets(allBudgets);
    renderBudgetSummary(allBudgets, data.totalBudget, data.totalSpent);
    renderBudgetChart(allBudgets);

    if (!availableBudgetMonthsLoaded) {
      apiGetSummary().then(summary => {
        if (summary && summary.availableMonths) {
          populateBudgetMonthDropdown(summary.availableMonths, monthToFetch);
          availableBudgetMonthsLoaded = true;
        }
      }).catch(() => {});
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function populateBudgetMonthDropdown(availableMonths, selectedMonth) {
  const monthSelect = document.getElementById('budgetMonthSelect');
  if (!monthSelect || !availableMonths) return;

  const currentVal = selectedMonth || monthSelect.value || '';
  monthSelect.innerHTML = '<option value="">Current Month</option>';

  availableMonths.forEach(m => {
    const label = formatMonthYear(m);
    const isSelected = m === currentVal ? 'selected' : '';
    monthSelect.insertAdjacentHTML('beforeend',
      `<option value="${m}" ${isSelected}>${label}</option>`
    );
  });
}

function renderBudgets(budgets) {
  const grid = document.getElementById('budgetGrid');

  if (budgets.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1">
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>No budgets set yet. Click "+ Add Budget" to start managing your spending limits.</p>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = budgets.map(budget => {
    const spent = Number(budget.spent) || 0;
    const limit = Number(budget.monthlyLimit) || 0;
    const percentUsed = budget.percentUsed || (limit > 0 ? Math.round((spent / limit) * 100) : 0);
    const statusClass = percentUsed >= 90 ? 'danger' : percentUsed >= 75 ? 'warning' : 'safe';

    return `
      <div class="budget-card" data-id="${escapeHTML(budget.id)}">
        <div class="budget-card-header">
          <div class="budget-category">
            <div class="budget-category-icon">${getCategoryIcon(budget.category)}</div>
            <span class="budget-category-name">${escapeHTML(budget.category)}</span>
          </div>
          <div class="table-actions">
            <button class="btn-icon edit" title="Edit" onclick="handleEditBudget('${escapeHTML(budget.id)}')">✏️</button>
            <button class="btn-icon delete" title="Delete" onclick="handleDeleteBudget('${escapeHTML(budget.id)}')">🗑️</button>
          </div>
        </div>

        <div class="progress-bar-container">
          <div class="progress-bar-fill ${statusClass}" style="width:${Math.min(percentUsed, 100)}%; animation: progressFill 0.8s ease-out"></div>
        </div>

        <div class="budget-amounts">
          <span>
            <span class="budget-spent">${formatCurrency(spent)}</span>
            <span class="text-muted"> / ${formatCurrency(limit)}</span>
          </span>
          <span class="budget-percent ${statusClass}">${percentUsed}%</span>
        </div>

        <div class="text-muted mt-sm" style="font-size:0.78rem">
          ${(limit - spent) >= 0
            ? `₹${(limit - spent).toLocaleString('en-IN')} remaining this month`
            : `<span class="text-expense">Over budget by ₹${Math.abs(limit - spent).toLocaleString('en-IN')}</span>`
          }
        </div>
      </div>
    `;
  }).join('');
}

function renderBudgetSummary(budgets, apiTotalBudget, apiTotalSpent) {
  const totalBudget = apiTotalBudget !== undefined ? apiTotalBudget : budgets.reduce((sum, b) => sum + (Number(b.monthlyLimit) || 0), 0);
  const totalSpent = apiTotalSpent !== undefined ? apiTotalSpent : budgets.reduce((sum, b) => sum + (Number(b.spent) || 0), 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent);

  animateValue(document.getElementById('totalBudget'), 0, totalBudget);
  animateValue(document.getElementById('totalSpent'), 0, totalSpent);
  animateValue(document.getElementById('totalRemaining'), 0, totalRemaining);
}

// ─── Budget Comparison Chart ────────────────────────────────
function renderBudgetChart(budgets) {
  const card = document.getElementById('budgetChartCard');
  const canvas = document.getElementById('budgetComparisonChart');
  if (!card || !canvas) return;

  if (!budgets || budgets.length === 0) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  const labels = budgets.map(b => b.category);
  const limits = budgets.map(b => Number(b.monthlyLimit) || 0);
  const spents = budgets.map(b => Number(b.spent) || 0);

  const ctx = canvas.getContext('2d');
  if (myBudgetChart && typeof myBudgetChart.destroy === 'function') {
    myBudgetChart.destroy();
  }

  myBudgetChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Monthly Limit',
          data: limits,
          backgroundColor: 'hsla(220, 90%, 65%, 0.7)',
          borderColor: 'hsl(220, 90%, 65%)',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Actual Spent',
          data: spents,
          backgroundColor: 'hsla(0, 85%, 62%, 0.7)',
          borderColor: 'hsl(0, 85%, 62%)',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: 'hsl(220, 15%, 55%)' } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'hsl(220, 15%, 55%)', callback: v => '₹' + v }
        }
      },
      plugins: {
        legend: { labels: { color: 'hsl(220, 15%, 60%)', usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              const limit = Number(budgets[ctx.dataIndex]?.monthlyLimit) || val;
              const pct = limit > 0 ? Math.round((val / limit) * 100) : 0;
              return ` ${ctx.dataset.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ─── Save Budget ────────────────────────────────────────────
async function handleSaveBudget() {
  const errorEl = document.getElementById('budgetError');
  const btn = document.getElementById('btnSaveBudget');
  const id = document.getElementById('budgetId').value;
  const category = document.getElementById('budgetCategory').value;
  const monthlyLimit = document.getElementById('budgetLimit').value;

  if (!category) {
    errorEl.textContent = 'Please select a category.';
    errorEl.style.display = 'block';
    return;
  }
  if (!monthlyLimit || Number(monthlyLimit) <= 0) {
    errorEl.textContent = 'Please enter a valid monthly limit.';
    errorEl.style.display = 'block';
    return;
  }

  const payload = { category, monthlyLimit: Number(monthlyLimit) };

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    errorEl.style.display = 'none';

    if (id) {
      await apiUpdateBudget(id, payload);
      showToast('Budget updated!', 'success');
    } else {
      await apiCreateBudget(payload);
      showToast('Budget created!', 'success');
    }

    closeModal('budgetModal');
    loadBudgets();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Update Budget' : 'Save Budget';
  }
}

// ─── Edit Budget ────────────────────────────────────────────
function handleEditBudget(id) {
  const budget = allBudgets.find(b => b.id === id);
  if (!budget) {
    showToast('Budget not found.', 'error');
    return;
  }

  populateBudgetCategories(budget.category);

  document.getElementById('budgetId').value = budget.id;
  document.getElementById('budgetLimit').value = budget.monthlyLimit;
  document.getElementById('budgetError').style.display = 'none';

  // Add current category if not in available list
  const select = document.getElementById('budgetCategory');
  if (!Array.from(select.options).find(o => o.value === budget.category)) {
    select.insertAdjacentHTML('afterbegin',
      `<option value="${budget.category}">${getCategoryIcon(budget.category)} ${budget.category}</option>`
    );
  }
  select.value = budget.category;

  document.getElementById('budgetModalTitle').textContent = 'Edit Budget';
  document.getElementById('btnSaveBudget').textContent = 'Update Budget';
  openModal('budgetModal');
}

// ─── Delete Budget ──────────────────────────────────────────
function handleDeleteBudget(id) {
  showConfirm('Are you sure you want to delete this budget?', async () => {
    try {
      await apiDeleteBudget(id);
      showToast('Budget deleted.', 'success');
      loadBudgets();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Reset Form ─────────────────────────────────────────────
function resetBudgetForm() {
  document.getElementById('budgetId').value = '';
  document.getElementById('budgetLimit').value = '';
  document.getElementById('budgetError').style.display = 'none';
}
