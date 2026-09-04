/**
 * ExpenseIQ — Savings Goals Page Logic
 * CRUD operations, fund adding, and progress rendering.
 */

let allGoals = [];
let myGoalsChart = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth()) return;
  initSidebar('goals');
  attachGoalListeners();
  loadGoals();
});

// ─── Event Listeners ────────────────────────────────────────
function attachGoalListeners() {
  document.getElementById('btnAddGoal').addEventListener('click', () => {
    resetGoalForm();
    document.getElementById('goalModalTitle').textContent = 'New Savings Goal';
    document.getElementById('btnSaveGoal').textContent = 'Create Goal';
    openModal('goalModal');
  });

  document.getElementById('goalModalClose').addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('btnCancelGoal').addEventListener('click', () => closeModal('goalModal'));
  document.getElementById('goalModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal('goalModal');
  });

  document.getElementById('fundModalClose').addEventListener('click', () => closeModal('fundModal'));
  document.getElementById('btnCancelFund').addEventListener('click', () => closeModal('fundModal'));
  document.getElementById('fundModal').addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closeModal('fundModal');
  });

  document.getElementById('btnSaveGoal').addEventListener('click', handleSaveGoal);
  document.getElementById('btnConfirmFund').addEventListener('click', handleFundGoal);

  document.getElementById('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSaveGoal();
  });
}

