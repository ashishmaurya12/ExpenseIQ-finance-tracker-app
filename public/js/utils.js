/**
 * ExpenseIQ — Utility Functions
 */

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

// ─── Chart.js Color Palette ─────────────────────────────────
const CHART_COLORS = [
  'hsl(160, 84%, 50%)',   // Emerald
  'hsl(220, 90%, 65%)',   // Blue
  'hsl(0, 85%, 62%)',     // Coral
  'hsl(270, 76%, 65%)',   // Purple
  'hsl(28, 95%, 60%)',    // Orange
  'hsl(45, 100%, 55%)',   // Yellow
  'hsl(340, 80%, 55%)',   // Pink
  'hsl(190, 80%, 50%)',   // Cyan
  'hsl(120, 50%, 50%)',   // Green
  'hsl(200, 70%, 55%)',   // Sky
  'hsl(300, 60%, 55%)',   // Magenta
  'hsl(60, 80%, 50%)',    // Lime
  'hsl(15, 85%, 55%)',    // Vermillion
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
