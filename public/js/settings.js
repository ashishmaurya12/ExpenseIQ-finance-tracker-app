/**
 * ExpenseIQ — Complete Settings Suite Logic
 * Manages theme (Dark/Light), Accent Swatches, Profile, Security, Notifications, and JSON Backup & Restore.
 */

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('settings');
  loadSettings();
  attachSettingsListeners();
});

function loadSettings() {
  const user = getUser();
  const currentTheme = localStorage.getItem('expenseiq_theme') || 'light';
  const activeColor = localStorage.getItem('expenseiq_accent_color') || '#00C9A7';

  // Theme radios
  const radioLight = document.getElementById('radioLight');
  const radioDark = document.getElementById('radioDark');

  if (currentTheme === 'dark') {
    if (radioDark) radioDark.checked = true;
    updateOptionCards('dark');
  } else {
    if (radioLight) radioLight.checked = true;
    updateOptionCards('light');
  }

  // Accent Color Swatches
  applyAccentColor(activeColor, false);
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    if (swatch.dataset.color === activeColor) {
      swatch.classList.add('active');
    } else {
      swatch.classList.remove('active');
    }
  });

  // Profile Info
  if (user) {
    document.getElementById('settingsName').value = user.name || '';
    document.getElementById('settingsEmail').value = user.email || '';
    if (user.currency) {
      document.getElementById('settingsCurrency').value = user.currency;
    }
  }

  // Display Preferences
  const savedDateFormat = localStorage.getItem('expenseiq_date_format') || 'DD/MM/YYYY';
  const savedThreshold = localStorage.getItem('expenseiq_budget_threshold') || '80';

  if (document.getElementById('settingsDateFormat')) {
    document.getElementById('settingsDateFormat').value = savedDateFormat;
  }
  if (document.getElementById('settingsBudgetAlert')) {
    document.getElementById('settingsBudgetAlert').value = savedThreshold;
  }

  // Notification Toggles
  document.getElementById('toggleBudgetAlerts').checked = localStorage.getItem('expenseiq_alert_budget') !== 'false';
  document.getElementById('toggleBillReminders').checked = localStorage.getItem('expenseiq_alert_bills') !== 'false';
  document.getElementById('toggleMonthlyDigest').checked = localStorage.getItem('expenseiq_alert_digest') !== 'false';
}

function attachSettingsListeners() {
  const radioLight = document.getElementById('radioLight');
  const radioDark = document.getElementById('radioDark');

  if (radioLight) radioLight.addEventListener('change', () => changeTheme('light'));
  if (radioDark) radioDark.addEventListener('change', () => changeTheme('dark'));

  // Accent Color Swatch Clicks
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      e.preventDefault();
      const color = swatch.dataset.color;
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      applyAccentColor(color, true);
    });
  });

  // Save Profile Form
  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveSettings();
  });

  // Password Update Form
  document.getElementById('passwordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handlePasswordUpdate();
  });

  // Notification Toggles
  document.getElementById('toggleBudgetAlerts').addEventListener('change', (e) => {
    localStorage.setItem('expenseiq_alert_budget', e.target.checked);
    showToast(`Budget alerts ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info');
  });

  document.getElementById('toggleBillReminders').addEventListener('change', (e) => {
    localStorage.setItem('expenseiq_alert_bills', e.target.checked);
    showToast(`Bill reminders ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info');
  });

  document.getElementById('toggleMonthlyDigest').addEventListener('change', (e) => {
    localStorage.setItem('expenseiq_alert_digest', e.target.checked);
    showToast(`Monthly digest ${e.target.checked ? 'enabled' : 'disabled'}.`, 'info');
  });

  // Export CSV Report
  const csvBtn = document.getElementById('btnExportCSV');
  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      try {
        const data = await apiGetTransactions();
        if (!data.transactions || data.transactions.length === 0) {
          showToast('No transactions to export.', 'info');
          return;
        }
        exportToCSV(data.transactions, `expenseiq_transactions_${getTodayISO()}.csv`);
        showToast('CSV report downloaded!', 'success');
      } catch (err) {
        showToast('Failed to export CSV: ' + err.message, 'error');
      }
    });
  }

  // Print / PDF Report
  const pdfBtn = document.getElementById('btnExportPDF');
  if (pdfBtn) {
    pdfBtn.addEventListener('click', async () => {
      try {
        const data = await apiGetTransactions();
        if (!data.transactions || data.transactions.length === 0) {
          showToast('No transactions to print.', 'info');
          return;
        }
        exportToPDF(data.transactions, 'ExpenseIQ Transactions Report');
      } catch (err) {
        showToast('Failed to export PDF: ' + err.message, 'error');
      }
    });
  }

  // Data Backup Download
  document.getElementById('btnDownloadBackup').addEventListener('click', handleDownloadBackup);

  // Data Backup Restore
  const restoreBtn = document.getElementById('btnRestoreBackup');
  const restoreInput = document.getElementById('backupFileInput');

  restoreBtn.addEventListener('click', () => restoreInput.click());
  restoreInput.addEventListener('change', handleRestoreBackup);

  // Data Reset
  document.getElementById('btnResetData').addEventListener('click', handleResetData);
}