// ─── Load & Render Goals ────────────────────────────────────
async function loadGoals() {
  try {
    const data = await apiGetGoals();
    allGoals = data.goals || [];
    renderGoals(allGoals);
    renderGoalsSummary(allGoals);
    renderGoalsChart(allGoals);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderGoals(goals) {
  const grid = document.getElementById('goalsGrid');

  if (goals.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1">
        <div class="empty-state">
          <div class="empty-icon">🏆</div>
          <p>No savings goals yet. Click "+ New Goal" to start saving towards something!</p>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = goals.map(goal => {
    const progressPercent = Math.min(goal.percentSaved, 100);
    const fillClass = goal.isCompleted ? 'complete' : '';

    return `
      <div class="goal-card ${goal.isCompleted ? 'completed' : ''}" data-id="${goal.id}">
        <div class="goal-card-header">
          <div class="goal-info">
            <div class="goal-icon">${goal.icon}</div>
            <div>
              <div class="goal-name">${goal.name}</div>
              ${goal.deadline ? `<div class="goal-deadline">Target: ${formatDate(goal.deadline)}</div>` : ''}
            </div>
          </div>
          <div class="goal-actions">
            ${!goal.isCompleted ? `<button class="btn-fund" onclick="openFundModal('${goal.id}')" title="Add funds">💰 Fund</button>` : ''}
            <button class="btn-icon edit" title="Edit" onclick="handleEditGoal('${goal.id}')">✏️</button>
            <button class="btn-icon delete" title="Delete" onclick="handleDeleteGoal('${goal.id}')">🗑️</button>
          </div>
        </div>

        <div class="goal-progress-section">
          <div class="goal-amounts">
            <span class="goal-saved">${formatCurrency(goal.savedAmount)}</span>
            <span class="goal-target">of ${formatCurrency(goal.targetAmount)}</span>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill ${fillClass}" style="width:${progressPercent}%"></div>
          </div>
        </div>

        <div class="goal-footer">
          <span class="goal-meta">
            ${goal.isCompleted
              ? '🎉 Goal reached!'
              : goal.estimatedCompletion
                ? `Est. completion: ${formatDate(goal.estimatedCompletion)}`
                : `${formatCurrency(goal.remaining)} remaining`
            }
          </span>
          <span class="budget-percent ${progressPercent >= 100 ? 'safe' : progressPercent >= 50 ? 'warning' : 'danger'}">
            ${goal.percentSaved}%
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderGoalsSummary(goals) {
  const active = goals.filter(g => !g.isCompleted).length;
  const totalSaved = goals.reduce((sum, g) => sum + g.savedAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

  document.getElementById('activeGoals').textContent = active;
  animateValue(document.getElementById('totalSaved'), 0, totalSaved);
  animateValue(document.getElementById('totalTarget'), 0, totalTarget);
}

// ─── Savings Goals Chart ────────────────────────────────────
function renderGoalsChart(goals) {
  const card = document.getElementById('goalsChartCard');
  const canvas = document.getElementById('goalsProgressChart');
  if (!card || !canvas) return;

  if (!goals || goals.length === 0) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');

  const labels = goals.map(g => `${g.icon} ${g.name}`);
  const targets = goals.map(g => Number(g.targetAmount) || 0);
  const saveds = goals.map(g => Number(g.savedAmount) || 0);

  const ctx = canvas.getContext('2d');
  if (myGoalsChart && typeof myGoalsChart.destroy === 'function') {
    myGoalsChart.destroy();
  }

  myGoalsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Target Amount',
          data: targets,
          backgroundColor: 'hsla(220, 90%, 65%, 0.7)',
          borderColor: 'hsl(220, 90%, 65%)',
          borderWidth: 1,
          borderRadius: 6
        },
        {
          label: 'Saved Amount',
          data: saveds,
          backgroundColor: 'hsla(160, 84%, 50%, 0.7)',
          borderColor: 'hsl(160, 84%, 50%)',
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: 'hsl(220, 15%, 55%)' } },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'hsl(220, 15%, 55%)', callback: v => '₹' + v }
        }
      },
      plugins: {
        legend: { labels: { color: 'hsl(220, 15%, 60%)', usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const val = ctx.parsed.y;
              const target = Number(goals[ctx.dataIndex]?.targetAmount) || val;
              const pct = target > 0 ? Math.round((val / target) * 100) : 0;
              return ` ${ctx.dataset.label}: ${formatCurrency(val)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ─── Save Goal ──────────────────────────────────────────────
async function handleSaveGoal() {
  const errorEl = document.getElementById('goalError');
  const btn = document.getElementById('btnSaveGoal');
  const id = document.getElementById('goalId').value;
  const name = document.getElementById('goalName').value.trim();
  const targetAmount = document.getElementById('goalTarget').value;
  const savedAmount = document.getElementById('goalSaved').value || 0;
  const deadline = document.getElementById('goalDeadline').value || null;
  const icon = document.getElementById('goalIcon').value;

  if (!name || name.length < 2) {
    errorEl.textContent = 'Please enter a goal name (at least 2 characters).';
    errorEl.style.display = 'block';
    return;
  }
  if (!targetAmount || Number(targetAmount) <= 0) {
    errorEl.textContent = 'Please enter a valid target amount.';
    errorEl.style.display = 'block';
    return;
  }

  const payload = { name, targetAmount: Number(targetAmount), savedAmount: Number(savedAmount), deadline, icon };

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    errorEl.style.display = 'none';

    if (id) {
      await apiUpdateGoal(id, payload);
      showToast('Goal updated!', 'success');
    } else {
      await apiCreateGoal(payload);
      showToast('Goal created!', 'success');
    }

    closeModal('goalModal');
    loadGoals();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = id ? 'Update Goal' : 'Create Goal';
  }
}

// ─── Fund Goal ──────────────────────────────────────────────
function openFundModal(id) {
  const goal = allGoals.find(g => g.id === id);
  if (!goal) return;

  document.getElementById('fundGoalId').value = id;
  document.getElementById('fundGoalName').textContent = `Adding funds to: ${goal.icon} ${goal.name}`;
  document.getElementById('fundAmount').value = '';
  document.getElementById('fundError').style.display = 'none';
  openModal('fundModal');
}

async function handleFundGoal() {
  const errorEl = document.getElementById('fundError');
  const btn = document.getElementById('btnConfirmFund');
  const id = document.getElementById('fundGoalId').value;
  const amount = document.getElementById('fundAmount').value;

  if (!amount || Number(amount) <= 0) {
    errorEl.textContent = 'Please enter a valid amount.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Adding...';
    errorEl.style.display = 'none';

    const result = await apiFundGoal(id, Number(amount));
    showToast(result.message, 'success');

    // Trigger celebration confetti animation
    triggerConfetti();

    closeModal('fundModal');
    loadGoals();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = '💰 Add Funds';
  }
}

// ─── Confetti Celebration ───────────────────────────────────
function triggerConfetti() {
  let canvas = document.getElementById('confettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#00C9A7', '#6366F1', '#8B5CF6', '#F43F5E', '#F97316', '#F59E0B'];

  for (let i = 0; i < 90; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * (canvas.height / 2),
      r: Math.random() * 6 + 4,
      d: Math.random() * 80,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncremental: Math.random() * 0.07 + 0.05,
      tiltAngle: 0
    });
  }

  let animationFrame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.tiltAngle += p.tiltAngleIncremental;
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2;
      p.tilt = Math.sin(p.tiltAngle) * 15;

      ctx.beginPath();
      ctx.lineWidth = p.r;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
      ctx.stroke();
    });

    if (particles.some(p => p.y < canvas.height)) {
      animationFrame = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  draw();
  setTimeout(() => {
    cancelAnimationFrame(animationFrame);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 3500);
}

// ─── Edit Goal ──────────────────────────────────────────────
function handleEditGoal(id) {
  const goal = allGoals.find(g => g.id === id);
  if (!goal) {
    showToast('Goal not found.', 'error');
    return;
  }

  document.getElementById('goalId').value = goal.id;
  document.getElementById('goalName').value = goal.name;
  document.getElementById('goalTarget').value = goal.targetAmount;
  document.getElementById('goalSaved').value = goal.savedAmount;
  document.getElementById('goalDeadline').value = goal.deadline || '';
  document.getElementById('goalIcon').value = goal.icon;
  document.getElementById('goalError').style.display = 'none';

  document.getElementById('goalModalTitle').textContent = 'Edit Goal';
  document.getElementById('btnSaveGoal').textContent = 'Update Goal';
  openModal('goalModal');
}

// ─── Delete Goal ────────────────────────────────────────────
function handleDeleteGoal(id) {
  showConfirm('Are you sure you want to delete this savings goal?', async () => {
    try {
      await apiDeleteGoal(id);
      showToast('Goal deleted.', 'success');
      loadGoals();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Reset Form ─────────────────────────────────────────────
function resetGoalForm() {
  document.getElementById('goalId').value = '';
  document.getElementById('goalName').value = '';
  document.getElementById('goalTarget').value = '';
  document.getElementById('goalSaved').value = '0';
  document.getElementById('goalDeadline').value = '';
  document.getElementById('goalIcon').value = '🎯';
  document.getElementById('goalError').style.display = 'none';
}
