/**
 * ExpenseIQ — Transactions Page Logic
 * CRUD operations, filters, and table rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('transactions');
  populateCategoryDropdowns();
  setDefaultDate();
  attachEventListeners();
  loadTransactions();
});

// ─── Populate Category Dropdowns ────────────────────────────
function populateCategoryDropdowns() {
  const filterCat = document.getElementById('filterCategory');
  const txnCat = document.getElementById('txnCategory');

  CATEGORIES.forEach(cat => {
    filterCat.insertAdjacentHTML('beforeend',
      `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`
    );
    txnCat.insertAdjacentHTML('beforeend',
      `<option value="${cat}">${getCategoryIcon(cat)} ${cat}</option>`
    );
  });
}

function setDefaultDate() {
  document.getElementById('txnDate').value = getTodayISO();
}

// ─── Event Listeners ────────────────────────────────────────
function attachEventListeners() {
  // Add button → open modal
  document.getElementById('btnAddTransaction').addEventListener('click', () => {
    resetForm();
    document.getElementById('modalTitle').textContent = 'Add Transaction';
    document.getElementById('btnSaveTxn').textContent = 'Save Transaction';
    openModal('transactionModal');
  });

  // Close modal
  document.getElementById('modalClose').addEventListener('click', () => closeModal('transactionModal'));
  document.getElementById('btnCancelTxn').addEventListener('click', () => closeModal('transactionModal'));

  // Click outside modal to close
  document.getElementById('transactionModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal('transactionModal');
  });

  // Save
  document.getElementById('btnSaveTxn').addEventListener('click', handleSave);

  // Form submit (Enter key)
  document.getElementById('transactionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });

  // Filters
  const filterHandler = debounce(loadTransactions, 400);
  document.getElementById('filterType').addEventListener('change', filterHandler);
  document.getElementById('filterCategory').addEventListener('change', filterHandler);
  document.getElementById('filterFrom').addEventListener('change', filterHandler);
  document.getElementById('filterTo').addEventListener('change', filterHandler);

  // Export CSV
  document.getElementById('btnExportCSV').addEventListener('click', async () => {
    try {
      const filters = {
        type: document.getElementById('filterType').value,
        category: document.getElementById('filterCategory').value,
        from: document.getElementById('filterFrom').value,
        to: document.getElementById('filterTo').value
      };
      const data = await apiGetTransactions(filters);
      if (!data.transactions || data.transactions.length === 0) {
        showToast('No transactions to export.', 'info');
        return;
      }
      exportToCSV(data.transactions, `expenseiq_transactions_${getTodayISO()}.csv`);
      showToast('CSV export downloaded!', 'success');
    } catch (err) {
      showToast('Failed to export CSV: ' + err.message, 'error');
    }
  });

  // Clear filters
  document.getElementById('btnClearFilters').addEventListener('click', () => {
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    loadTransactions();
  });
}

let myTxnChart = null;

// ─── Load & Render Transactions ─────────────────────────────
async function loadTransactions() {
  const filters = {
    type: document.getElementById('filterType').value,
    category: document.getElementById('filterCategory').value,
    from: document.getElementById('filterFrom').value,
    to: document.getElementById('filterTo').value
  };

  try {
    const data = await apiGetTransactions(filters);
    renderTable(data.transactions);
    renderTxnChart(data.transactions);
    document.getElementById('transactionCount').textContent =
      `${data.count} transaction${data.count !== 1 ? 's' : ''} found`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTxnChart(transactions) {
  const card = document.getElementById('txnChartCard');
  const canvas = document.getElementById('txnCategoryChart');
  if (!card || !canvas) return;

  if (!transactions || transactions.length === 0) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  // Group amounts by category
  const breakdown = {};
  transactions.forEach(t => {
    const cat = (t.category || 'Other').trim();
    breakdown[cat] = (breakdown[cat] || 0) + (Number(t.amount) || 0);
  });

  const categories = Object.keys(breakdown);
  const values = Object.values(breakdown);

  const ctx = canvas.getContext('2d');
  if (myTxnChart && typeof myTxnChart.destroy === 'function') {
    myTxnChart.destroy();
  }

  myTxnChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: categories,
      datasets: [{
        label: 'Total Amount (₹)',
        data: values,
        backgroundColor: CHART_COLORS.slice(0, categories.length),
        borderRadius: 6
      }]
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + Number(b), 0);
              const pct = total > 0 ? Math.round((ctx.parsed.y / total) * 100) : 0;
              return ` Amount: ${formatCurrency(ctx.parsed.y)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderTable(transactions) {
  const tbody = document.getElementById('transactionsBody');

  if (transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-icon">💳</div>
            <p>No transactions found. Click "+ Add Transaction" to get started.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = transactions.map(t => `
    <tr data-id="${t.id}">
      <td>${formatDate(t.date)}</td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td>${getCategoryIcon(t.category)} ${t.category}</td>
      <td class="text-muted">${t.note || '—'}</td>
      <td style="text-align:right">
        <span class="amount ${t.type}">
          ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
        </span>
      </td>
      <td style="text-align:center">
        <div class="table-actions" style="justify-content:center">
          <button class="btn-icon edit" title="Edit" onclick="handleEdit('${t.id}')">✏️</button>
          <button class="btn-icon delete" title="Delete" onclick="handleDelete('${t.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── Save (Create or Update) ────────────────────────────────
async function handleSave() {
  const errorEl = document.getElementById('txnError');
  const btn = document.getElementById('btnSaveTxn');
  const id = document.getElementById('txnId').value;
  const type = document.querySelector('input[name="txnType"]:checked').value;
  const amount = document.getElementById('txnAmount').value;
  const category = document.getElementById('txnCategory').value;
  const date = document.getElementById('txnDate').value;
  const note = document.getElementById('txnNote').value.trim();

  // Validate
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
    loadTransactions();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Update Transaction' : 'Save Transaction';
  }
}

// ─── Edit ───────────────────────────────────────────────────
async function handleEdit(id) {
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

    // Set type toggle
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

// ─── Delete ─────────────────────────────────────────────────
function handleDelete(id) {
  showConfirm('Are you sure you want to delete this transaction? This cannot be undone.', async () => {
    try {
      await apiDeleteTransaction(id);
      showToast('Transaction deleted.', 'success');
      loadTransactions();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Reset Form ─────────────────────────────────────────────
function resetForm() {
  document.getElementById('txnId').value = '';
  document.getElementById('txnAmount').value = '';
  document.getElementById('txnDate').value = getTodayISO();
  document.getElementById('txnCategory').value = CATEGORIES[0];
  document.getElementById('txnNote').value = '';
  document.getElementById('typeExpense').checked = true;
  document.getElementById('txnError').style.display = 'none';
}
