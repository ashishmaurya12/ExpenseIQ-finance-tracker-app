/**
 * ExpenseIQ — Bill Reminders Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initSidebar('reminders');
  populateCategories();
  setupEventListeners();
  await loadReminders();
});

let allReminders = [];
let activeFilter = 'all';

function populateCategories() {
  const select = document.getElementById('remCategory');
  if (!select) return;

  const categories = [
    'Utilities', 'Housing', 'Financial', 'Transportation',
    'Healthcare', 'Entertainment', 'Personal Care', 'Education', 'Other'
  ];

  select.innerHTML = categories.map(cat => `<option value="${escapeHTML(cat)}">${escapeHTML(cat)}</option>`).join('');
}

function setupEventListeners() {
  document.getElementById('btnAddReminder').addEventListener('click', () => openModal());
  document.getElementById('reminderModalClose').addEventListener('click', closeModal);
  document.getElementById('btnCancelReminder').addEventListener('click', closeModal);
  document.getElementById('btnSaveReminder').addEventListener('click', handleSaveReminder);

  document.getElementById('tabAll').addEventListener('click', () => setTab('all'));
  document.getElementById('tabOverdue').addEventListener('click', () => setTab('overdue'));
  document.getElementById('tabUpcoming').addEventListener('click', () => setTab('upcoming'));
  document.getElementById('tabCompleted').addEventListener('click', () => setTab('completed'));

  document.getElementById('reminderPriorityFilter').addEventListener('change', renderReminders);
}

function setTab(tab) {
  activeFilter = tab;
  ['tabAll', 'tabOverdue', 'tabUpcoming', 'tabCompleted'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const activeBtn = document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
  if (activeBtn) activeBtn.classList.add('active');

  renderReminders();
}

async function loadReminders() {
  const container = document.getElementById('remindersContainer');
  if (!container) return;

  try {
    const res = await apiGetReminders({ status: 'all', limit: 50 });
    allReminders = res.reminders || [];
    renderReminders();
  } catch (err) {
    container.innerHTML = `
      <div class="text-center text-danger" style="padding:48px;grid-column:1/-1">
        Failed to load reminders: ${escapeHTML(err.message)}
      </div>
    `;
  }
}

function renderReminders() {
  const container = document.getElementById('remindersContainer');
  if (!container) return;

  const priorityFilter = document.getElementById('reminderPriorityFilter').value;
  const todayStr = new Date().toISOString().slice(0, 10);

  let filtered = allReminders;

  if (activeFilter === 'overdue') {
    filtered = filtered.filter(r => r.status === 'overdue' || (r.status === 'pending' && r.dueDate < todayStr));
  } else if (activeFilter === 'upcoming') {
    filtered = filtered.filter(r => (r.status === 'pending' || r.status === 'overdue') && r.dueDate >= todayStr);
  } else if (activeFilter === 'completed') {
    filtered = filtered.filter(r => r.status === 'completed');
  }

  if (priorityFilter) {
    filtered = filtered.filter(r => r.priority === priorityFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center text-muted" style="padding:48px;grid-column:1/-1">
        No bill reminders found for this filter.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(r => {
    const isOverdue = r.status === 'overdue' || (r.status === 'pending' && r.dueDate < todayStr);
    const isDueToday = r.dueDate === todayStr && r.status !== 'completed';
    const isCompleted = r.status === 'completed';

    let cardBorder = 'var(--border-color)';
    let statusBadge = `<span class="badge" style="background:rgba(59,130,246,0.15);color:#3b82f6">Upcoming</span>`;

    if (isCompleted) {
      statusBadge = `<span class="badge" style="background:rgba(16,185,129,0.15);color:#10b981">Completed</span>`;
    } else if (isOverdue) {
      cardBorder = '#ef4444';
      statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.15);color:#ef4444;font-weight:700">OVERDUE</span>`;
    } else if (isDueToday) {
      cardBorder = '#f59e0b';
      statusBadge = `<span class="badge" style="background:rgba(245,158,11,0.15);color:#f59e0b;font-weight:700">DUE TODAY</span>`;
    }

    const priorityColors = {
      high: '#ef4444',
      medium: '#f59e0b',
      low: '#6b7280'
    };

    return `
      <div class="card" style="border-left:4px solid ${cardBorder};padding:20px;display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <h3 style="font-size:1.1rem;margin:0">${escapeHTML(r.title)}</h3>
            ${statusBadge}
          </div>
          <div style="font-size:1.5rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">
            ₹${Number(r.amount).toLocaleString('en-IN')}
          </div>
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:12px">
            📅 Due: <strong style="color:${isOverdue ? '#ef4444' : 'inherit'}">${escapeHTML(r.dueDate)}</strong>
            • <span style="color:${priorityColors[r.priority] || '#6b7280'};font-weight:600;text-transform:capitalize">${escapeHTML(r.priority)} Priority</span>
          </div>
          ${r.notes ? `<div style="font-size:0.85rem;color:var(--text-secondary);background:var(--bg-secondary);padding:8px 12px;border-radius:6px;margin-bottom:12px">${escapeHTML(r.notes)}</div>` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color)">
          <div style="font-size:0.8rem;color:var(--text-secondary)">${escapeHTML(r.category || 'Bill')}</div>
          <div style="display:flex;gap:8px">
            ${!isCompleted ? `
              <button class="btn btn-sm btn-success" onclick="handleCompleteReminder('${r.id}')" title="Mark Paid">
                ✓ Mark Paid
              </button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="openModal('${r.id}')" title="Edit">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="handleDeleteReminder('${r.id}')" title="Delete">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openModal(id = null) {
  const modal = document.getElementById('reminderModal');
  const title = document.getElementById('reminderModalTitle');
  const form = document.getElementById('reminderForm');
  const errDiv = document.getElementById('reminderError');

  if (!modal || !form) return;

  errDiv.style.display = 'none';
  form.reset();
  document.getElementById('reminderId').value = '';

  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('remDueDate').value = todayStr;
  document.getElementById('remDaysBefore').value = 3;

  if (id) {
    const item = allReminders.find(r => r.id === id);
    if (item) {
      title.textContent = 'Edit Bill Reminder';
      document.getElementById('reminderId').value = item.id;
      document.getElementById('remTitle').value = item.title;
      document.getElementById('remAmount').value = item.amount;
      document.getElementById('remDueDate').value = item.dueDate;
      document.getElementById('remCategory').value = item.category || 'Utilities';
      document.getElementById('remPriority').value = item.priority || 'medium';
      document.getElementById('remDaysBefore').value = item.reminderDaysBefore ?? 3;
      document.getElementById('remNotes').value = item.notes || '';
    }
  } else {
    title.textContent = 'Add Bill Reminder';
  }

  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('reminderModal');
  if (modal) modal.classList.remove('active');
}

async function handleSaveReminder(e) {
  e.preventDefault();
  const errDiv = document.getElementById('reminderError');
  errDiv.style.display = 'none';

  const id = document.getElementById('reminderId').value;
  const title = document.getElementById('remTitle').value.trim();
  const amount = parseFloat(document.getElementById('remAmount').value);
  const dueDate = document.getElementById('remDueDate').value;
  const category = document.getElementById('remCategory').value;
  const priority = document.getElementById('remPriority').value;
  const reminderDaysBefore = parseInt(document.getElementById('remDaysBefore').value, 10);
  const notes = document.getElementById('remNotes').value.trim();

  if (!title) {
    errDiv.textContent = 'Title is required.';
    errDiv.style.display = 'block';
    return;
  }
  if (isNaN(amount) || amount < 0) {
    errDiv.textContent = 'Please enter a valid non-negative amount.';
    errDiv.style.display = 'block';
    return;
  }
  if (!dueDate) {
    errDiv.textContent = 'Due date is required.';
    errDiv.style.display = 'block';
    return;
  }
  if (isNaN(reminderDaysBefore) || reminderDaysBefore < 0 || reminderDaysBefore > 30) {
    errDiv.textContent = 'Reminder days before must be an integer between 0 and 30.';
    errDiv.style.display = 'block';
    return;
  }

  const payload = {
    title, amount, dueDate, category, priority, reminderDaysBefore, notes
  };

  try {
    if (id) {
      await apiUpdateReminder(id, payload);
    } else {
      await apiCreateReminder(payload);
    }
    closeModal();
    await loadReminders();
  } catch (err) {
    errDiv.textContent = err.message || 'Failed to save reminder.';
    errDiv.style.display = 'block';
  }
}

async function handleCompleteReminder(id) {
  try {
    await apiCompleteReminder(id);
    await loadReminders();
  } catch (err) {
    alert('Failed to complete reminder: ' + err.message);
  }
}

async function handleDeleteReminder(id) {
  if (!confirm('Are you sure you want to delete this reminder?')) return;
  try {
    await apiDeleteReminder(id);
    await loadReminders();
  } catch (err) {
    alert('Failed to delete reminder: ' + err.message);
  }
}
