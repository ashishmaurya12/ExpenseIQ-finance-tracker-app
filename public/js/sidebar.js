/**
 * ExpenseIQ — Sidebar Component
 * Dynamically injects the sidebar with navigation, theme toggle, and user info.
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
  const currentTheme = localStorage.getItem('expenseiq_theme') || 'dark';

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
        <div class="theme-toggle-row">
          <span class="theme-label">🌙</span>
          <label class="theme-switch" for="themeToggle">
            <input type="checkbox" id="themeToggle" ${currentTheme === 'light' ? 'checked' : ''}>
            <span class="theme-slider"></span>
          </label>
          <span class="theme-label">☀️</span>
        </div>
        <div class="sidebar-user">
          <div class="user-avatar">${initials}</div>
          <div class="user-info">
            <div class="user-name">${user ? user.name : 'User'}</div>
            <div class="user-email">${user ? user.email : ''}</div>
          </div>
          <button class="btn-logout" id="btnLogout" title="Logout">⏻</button>
        </div>
      </div>
    </aside>
  `;

  // Insert at the beginning of body
  document.body.insertAdjacentHTML('afterbegin', sidebarHTML);

  // Apply saved theme immediately
  applyTheme(currentTheme);

  // Logout handler
  document.getElementById('btnLogout').addEventListener('click', () => {
    apiLogout();
  });

  // Theme toggle handler
  document.getElementById('themeToggle').addEventListener('change', (e) => {
    const theme = e.target.checked ? 'light' : 'dark';
    applyTheme(theme);
    localStorage.setItem('expenseiq_theme', theme);
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

/**
 * Apply light or dark theme by toggling CSS class on document root.
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light-theme');
  } else {
    document.documentElement.classList.remove('light-theme');
  }
}

// Apply theme before page renders (prevents flash)
(function() {
  const savedTheme = localStorage.getItem('expenseiq_theme') || 'dark';
  if (savedTheme === 'light') {
    document.documentElement.classList.add('light-theme');
  }
})();
