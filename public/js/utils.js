/**
 * ExpenseIQ — Utility Functions
 */

// ─── HTML Sanitization ──────────────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── Currency Formatting ────────────────────────────────────
function formatCurrency(amount, currency = 'INR') {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
  return formatter.format(amount);
}

// ─── Date Formatting ────────────────────────────────────────
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatMonthYear(monthStr) {
  // "2024-08" → "Aug 2024"
  const [year, month] = monthStr.split('-');
  const date = new Date(year, parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Export Utilities ───────────────────────────────────────
function exportToCSV(data, filename = 'expenseiq_report.csv') {
  if (!data || data.length === 0) return;
  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount'];
  const rows = data.map(t => [
    `"${t.date || ''}"`,
    `"${t.type || ''}"`,
    `"${t.category || ''}"`,
    `"${(t.note || '').replace(/"/g, '""')}"`,
    t.amount || 0
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToPDF(data, title = 'ExpenseIQ Financial Report') {
  if (!data || data.length === 0) return;
  const printWindow = window.open('', '_blank');
  const user = typeof getUser === 'function' ? getUser() : null;
  const rowsHtml = data.map(t => `
    <tr>
      <td>${t.date || ''}</td>
      <td style="text-transform:capitalize">${t.type || ''}</td>
      <td>${t.category || ''}</td>
      <td>${t.note || '—'}</td>
      <td style="text-align:right;font-weight:600">${formatCurrency(t.amount || 0)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; padding: 32px; color: #0F172A; }
        h1 { margin-bottom: 4px; color: #00C9A7; }
        p { color: #64748B; margin-bottom: 24px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { padding: 10px 14px; border-bottom: 1px solid #E2E8F0; text-align: left; font-size: 13px; }
        th { background: #F8FAFC; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #475569; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <p>Generated for ${user ? user.name : 'ExpenseIQ User'} on ${formatDate(getTodayISO())}</p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Category</th>
            <th>Note</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ─── Toast Notifications ────────────────────────────────────
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
    <button class="toast-dismiss" onclick="this.parentElement.remove()">×</button>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ─── Modal System ───────────────────────────────────────────
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(m => {
    m.classList.remove('active');
  });
  document.body.style.overflow = '';
}

// ─── Confirm Dialog ─────────────────────────────────────────
function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'confirmModal';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-body">
        <div class="confirm-dialog">
          <div class="confirm-icon">⚠</div>
          <p>${message}</p>
          <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn btn-secondary" id="confirmCancel">Cancel</button>
            <button class="btn btn-danger" id="confirmOk">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('confirmCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('confirmOk').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ─── Debounce ───────────────────────────────────────────────
function debounce(fn, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Category Icons ─────────────────────────────────────────
const CATEGORY_ICONS = {
  Food: '🍔',
  Transport: '🚗',
  Rent: '🏠',
  Utilities: '💡',
  Entertainment: '🎬',
  Health: '🏥',
  Shopping: '🛍️',
  Education: '📚',
  Salary: '💰',
  Freelance: '💻',
  Investment: '📈',
  Gift: '🎁',
  Other: '📦'
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || '📦';
}

// ─── Animated Counter ───────────────────────────────────────
function animateValue(element, start, end, duration = 800) {
  const startTime = performance.now();
  const range = end - start;

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = start + range * eased;

    element.textContent = formatCurrency(current);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// ─── Auth Guard ─────────────────────────────────────────────
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

function redirectIfAuth() {
  if (isAuthenticated()) {
    window.location.href = '/dashboard.html';
    return true;
  }
  return false;
}

// ─── Categories List (matches backend) ─────────────────────
const CATEGORIES = [
  'Food', 'Transport', 'Rent', 'Utilities', 'Entertainment',
  'Health', 'Shopping', 'Education', 'Salary', 'Freelance',
  'Investment', 'Gift', 'Other'
];

// ─── Chart.js Color Palette (Enhancv Palette) ───────────────
const CHART_COLORS = [
  '#00C9A7',   // Mint Teal (Enhancv Primary)
  '#6366F1',   // Royal Indigo
  '#8B5CF6',   // Lavender Purple
  '#F43F5E',   // Coral Rose
  '#F97316',   // Warm Orange
  '#F59E0B',   // Amber
  '#06B6D4',   // Cyan
  '#10B981',   // Emerald
  '#3B82F6',   // Blue
  '#EC4899',   // Pink
  '#84CC16',   // Lime
  '#14B8A6',   // Teal
  '#64748B',   // Slate
];

// ─── Chart.js Percentage Bar Plugin ─────────────────────────
if (typeof Chart !== 'undefined') {
  Chart.register({
    id: 'barPercentagePlugin',
    afterDatasetsDraw(chart) {
      if (chart.config.type !== 'bar') return;

      const { ctx } = chart;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const meta = chart.getDatasetMeta(datasetIndex);
        if (!meta || meta.hidden) return;

        meta.data.forEach((bar, index) => {
          const val = dataset.data[index];
          if (val === undefined || val === null || val === 0) return;

          let total = 0;
          if (chart.data.datasets.length > 1) {
            // Grouped datasets (e.g. Limit vs Spent, Saved vs Target, Income vs Expense)
            const baseVal = Number(chart.data.datasets[0].data[index]) || 0;
            total = baseVal > 0 ? baseVal : Number(val) || 1;
          } else {
            // Single dataset breakdown
            total = chart.data.datasets[0].data.reduce((a, b) => a + (Number(b) || 0), 0);
          }

          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          if (pct <= 0) return;

          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.font = '600 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`${pct}%`, bar.x, Math.max(bar.y - 3, 14));
          ctx.restore();
        });
      });
    }
  });
}
