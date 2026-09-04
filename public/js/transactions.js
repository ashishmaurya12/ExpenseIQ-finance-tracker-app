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

  // Check URL query parameters for action=add
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('action') === 'add' || urlParams.has('add')) {
    const type = urlParams.get('type') || 'income';
    window.openAddTransactionModal(type);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
});

// ─── Global Quick Add Trigger ────────────────────────────────
window.openAddTransactionModal = function(defaultType = 'income') {
  resetForm(defaultType);
  const isIncome = defaultType === 'income';
  document.getElementById('modalTitle').textContent = isIncome ? 'Add Income' : 'Add Transaction';
  document.getElementById('btnSaveTxn').textContent = 'Save Transaction';
  openModal('transactionModal');
};

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
    window.openAddTransactionModal('expense');
  });

  // Close modal
  document.getElementById('modalClose').addEventListener('click', () => {
    closeModal('transactionModal');
    resetForm();
  });
  document.getElementById('btnCancelTxn').addEventListener('click', () => {
    closeModal('transactionModal');
    resetForm();
  });

  // Click outside modal to close
  document.getElementById('transactionModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeModal('transactionModal');
      resetForm();
    }
  });

  // Save
  document.getElementById('btnSaveTxn').addEventListener('click', handleSave);

  // Form submit (Enter key)
  document.getElementById('transactionForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave();
  });

  // Filters & Search
  const filterResetHandler = debounce(() => {
    currentPage = 1;
    loadTransactions();
  }, 400);

  const filterSearchEl = document.getElementById('filterSearch');
  if (filterSearchEl) filterSearchEl.addEventListener('input', filterResetHandler);

  const filterMonthEl = document.getElementById('filterMonth');
  if (filterMonthEl) filterMonthEl.addEventListener('change', filterResetHandler);
  document.getElementById('filterType').addEventListener('change', filterResetHandler);
  document.getElementById('filterCategory').addEventListener('change', filterResetHandler);
  document.getElementById('filterFrom').addEventListener('change', filterResetHandler);
  document.getElementById('filterTo').addEventListener('change', filterResetHandler);

  // Pagination buttons
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadTransactions();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      currentPage++;
      loadTransactions();
    });
  }

  // Export CSV
  document.getElementById('btnExportCSV')?.addEventListener('click', async () => {
    try {
      const filters = {
        month: document.getElementById('filterMonth')?.value || '',
        type: document.getElementById('filterType').value,
        category: document.getElementById('filterCategory').value,
        from: document.getElementById('filterFrom').value,
        to: document.getElementById('filterTo').value,
        search: document.getElementById('filterSearch')?.value || ''
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

  // Export PDF
  document.getElementById('btnExportPDF')?.addEventListener('click', async () => {
    try {
      const filters = {
        month: document.getElementById('filterMonth')?.value || '',
        type: document.getElementById('filterType').value,
        category: document.getElementById('filterCategory').value,
        from: document.getElementById('filterFrom').value,
        to: document.getElementById('filterTo').value,
        search: document.getElementById('filterSearch')?.value || ''
      };
      const data = await apiGetTransactions(filters);
      if (!data.transactions || data.transactions.length === 0) {
        showToast('No transactions to print.', 'info');
        return;
      }
      exportToPDF(data.transactions, 'ExpenseIQ Transactions Report');
    } catch (err) {
      showToast('Failed to export PDF: ' + err.message, 'error');
    }
  });

  // Clear filters
  document.getElementById('btnClearFilters').addEventListener('click', () => {
    const filterSearch = document.getElementById('filterSearch');
    if (filterSearch) filterSearch.value = '';
    const filterMonth = document.getElementById('filterMonth');
    if (filterMonth) filterMonth.value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterFrom').value = '';
    document.getElementById('filterTo').value = '';
    currentPage = 1;
    loadTransactions();
  });
}

let myTxnChart = null;
let availableMonthsLoaded = false;
let currentPage = 1;
const itemsPerPage = 10;

// ─── Load & Render Transactions ─────────────────────────────
async function loadTransactions() {
  const monthVal = document.getElementById('filterMonth')?.value || '';
  const searchVal = document.getElementById('filterSearch')?.value || '';
  const filters = {
    month: monthVal,
    type: document.getElementById('filterType').value,
    category: document.getElementById('filterCategory').value,
    from: document.getElementById('filterFrom').value,
    to: document.getElementById('filterTo').value,
    search: searchVal,
    page: currentPage,
    limit: itemsPerPage
  };

  const tbody = document.getElementById('transactionsBody');
  if (tbody && (!dataTransactionsLoadedOnce)) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted" style="padding:32px"><span class="spinner"></span> Loading transactions...</td></tr>`;
  }

  try {
    const data = await apiGetTransactions(filters);
    dataTransactionsLoadedOnce = true;
    renderTable(data.transactions || []);
    renderTxnChart(data.transactions || []);
    renderPaginationControls(data.pagination, data.count || 0);

    // Populate available months if not yet populated
    if (!availableMonthsLoaded) {
      apiGetSummary().then(summary => {
        if (summary && summary.availableMonths) {
          populateTxnMonthDropdown(summary.availableMonths, monthVal);
          availableMonthsLoaded = true;
        }
      }).catch(() => {});
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

let dataTransactionsLoadedOnce = false;

function renderPaginationControls(pagination, currentCount) {
  const countEl = document.getElementById('transactionCount');
  const infoEl = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');

  if (!pagination) {
    if (countEl) countEl.textContent = `${currentCount} transaction${currentCount !== 1 ? 's' : ''} found`;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    if (infoEl) infoEl.textContent = 'Page 1 of 1';
    return;
  }

  const { page, totalPages, total, hasNextPage, hasPreviousPage } = pagination;
  currentPage = page;

  if (countEl) {
    const start = total === 0 ? 0 : (page - 1) * itemsPerPage + 1;
    const end = Math.min(page * itemsPerPage, total);
    countEl.textContent = total === 0 ? 'No transactions found' : `Showing ${start}–${end} of ${total} transactions`;
  }

  if (infoEl) infoEl.textContent = `Page ${page} of ${totalPages || 1}`;
  if (prevBtn) prevBtn.disabled = !hasPreviousPage;
  if (nextBtn) nextBtn.disabled = !hasNextPage;
}

function populateTxnMonthDropdown(availableMonths, selectedMonth) {
  const monthSelect = document.getElementById('filterMonth');
  if (!monthSelect || !availableMonths) return;

  const currentVal = selectedMonth || monthSelect.value || '';
  monthSelect.innerHTML = '<option value="">All Months</option>';

  availableMonths.forEach(m => {
    const label = formatMonthYear(m);
    const isSelected = m === currentVal ? 'selected' : '';
    monthSelect.insertAdjacentHTML('beforeend',
      `<option value="${m}" ${isSelected}>${label}</option>`
    );
  });
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
        borderRadius: 8,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 1000,
        easing: 'easeOutQuart',
        delay: (context) => (context.type === 'data' && context.mode === 'default' && !context.dropped) ? context.dataIndex * 90 : 0
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#64748B', font: { family: 'Plus Jakarta Sans', weight: '600' } } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { family: 'Plus Jakarta Sans' }, callback: v => '₹' + v }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0F172A',
          titleFont: { family: 'Plus Jakarta Sans', weight: '700' },
          bodyFont: { family: 'Plus Jakarta Sans' },
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          cornerRadius: 10,
          padding: 12,
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
          <button class="btn-icon edit" title="Edit" onclick="handleEdit('${escapeHTML(t.id)}')">✏️</button>
          <button class="btn-icon delete" title="Delete" onclick="handleDelete('${escapeHTML(t.id)}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ─── Save (Create or Update) ────────────────────────────────
async function handleSave() {
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
    resetForm();
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
function resetForm(defaultType = 'expense') {
  const txnIdEl = document.getElementById('txnId');
  if (txnIdEl) txnIdEl.value = '';

  const amountEl = document.getElementById('txnAmount');
  if (amountEl) amountEl.value = '';

  const dateEl = document.getElementById('txnDate');
  if (dateEl) dateEl.value = getTodayISO();

  const catEl = document.getElementById('txnCategory');
  if (catEl && CATEGORIES && CATEGORIES.length > 0) catEl.value = CATEGORIES[0];

  const noteEl = document.getElementById('txnNote');
  if (noteEl) noteEl.value = '';

  if (defaultType === 'income') {
    const typeInc = document.getElementById('typeIncome');
    if (typeInc) typeInc.checked = true;
  } else {
    const typeExp = document.getElementById('typeExpense');
    if (typeExp) typeExp.checked = true;
  }

  const errEl = document.getElementById('txnError');
  if (errEl) errEl.style.display = 'none';
}