function changeTheme(theme) {
  const radioLight = document.getElementById('radioLight');
  const radioDark = document.getElementById('radioDark');

  if (theme === 'dark') {
    if (radioDark) radioDark.checked = true;
  } else {
    if (radioLight) radioLight.checked = true;
  }

  updateOptionCards(theme);
  applyTheme(theme);
  localStorage.setItem('expenseiq_theme', theme);
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  showToast(`Theme switched to ${theme === 'dark' ? 'Dark Mode' : 'Light Mode'}!`, 'info');
}

function updateOptionCards(theme) {
  const optionLight = document.getElementById('optionLight');
  const optionDark = document.getElementById('optionDark');

  if (optionLight && optionDark) {
    if (theme === 'light') {
      optionLight.classList.add('selected');
      optionDark.classList.remove('selected');
    } else {
      optionDark.classList.add('selected');
      optionLight.classList.remove('selected');
    }
  }
}

function applyAccentColor(colorHex, notify = true) {
  document.documentElement.style.setProperty('--accent-primary', colorHex);
  document.documentElement.style.setProperty('--gradient-primary', `linear-gradient(135deg, ${colorHex}, ${adjustColorBrightness(colorHex, -15)})`);
  localStorage.setItem('expenseiq_accent_color', colorHex);
  if (notify) {
    showToast('Brand accent color updated!', 'success');
  }
}

function adjustColorBrightness(hex, percent) {
  let num = parseInt(hex.replace('#', ''), 16),
    amt = Math.round(2.55 * percent),
    R = (num >> 16) + amt,
    G = (num >> 8 & 0x00FF) + amt,
    B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

async function handleSaveSettings() {
  const newName = document.getElementById('settingsName').value.trim();
  const newCurrency = document.getElementById('settingsCurrency').value;
  const newDateFormat = document.getElementById('settingsDateFormat').value;
  const newThreshold = document.getElementById('settingsBudgetAlert').value;

  if (!newName) {
    showToast('Please enter your name.', 'error');
    return;
  }

  try {
    const res = await apiUpdateProfile(newName, newCurrency);
    localStorage.setItem('expenseiq_date_format', newDateFormat);
    localStorage.setItem('expenseiq_budget_threshold', newThreshold);
    showToast(res.message || 'Profile & display settings saved!', 'success');

    setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handlePasswordUpdate() {
  const current = document.getElementById('pwdCurrent').value;
  const newPwd = document.getElementById('pwdNew').value;
  const confirmPwd = document.getElementById('pwdConfirm').value;
  const errorEl = document.getElementById('pwdError');

  if (!current || !newPwd || !confirmPwd) {
    errorEl.textContent = 'Please fill in all password fields.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPwd.length < 6) {
    errorEl.textContent = 'New password must be at least 6 characters.';
    errorEl.style.display = 'block';
    return;
  }

  if (newPwd !== confirmPwd) {
    errorEl.textContent = 'New passwords do not match.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    errorEl.style.display = 'none';
    const res = await apiChangePassword(current, newPwd, confirmPwd);
    showToast(res.message || 'Password updated successfully!', 'success');
    document.getElementById('passwordForm').reset();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
}

async function handleDownloadBackup() {
  try {
    const [txnsData, budgetsData, goalsData] = await Promise.all([
      apiGetTransactions().catch(() => ({ transactions: [] })),
      apiGetBudgets().catch(() => ({ budgets: [] })),
      apiGetGoals().catch(() => ({ goals: [] }))
    ]);

    const backupObject = {
      appName: 'ExpenseIQ',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: getUser(),
      transactions: txnsData.transactions || [],
      budgets: budgetsData.budgets || [],
      goals: goalsData.goals || []
    };

    const jsonStr = JSON.stringify(backupObject, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `expenseiq_backup_${getTodayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Full data backup downloaded!', 'success');
  } catch (err) {
    showToast('Failed to export backup: ' + err.message, 'error');
  }
}

function handleRestoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data.transactions && !data.goals) {
        showToast('Invalid backup file format.', 'error');
        return;
      }

      showToast('Restoring backup data...', 'info');

      // Import transactions if available
      if (data.transactions && Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          try {
            await apiCreateTransaction({
              type: t.type,
              amount: t.amount,
              category: t.category,
              date: t.date,
              note: t.note
            });
          } catch (err) {
            // ignore duplicate errors
          }
        }
      }

      showToast('Data restored successfully from backup!', 'success');
      setTimeout(() => window.location.href = '/dashboard.html', 1000);
    } catch (err) {
      showToast('Failed to parse backup file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

function handleResetData() {
  showConfirm('Are you sure you want to clear ALL transactions and reset income & expense data? This action cannot be undone.', async () => {
    try {
      const res = await apiClearAllTransactions();
      showToast(res.message || 'All app data reset successfully!', 'success');
      setTimeout(() => {
        window.location.href = '/dashboard.html';
      }, 1000);
    } catch (err) {
      showToast('Failed to reset data: ' + err.message, 'error');
    }
  });
}
