/**
 * ExpenseIQ — Sidebar & Global UI Component
 * Dynamically injects sidebar, FAB button, theme toggle, and keyboard shortcuts.
 */

function initSidebar(activePage) {
  const navItems = [
    { id: 'dashboard',    label: 'Dashboard',    icon: '📊', href: '/dashboard.html' },
    { id: 'transactions', label: 'Transactions', icon: '💳', href: '/transactions.html' },
    { id: 'budgets',      label: 'Budgets',      icon: '🎯', href: '/budgets.html' },
    { id: 'goals',        label: 'Savings Goals', icon: '🏆', href: '/goals.html' },
  ];

  const user = getUser();
  const initials = user ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';
  const currentTheme = localStorage.getItem('expenseiq_theme') || 'light';

  const sidebarHTML = `
    <button class="sidebar-toggle" id="sidebarToggle" aria-label="Toggle menu">☰</button>
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">E</div>
        <span class="sidebar-brand">ExpenseIQ</span>
      </div>

      <nav class="sidebar-nav">
        ${navItems.map(item => `
          <a href="${item.href}" class="nav-item ${item.id === activePage ? 'active' : ''}" id="nav-${item.id}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <!-- User Profile Card & Popover Menu -->
        <div class="sidebar-user" id="userMenuCard" title="Click for profile options">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user ? user.name : 'User'}</div>
            <div class="user-email">${user ? user.email : ''}</div>
          </div>
          <span class="user-menu-dots">⋮</span>

          <!-- Popover Dropdown -->
          <div class="user-popover-menu" id="userPopoverMenu">
            <div class="user-popover-header">
              <div class="user-avatar sm">${initials}</div>
              <div style="min-width:0;flex:1">
                <div class="user-popover-name">${user ? user.name : 'User'}</div>
                <div class="user-popover-email">${user ? user.email : ''}</div>
              </div>
            </div>
            <div class="user-popover-divider"></div>
            <a href="/settings.html" class="user-popover-item">
              <span class="popover-icon">⚙️</span>
              <span>Settings</span>
            </a>
            <button class="user-popover-item logout" id="btnLogoutPopover">
              <span class="popover-icon">🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Floating Quick Add Button (FAB) -->
    <div class="fab-container">
      <button class="fab-btn" id="fabAddBtn" title="Quick Add Transaction (Ctrl+N)">+</button>
      <span class="fab-tooltip">Add Transaction (Ctrl+N)</span>
    </div>
  `;

  // Insert at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // Apply saved theme immediately
  applyTheme(currentTheme);

  // User Profile Popover toggle
  const userCard = document.getElementById('userMenuCard');
  const userPopover = document.getElementById('userPopoverMenu');

  if (userCard && userPopover) {
    userCard.addEventListener('click', (e) => {
      // Don't toggle if clicking directly on a popover link or logout button
      if (e.target.closest('.user-popover-menu')) return;
      e.stopPropagation();
      userPopover.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!userCard.contains(e.target)) {
        userPopover.classList.remove('active');
      }
    });
  }

  // Logout handlers
  const logoutBtn = document.getElementById('btnLogoutPopover');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      apiLogout();
    });
  }

  // Theme toggle handler (if switch exists)
  const themeSwitch = document.getElementById('themeToggle');
  if (themeSwitch) {
    themeSwitch.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'light' : 'dark';
      applyTheme(theme);
      localStorage.setItem('expenseiq_theme', theme);
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    });
  }

  // FAB button click handler
  document.getElementById('fabAddBtn').addEventListener('click', () => {
    triggerQuickAdd();
  });

  // Keyboard shortcut listener (Ctrl+N / Alt+N)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      triggerQuickAdd();
    }
  });

  // Mobile toggle
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== toggle) {
        sidebar.classList.remove('open');
      }
    }
  });
}

function triggerQuickAdd() {
  if (typeof openAddTransactionModal === 'function') {
    openAddTransactionModal();
  } else {
    window.location.href = '/transactions.html?action=add';
  }
}

/**
 * Apply light or dark theme by toggling CSS class & data-theme on document root.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light') {
    document.documentElement.classList.add('light-theme');
    document.documentElement.classList.remove('dark-theme');
  } else {
    document.documentElement.classList.add('dark-theme');
    document.documentElement.classList.remove('light-theme');
  }
}

// Apply theme before page renders (prevents flash)
(function() {
  const savedTheme = localStorage.getItem('expenseiq_theme') || 'light';
  applyTheme(savedTheme);
})();

