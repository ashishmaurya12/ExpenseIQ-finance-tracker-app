/**
 * ExpenseIQ — Recurring Transactions Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initSidebar('recurring');
  populateCategories();
  setupEventListeners();
  await loadRecurringTransactions();
});

let recurringItems = [];

function populateCategories() {
  const select = document.getElementById('recCategory');
  if (!select) return;

  const categories = [
    'Housing', 'Transportation', 'Food & Dining', 'Utilities',
    'Healthcare', 'Entertainment', 'Shopping', 'Personal Care',
    'Education', 'Financial', 'Income', 'Other'
  ];

  select.innerHTML = categories.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');
}

function setupEventListeners() {
  document.getElementById('btnAddRecurring').addEventListener('click', () => openModal());
  document.getElementById('recurringModalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancelRecurring').addEventListener('click', closeModal);
  document.getElementById('btnSaveRecurring').addEventListener('click', handleSaveRecurring);
  document.getElementById('btnProcessDue').addEventListener('click', handleProcessDue);

  document.getElementById('recStartDate').addEventListener('change', (e) => {
    const nextDueInput = document.getElementById('recNextDueDate');
    if (nextDueInput && !nextDueInput.value) {
      nextDueInput.value = e.target.value;
    }
  });
}

async function loadRecurringTransactions() {
  const tbody = document.getElementById('recurringList');
  if (!tbody) return;

  try {
    const res = await apiGetRecurringTransactions({ limit: 50 });
    recurringItems = res.recurring || [];

    updateSummaryCards(recurringItems);

    if (recurringItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted" style="padding:48px">
            No recurring transaction schedules found. Click "+ Add Recurring" to automate bills or income.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recurringItems.map(item => {
      const typeBadge = item.type === 'income'
        ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981;font-weight:600">Income</span>`
        : `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;font-weight:600">Expense</span>`;

      const statusBadge = item.active
        ? `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981">Active</span>`
        : `<span class="badge" style="background:rgba(107,114,128,0.15);color:#6b7280">Inactive</span>`;

      const autoBadge = item.autoCreate
        ? `<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6">Enabled</span>`
        : `<span class="badge" style="background:rgba(107,114,128,0.15);color:#6b7280">Disabled</span>`;

      const formattedAmount = item.type === 'income'
        ? `+₹${Number(item.amount).toLocaleString('en-IN')}`
        : `-₹${Number(item.amount).toLocaleString('en-IN')}`;

      return `
        <tr>
          <td>
            <div style="font-weight:600">${escapeHTML(item.description || item.category)}</div>
            <div style="font-size:0.8rem;color:var(--text-secondary)">${escapeHTML(item.category)}</div>
          </td>
          <td>${typeBadge}</td>
          <td><span style="text-transform:capitalize">${escapeHTML(item.frequency)}</span></td>
          <td style="font-weight:600;color:${item.type === 'income' ? '#10b981' : 'inherit'}">${formattedAmount}</td>
          <td><span style="font-weight:600">${escapeHTML(item.nextDueDate)}</span></td>
          <td>${statusBadge}</td>
          <td>${autoBadge}</td>
          <td style="text-align:right">
            <button class="btn btn-sm btn-secondary" onclick="toggleActive('${item.id}', ${!item.active})" title="Toggle Active">
              ${item.active ? 'Pause' : 'Activate'}
            </button>
            <button class="btn btn-sm btn-secondary" onclick="openModal('${item.id}')" title="Edit">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="handleDeleteRecurring('${item.id}')" title="Delete">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center text-danger" style="padding:32px">
          Failed to load recurring transactions: ${escapeHTML(err.message)}
        </td>
      </tr>
    `;
  }
}

function updateSummaryCards(items) {
  const activeCount = items.filter(i => i.active).length;
  const autoCreateCount = items.filter(i => i.active && i.autoCreate).length;

  const activeDates = items
    .filter(i => i.active && i.nextDueDate)
    .map(i => i.nextDueDate)
    .sort();

  const earliest = activeDates.length > 0 ? activeDates[0] : '—';

  const activeEl = document.getElementById('activeCount');
  const autoEl = document.getElementById('autoCreateCount');
  const earliestEl = document.getElementById('nextDueEarliest');

  if (activeEl) activeEl.textContent = activeCount;
  if (autoEl) autoEl.textContent = autoCreateCount;
  if (earliestEl) earliestEl.textContent = earliest;
}

function openModal(id = null) {
  const modal = document.getElementById('recurringModal');
  const title = document.getElementById('recurringModalTitle');
  const form = document.getElementById('recurringForm');
  const errDiv = document.getElementById('recurringError');

  if (!modal || !form) return;

  errDiv.style.display = 'none';
  form.reset();
  document.getElementById('recurringId').value = '';

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('recStartDate').value = todayStr;
  document.getElementById('recNextDueDate').value = todayStr;
  document.getElementById('recActive').checked = true;
  document.getElementById('recAutoCreate').checked = false;

  if (id) {
    const item = recurringItems.find(i => i.id === id);
    if (item) {
      title.textContent = 'Edit Recurring Transaction';
      document.getElementById('recurringId').value = item.id;
      document.getElementById('recType').value = item.type;
      document.getElementById('recAmount').value = item.amount;
      document.getElementById('recCategory').value = item.category;
      document.getElementById('recFrequency').value = item.frequency;
      document.getElementById('recDescription').value = item.description || '';
      document.getElementById('recStartDate').value = item.startDate;
      document.getElementById('recNextDueDate').value = item.nextDueDate;
      document.getElementById('recEndDate').value = item.endDate || '';
      document.getElementById('recActive').checked = item.active;
      document.getElementById('recAutoCreate').checked = item.autoCreate;
      document.getElementById('recNotes').value = item.notes || '';
    }
  } else {
    title.textContent = 'Add Recurring Transaction';
  }

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('recurringModal');
  if (modal) modal.classList.remove('active');
}

async function handleSaveRecurring(e) {
  e.preventDefault();
  const errDiv = document.getElementById('recurringError');
  errDiv.style.display = 'none';

  const id = document.getElementById('recurringId').value;
  const type = document.getElementById('recType').value;
  const amount = parseFloat(document.getElementById('recAmount').value);
  const category = document.getElementById('recCategory').value;
  const frequency = document.getElementById('recFrequency').value;
  const description = document.getElementById('recDescription').value.trim();
  const startDate = document.getElementById('recStartDate').value;
  const nextDueDate = document.getElementById('recNextDueDate').value;
  const endDate = document.getElementById('recEndDate').value || null;
  const active = document.getElementById('recActive').checked;
  const autoCreate = document.getElementById('recAutoCreate').checked;
  const notes = document.getElementById('recNotes').value.trim();

  if (isNaN(amount) || amount <= 0) {
    errDiv.textContent = 'Please enter a valid positive amount.';
    errDiv.style.display = 'block';
    return;
  }
  if (!startDate || !nextDueDate) {
    errDiv.textContent = 'Start date and Next due date are required.';
    errDiv.style.display = 'block';
    return;
  }
  if (endDate && endDate < startDate) {
    errDiv.textContent = 'End date cannot be before start date.';
    errDiv.style.display = 'block';
    return;
  }

  const payload = {
    type, amount, category, frequency, description,
    startDate, nextDueDate, endDate, active, autoCreate, notes
  };

  try {
    if (id) {
      await apiUpdateRecurringTransaction(id, payload);
    } else {
      await apiCreateRecurringTransaction(payload);
    }
    closeModal();
    await loadRecurringTransactions();
  } catch (err) {
    errDiv.textContent = err.message || 'Failed to save recurring transaction schedule.';
    errDiv.style.display = 'block';
  }
}

async function toggleActive(id, newStatus) {
  try {
    await apiUpdateRecurringTransaction(id, { active: newStatus });
    await loadRecurringTransactions();
  } catch (err) {
    alert('Failed to update status: ' + err.message);
  }
}

async function handleDeleteRecurring(id) {
  if (!confirm('Are you sure you want to delete this recurring transaction schedule?')) return;
  try {
    await apiDeleteRecurringTransaction(id);
    await loadRecurringTransactions();
  } catch (err) {
    alert('Failed to delete schedule: ' + err.message);
  }
}

async function handleProcessDue() {
  const btn = document.getElementById('btnProcessDue');
  if (btn) btn.disabled = true;
  try {
    const res = await apiProcessRecurringTransactions();
    const count = res.processedCount || 0;
    alert(`Processed due recurring transactions successfully. ${count} new transaction(s) generated.`);
    await loadRecurringTransactions();
  } catch (err) {
    alert('Failed to process due recurring transactions: ' + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}
