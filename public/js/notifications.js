/**
 * ExpenseIQ — Notification Center Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  initSidebar('notifications');
  setupEventListeners();
  await loadNotifications();
});

let currentPage = 1;
let currentLimit = 15;
let currentReadFilter = 'all'; // 'all' | 'false' | 'true'
let totalPages = 1;

function setupEventListeners() {
  document.getElementById('btnMarkAllRead').addEventListener('click', handleMarkAllRead);
  document.getElementById('btnPrevPage').addEventListener('click', () => changePage(-1));
  document.getElementById('btnNextPage').addEventListener('click', () => changePage(1));

  document.getElementById('tabNotifAll').addEventListener('click', () => setFilter('all'));
  document.getElementById('tabNotifUnread').addEventListener('click', () => setFilter('false'));
  document.getElementById('tabNotifRead').addEventListener('click', () => setFilter('true'));
}

function setFilter(filter) {
  currentReadFilter = filter;
  currentPage = 1;

  ['tabNotifAll', 'tabNotifUnread', 'tabNotifRead'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  if (filter === 'all') document.getElementById('tabNotifAll').classList.add('active');
  else if (filter === 'false') document.getElementById('tabNotifUnread').classList.add('active');
  else if (filter === 'true') document.getElementById('tabNotifRead').classList.add('active');

  loadNotifications();
}

async function changePage(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    await loadNotifications();
  }
}

async function loadNotifications() {
  const container = document.getElementById('notificationsList');
  if (!container) return;

  const params = { page: currentPage, limit: currentLimit };
  if (currentReadFilter !== 'all') {
    params.read = currentReadFilter;
  }

  try {
    const res = await apiGetNotifications(params);
    const notifications = res.notifications || [];
    const unreadCount = res.unreadCount || 0;
    const pagination = res.pagination || { page: 1, totalPages: 1 };

    currentPage = pagination.page;
    totalPages = pagination.totalPages;

    const unreadEl = document.getElementById('unreadCountBanner');
    if (unreadEl) unreadEl.textContent = `Unread Notifications: ${unreadCount}`;

    updatePaginationUI();

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted" style="padding:48px">
          No notifications found.
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    notifications.forEach(n => {
      container.appendChild(renderNotificationItem(n));
    });
  } catch (err) {
    container.innerHTML = `
      <div class="text-center text-danger" style="padding:48px">
        Failed to load notifications: ${escapeHTML(err.message)}
      </div>
    `;
  }
}

function renderNotificationItem(n) {
  const item = document.createElement('div');
  item.className = `notification-item ${!n.read ? 'unread' : ''}`;
  item.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border-color);
    background: ${!n.read ? 'var(--bg-card-accent, rgba(59,130,246,0.05))' : 'transparent'};
  `;

  const left = document.createElement('div');
  left.style.cssText = 'display:flex;gap:16px;align-items:flex-start;flex:1;min-width:0;margin-right:16px';

  const typeIcon = getTypeIcon(n.type);
  const iconDiv = document.createElement('div');
  iconDiv.style.cssText = 'font-size:1.4rem;line-height:1;margin-top:2px';
  iconDiv.textContent = typeIcon;

  const content = document.createElement('div');
  content.style.cssText = 'flex:1;min-width:0';

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:4px';

  const titleEl = document.createElement('span');
  titleEl.style.cssText = 'font-weight:600;color:var(--text-primary)';
  titleEl.textContent = n.title;

  const priorityBadge = document.createElement('span');
  priorityBadge.className = 'badge';
  priorityBadge.style.cssText = getPriorityStyle(n.priority);
  priorityBadge.textContent = (n.priority || 'medium').toUpperCase();

  titleRow.appendChild(titleEl);
  titleRow.appendChild(priorityBadge);

  const messageEl = document.createElement('div');
  messageEl.style.cssText = 'font-size:0.9rem;color:var(--text-secondary);margin-bottom:4px;word-break:break-word';
  messageEl.textContent = n.message;

  const dateEl = document.createElement('div');
  dateEl.style.cssText = 'font-size:0.75rem;color:var(--text-muted)';
  dateEl.textContent = formatDate(n.createdAt);

  content.appendChild(titleRow);
  content.appendChild(messageEl);
  content.appendChild(dateEl);

  left.appendChild(iconDiv);
  left.appendChild(content);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;align-items:center;flex-shrink:0';

  if (!n.read) {
    const markReadBtn = document.createElement('button');
    markReadBtn.className = 'btn btn-sm btn-secondary';
    markReadBtn.textContent = '✓ Mark Read';
    markReadBtn.onclick = () => handleMarkRead(n.id);
    actions.appendChild(markReadBtn);
  }

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-sm btn-danger';
  deleteBtn.textContent = '🗑️';
  deleteBtn.title = 'Delete notification';
  deleteBtn.onclick = () => handleDelete(n.id);
  actions.appendChild(deleteBtn);

  item.appendChild(left);
  item.appendChild(actions);

  return item;
}

function getTypeIcon(type) {
  switch (type) {
    case 'reminder': return '⏰';
    case 'budget': return '🎯';
    case 'goal': return '🏆';
    case 'anomaly': return '⚠️';
    case 'ai_insight': return '💡';
    case 'system': default: return '🔔';
  }
}

function getPriorityStyle(priority) {
  switch (priority) {
    case 'high': return 'background:rgba(239,68,68,0.15);color:#ef4444;font-size:0.7rem';
    case 'low': return 'background:rgba(107,114,128,0.15);color:#6b7280;font-size:0.7rem';
    case 'medium': default: return 'background:rgba(245,158,11,0.15);color:#f59e0b;font-size:0.7rem';
  }
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function updatePaginationUI() {
  const prevBtn = document.getElementById('btnPrevPage');
  const nextBtn = document.getElementById('btnNextPage');
  const pageInd = document.getElementById('pageIndicator');

  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
  if (pageInd) pageInd.textContent = `Page ${currentPage} of ${totalPages || 1}`;
}

async function handleMarkRead(id) {
  try {
    await apiMarkNotificationRead(id);
    await loadNotifications();
  } catch (err) {
    alert('Failed to mark read: ' + err.message);
  }
}

async function handleMarkAllRead() {
  try {
    await apiMarkAllNotificationsRead();
    await loadNotifications();
  } catch (err) {
    alert('Failed to mark all read: ' + err.message);
  }
}

async function handleDelete(id) {
  try {
    await apiDeleteNotification(id);
    await loadNotifications();
  } catch (err) {
    alert('Failed to delete notification: ' + err.message);
  }
}
