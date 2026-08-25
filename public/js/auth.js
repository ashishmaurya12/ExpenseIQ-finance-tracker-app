/**
 * ExpenseIQ — Auth Page Logic
 * Handles login and register form submissions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Redirect to dashboard if already logged in
  if (redirectIfAuth()) return;

  // ─── Login Form ─────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('loginError');
      const btn = document.getElementById('loginBtn');
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      // Client-side validation
      if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Signing in...';
        errorEl.style.display = 'none';

        await apiLogin(email, password);
        window.location.href = '/dashboard.html';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Sign In';
      }
    });
  }

  // ─── Register Form ──────────────────────────────────────
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('registerError');
      const btn = document.getElementById('registerBtn');
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirm = document.getElementById('regConfirm').value;
      const currency = document.getElementById('regCurrency').value;

      // Client-side validation
      if (!name || !email || !password || !confirm) {
        errorEl.textContent = 'Please fill in all fields.';
        errorEl.style.display = 'block';
        return;
      }

      if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.style.display = 'block';
        return;
      }

      if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match.';
        errorEl.style.display = 'block';
        return;
      }

      try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Creating account...';
        errorEl.style.display = 'none';

        await apiRegister(name, email, password, currency);
        window.location.href = '/dashboard.html';
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Create Account';
      }
    });
  }
});
