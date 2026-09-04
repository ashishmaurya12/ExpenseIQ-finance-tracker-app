/**
 * ExpenseIQ — Centralized API Client
 * All fetch calls go through apiFetch() which handles JWT and error responses.
 */

const API_BASE = '/api';

// ─── Token Management ───────────────────────────────────────
function getToken() {
  return localStorage.getItem('expenseiq_token');
}

function setToken(token) {
  localStorage.setItem('expenseiq_token', token);
}

function removeToken() {
  localStorage.removeItem('expenseiq_token');
  localStorage.removeItem('expenseiq_user');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('expenseiq_user'));
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem('expenseiq_user', JSON.stringify(user));
}

function isAuthenticated() {
  return !!getToken();
}

// ─── API Fetch Wrapper ──────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = getToken();

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      // Token expired or invalid → redirect to login
      if (response.status === 401) {
        removeToken();
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
          window.location.href = '/index.html';
        }
      }
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Network error. Please check your connection.');
    }
    throw err;
  }
}

// ─── Auth API ───────────────────────────────────────────────
async function apiRegister(name, email, password, currency) {
  const data = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, currency })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

async function apiLogin(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

function apiLogout() {
  removeToken();
  window.location.href = '/index.html';
}

async function apiGetMe() {
  return apiFetch('/auth/me');
}

async function apiChangePassword(currentPassword, newPassword, confirmPassword) {
  return apiFetch('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  });
}

async function apiUpdateProfile(name, currency) {
  const data = await apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify({ name, currency })
  });
  if (data.user) {
    setUser(data.user);
  }
  return data;
}

// ─── Transactions API ───────────────────────────────────────
async function apiGetTransactions(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.category) params.set('category', filters.category);
  if (filters.month) params.set('month', filters.month);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', filters.page);
  if (filters.limit) params.set('limit', filters.limit);

  const query = params.toString();
  return apiFetch(`/transactions${query ? '?' + query : ''}`);
}

async function apiCreateTransaction(data) {
  return apiFetch('/transactions', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateTransaction(id, data) {
  return apiFetch(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDeleteTransaction(id) {
  return apiFetch(`/transactions/${id}`, {
    method: 'DELETE'
  });
}

async function apiClearAllTransactions() {
  return apiFetch('/transactions/meta/clear-all', {
    method: 'DELETE'
  });
}

async function apiGetSummary(month = null) {
  return apiFetch(`/transactions/meta/summary${month ? '?month=' + month : ''}`);
}

// ─── Budgets API ────────────────────────────────────────────
async function apiGetBudgets(month = null) {
  return apiFetch(`/budgets${month ? '?month=' + month : ''}`);
}

async function apiCreateBudget(data) {
  return apiFetch('/budgets', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateBudget(id, data) {
  return apiFetch(`/budgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDeleteBudget(id) {
  return apiFetch(`/budgets/${id}`, {
    method: 'DELETE'
  });
}

// ─── Goals API ──────────────────────────────────────────────
async function apiGetGoals() {
  return apiFetch('/goals');
}

async function apiCreateGoal(data) {
  return apiFetch('/goals', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateGoal(id, data) {
  return apiFetch(`/goals/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiFundGoal(id, amount) {
  return apiFetch(`/goals/${id}/fund`, {
    method: 'POST',
    body: JSON.stringify({ amount })
  });
}

async function apiDeleteGoal(id) {
  return apiFetch(`/goals/${id}`, {
    method: 'DELETE'
  });
}

// ─── Insights API ───────────────────────────────────────────
async function apiGetInsights() {
  return apiFetch('/insights');
}

// ─── AI Assistant API ────────────────────────────────────────
async function apiSendAiMessage(message, history = []) {
  return apiFetch('/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, history })
  });
}

async function apiGetAiInsights() {
  return apiFetch('/ai/insights');
}

// ─── Recurring Transactions API ──────────────────────────────
async function apiGetRecurringTransactions(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/recurring${query ? `?${query}` : ''}`);
}

async function apiCreateRecurringTransaction(data) {
  return apiFetch('/recurring', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateRecurringTransaction(id, data) {
  return apiFetch(`/recurring/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiDeleteRecurringTransaction(id) {
  return apiFetch(`/recurring/${id}`, {
    method: 'DELETE'
  });
}

async function apiProcessRecurringTransactions() {
  return apiFetch('/recurring/process', {
    method: 'POST'
  });
}

// ─── Reminders API ───────────────────────────────────────────
async function apiGetReminders(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/reminders${query ? `?${query}` : ''}`);
}

async function apiCreateReminder(data) {
  return apiFetch('/reminders', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function apiUpdateReminder(id, data) {
  return apiFetch(`/reminders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

async function apiCompleteReminder(id) {
  return apiFetch(`/reminders/${id}/complete`, {
    method: 'POST'
  });
}

async function apiDeleteReminder(id) {
  return apiFetch(`/reminders/${id}`, {
    method: 'DELETE'
  });
}

// ─── Notifications API ───────────────────────────────────────
async function apiGetNotifications(params = {}) {
  const query = new URLSearchParams(params).toString();
  return apiFetch(`/notifications${query ? `?${query}` : ''}`);
}

async function apiMarkNotificationRead(id) {
  return apiFetch(`/notifications/${id}/read`, {
    method: 'PUT'
  });
}

async function apiMarkAllNotificationsRead() {
  return apiFetch('/notifications/read-all', {
    method: 'POST'
  });
}

async function apiDeleteNotification(id) {
  return apiFetch(`/notifications/${id}`, {
    method: 'DELETE'
  });
}


// ─── CSV Export Utility ─────────────────────────────────────
function exportToCSV(transactions, filename = 'expenseiq_transactions.csv') {
  if (!transactions || transactions.length === 0) {
    return false;
  }

  const headers = ['Date', 'Type', 'Category', 'Amount', 'Note'];
  const rows = transactions.map(t => [
    t.date,
    t.type,
    t.category,
    t.amount,
    `"${(t.note || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}

