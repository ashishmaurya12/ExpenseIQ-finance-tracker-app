/**
 * ExpenseIQ — Sidebar & Global UI Component
 * Dynamically injects sidebar, FAB button, theme toggle, and keyboard shortcuts.
 */

function initSidebar(activePage) {
  const navItems = [
    { id: 'dashboard',     label: 'Dashboard',     icon: '📊', href: '/dashboard.html' },
    { id: 'analytics',     label: 'Analytics',     icon: '📈', href: '/analytics.html' },
    { id: 'transactions',  label: 'Transactions',  icon: '💳', href: '/transactions.html' },
    { id: 'budgets',       label: 'Budgets',       icon: '🎯', href: '/budgets.html' },
    { id: 'goals',         label: 'Savings Goals',  icon: '🏆', href: '/goals.html' },
    { id: 'recurring',     label: 'Recurring',     icon: '🔄', href: '/recurring.html' },
    { id: 'reminders',     label: 'Reminders',     icon: '⏰', href: '/reminders.html' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', href: '/notifications.html' }
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
        <a href="/notifications.html" class="nav-bell-link" id="navBellLink" title="Notification Center">
          <span class="bell-icon">🔔</span>
          <span class="unread-badge" id="navUnreadBadge" style="display: none;">0</span>
        </a>
      </div>

      <nav class="sidebar-nav">
        ${navItems.map(item => `
          <a href="${item.href}" class="nav-item ${item.id === activePage ? 'active' : ''}" id="nav-${item.id}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
            ${item.id === 'notifications' ? '<span class="nav-badge" id="sidebarNotifBadge" style="display:none;">0</span>' : ''}
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <!-- User Profile Card & Popover Menu -->
        <div class="sidebar-user" id="userMenuCard" title="Click for profile options">
          <div class="user-avatar">${escapeHTML(initials)}</div>
          <div class="user-info">
            <div class="user-name">${user ? escapeHTML(user.name) : 'User'}</div>
            <div class="user-email">${user ? escapeHTML(user.email) : ''}</div>
          </div>
          <span class="user-menu-dots">⋮</span>

          <!-- Popover Dropdown -->
          <div class="user-popover-menu" id="userPopoverMenu">
            <div class="user-popover-header">
              <div class="user-avatar sm">${escapeHTML(initials)}</div>
              <div style="min-width:0;flex:1">
                <div class="user-popover-name">${user ? escapeHTML(user.name) : 'User'}</div>
                <div class="user-popover-email">${user ? escapeHTML(user.email) : ''}</div>
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

    <!-- Mobile sidebar backdrop overlay -->
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
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
  const backdrop = document.getElementById('sidebarBackdrop');

  function openSidebar() {
    sidebar.classList.add('open');
    if (backdrop) backdrop.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent body scroll while sidebar open
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });

  // Tap backdrop to close sidebar
  if (backdrop) {
    backdrop.addEventListener('click', closeSidebar);
  }

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
      if (!sidebar.contains(e.target) && e.target !== toggle && e.target !== backdrop) {
        closeSidebar();
      }
    }
  });

  // Close sidebar when a nav link is clicked (mobile navigation)
  sidebar.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeSidebar();
    });
  });

  // Start periodic notification badge updater (every 30s)
  updateNotificationBadge();
  setInterval(updateNotificationBadge, 30000);
}

async function updateNotificationBadge() {
  const badge = document.getElementById('navUnreadBadge');
  const sidebarBadge = document.getElementById('sidebarNotifBadge');
  if (!badge && !sidebarBadge) return;

  try {
    if (typeof apiGetNotifications !== 'function') return;
    const res = await apiGetNotifications({ limit: 1 });
    const count = res && typeof res.unreadCount === 'number' ? res.unreadCount : 0;
    const displayStr = count > 99 ? '99+' : String(count);

    if (badge) {
      badge.textContent = displayStr;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (sidebarBadge) {
      sidebarBadge.textContent = displayStr;
      sidebarBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  } catch {
    // Fail silently in badge UI
  }
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

