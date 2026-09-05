/**
 * ExpenseIQ — Advanced Analytics & Intelligence (Phase 4B)
 * Handles Health Score 2.0, Cash Flow Forecasting, Anomaly Detection,
 * Comparative Analytics, and AI Monthly Executive Reports.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!isAuthenticated()) {
    window.location.href = '/index.html';
    return;
  }

  // Chart instances tracking
  let forecastChartInstance = null;
  let trendsChartInstance = null;
  let categoryChartInstance = null;
  let monthlyHistoryChartInstance = null;

  // DOM Elements
  const analyticsMonthSelect = document.getElementById('analyticsMonthSelect');
  const comparisonMonthSelect = document.getElementById('comparisonMonthSelect');
  const forecastHorizonSelect = document.getElementById('forecastHorizonSelect');
  const reportMonthSelect = document.getElementById('reportMonthSelect');
  const btnScanAnomalies = document.getElementById('btnScanAnomalies');
  const btnGenerateReport = document.getElementById('btnGenerateReport');

  // Initialize Month Options
  await setupMonthSelectors();

  // Load All Dashboard Sections
  await refreshAnalyticsPage();

  // Event Listeners
  if (analyticsMonthSelect) {
    analyticsMonthSelect.addEventListener('change', () => {
      refreshAnalyticsPage();
    });
  }

  if (comparisonMonthSelect) {
    comparisonMonthSelect.addEventListener('change', () => {
      loadComparativeAnalytics();
    });
  }

  if (forecastHorizonSelect) {
    forecastHorizonSelect.addEventListener('change', () => {
      loadCashFlowForecast();
    });
  }

  if (btnScanAnomalies) {
    btnScanAnomalies.addEventListener('click', async () => {
      btnScanAnomalies.disabled = true;
      btnScanAnomalies.innerHTML = '<span>⏳</span> Scanning...';
      try {
        const res = await apiAnalyzeAnomalies();
        if (window.showToast) {
          window.showToast(res.message || 'Anomaly scan completed successfully.', 'success');
        }
        await loadAnomalies();
      } catch (err) {
        if (window.showToast) {
          window.showToast(err.message || 'Failed to scan anomalies', 'error');
        }
      } finally {
        btnScanAnomalies.disabled = false;
        btnScanAnomalies.innerHTML = '<span>🔍</span> Trigger Anomaly Scan';
      }
    });
  }

  if (btnGenerateReport) {
    btnGenerateReport.addEventListener('click', () => {
      generateMonthlyReport();
    });
  }

  // ─── Setup Month Selectors ───────────────────────────────────
  async function setupMonthSelectors() {
    try {
      const summary = await apiGetSummary();
      const currentMonth = new Date().toISOString().substring(0, 7);

      let months = summary.availableMonths || [];
      if (!months.includes(currentMonth)) {
        months.unshift(currentMonth);
      }

      // Populate analytics month select
      if (analyticsMonthSelect) {
        analyticsMonthSelect.innerHTML = '<option value="all">All Time / Combined</option>';
        months.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = formatMonthName(m);
          if (m === currentMonth) opt.selected = true;
          analyticsMonthSelect.appendChild(opt);
        });
      }

      // Populate comparison month select
      if (comparisonMonthSelect) {
        comparisonMonthSelect.innerHTML = '<option value="">(Previous Month)</option>';
        months.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = formatMonthName(m);
          comparisonMonthSelect.appendChild(opt);
        });
      }

      // Populate report month select
      if (reportMonthSelect) {
        reportMonthSelect.innerHTML = '';
        months.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = formatMonthName(m);
          if (m === currentMonth) opt.selected = true;
          reportMonthSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Failed to setup month selectors:', err);
    }
  }

  function formatMonthName(monthStr) {
    if (!monthStr || monthStr === 'all') return 'All Time';
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // ─── Master Refresh ──────────────────────────────────────────
  async function refreshAnalyticsPage() {
    await Promise.all([
      loadFinancialHealth(),
      loadCashFlowForecast(),
      loadAnomalies(),
      loadComparativeAnalytics(),
      loadTrendsAndBreakdowns()
    ]);
  }

  // ─── 1. Financial Health Score 2.0 ─────────────────────────────
  async function loadFinancialHealth() {
    try {
      const data = await apiGetFinancialHealth();
      if (!data) return;

      const scoreEl = document.getElementById('overallHealthScore');
      const gradeBadge = document.getElementById('healthGradeBadge');
      const grid = document.getElementById('healthComponentsGrid');
      const strengthsList = document.getElementById('healthStrengthsList');
      const weaknessesList = document.getElementById('healthWeaknessesList');
      const recsList = document.getElementById('healthRecommendationsList');

      if (scoreEl) scoreEl.textContent = data.overallScore ?? '--';

      if (gradeBadge) {
        gradeBadge.textContent = `Grade ${data.grade || 'C'}`;
        gradeBadge.className = 'badge';
        if (data.grade === 'A') gradeBadge.classList.add('badge-success');
        else if (data.grade === 'B') gradeBadge.classList.add('badge-info');
        else if (data.grade === 'C') gradeBadge.classList.add('badge-warning');
        else gradeBadge.classList.add('badge-danger');
      }

      // Render Components Grid
      if (grid && data.components) {
        grid.innerHTML = '';
        const compKeys = [
          { key: 'savingsRateScore', label: 'Savings Rate', weight: '25%' },
          { key: 'budgetAdherenceScore', label: 'Budget Adherence', weight: '20%' },
          { key: 'goalProgressScore', label: 'Goal Progress', weight: '15%' },
          { key: 'debtRatioScore', label: 'Debt Ratio', weight: '15%' },
          { key: 'expenseStabilityScore', label: 'Expense Stability', weight: '15%' },
          { key: 'emergencyFundRatioScore', label: 'Emergency Fund', weight: '10%' }
        ];

        compKeys.forEach(item => {
          const comp = data.components[item.key] || { score: 0, maxScore: 100, rating: 'Moderate' };
          const card = document.createElement('div');
          card.style.cssText = 'background: var(--bg-elevated); padding: 12px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);';
          
          let ratingColor = 'var(--accent-primary)';
          if (comp.score >= 80) ratingColor = 'var(--color-income)';
          else if (comp.score >= 60) ratingColor = 'var(--color-info)';
          else if (comp.score >= 40) ratingColor = 'var(--color-warning)';
          else ratingColor = 'var(--color-expense)';

          card.innerHTML = `
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; display: flex; justify-content: space-between;">
              <span>${item.label}</span>
              <span>w: ${item.weight}</span>
            </div>
            <div style="font-size: 1.25rem; font-weight: 800; color: ${ratingColor}; margin: 4px 0;">
              ${comp.score} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">/ 100</span>
            </div>
            <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-secondary);">
              Rating: ${comp.rating || 'Moderate'}
            </div>
          `;
          grid.appendChild(card);
        });
      }

      // Strengths
      if (strengthsList) {
        if (data.strengths && data.strengths.length > 0) {
          strengthsList.innerHTML = data.strengths.map(s => `<li style="margin-bottom:4px;">${escapeHTML(s)}</li>`).join('');
        } else {
          strengthsList.innerHTML = '<li>Keep spending disciplined to build strengths.</li>';
        }
      }

      // Weaknesses
      if (weaknessesList) {
        if (data.weaknesses && data.weaknesses.length > 0) {
          weaknessesList.innerHTML = data.weaknesses.map(w => `<li style="margin-bottom:4px;">${escapeHTML(w)}</li>`).join('');
        } else {
          weaknessesList.innerHTML = '<li>No major financial weaknesses identified.</li>';
        }
      }

      // Recommendations
      if (recsList) {
        if (data.recommendations && data.recommendations.length > 0) {
          recsList.innerHTML = data.recommendations.map(r => `<li style="margin-bottom:4px;">${escapeHTML(r)}</li>`).join('');
        } else {
          recsList.innerHTML = '<li>Continue monitoring monthly budgets and saving goals.</li>';
        }
      }
    } catch (err) {
      console.error('Failed to load financial health:', err);
    }
  }

  // ─── 2. Cash-Flow Forecast & Risk Evaluation ──────────────────
  async function loadCashFlowForecast() {
    try {
      const horizon = parseInt(forecastHorizonSelect?.value || '3', 10);
      const [forecastData, riskData] = await Promise.all([
        apiGetCashFlowForecast({ months: horizon }),
        apiGetCashFlowRisk({ months: horizon })
      ]);

      const cur = (window.getUserCurrencySymbol) ? window.getUserCurrencySymbol() : '₹';

      // Summary Cards
      if (forecastData && forecastData.averages) {
        const avgIncEl = document.getElementById('forecastAvgIncome');
        const avgExpEl = document.getElementById('forecastAvgExpense');
        const avgNetEl = document.getElementById('forecastAvgNet');
        const confEl = document.getElementById('forecastConfidence');

        if (avgIncEl) avgIncEl.textContent = `${cur}${Math.round(forecastData.averages.projectedIncome).toLocaleString()}`;
        if (avgExpEl) avgExpEl.textContent = `${cur}${Math.round(forecastData.averages.projectedExpense).toLocaleString()}`;
        if (avgNetEl) avgNetEl.textContent = `${cur}${Math.round(forecastData.averages.projectedNetCashFlow).toLocaleString()}`;
        if (confEl) {
          confEl.textContent = forecastData.modelConfidence || 'Medium';
          confEl.style.color = (forecastData.modelConfidence === 'High') ? 'var(--color-income)' : 'var(--color-info)';
        }
      }

      // Risk container
      const riskContainer = document.getElementById('cashFlowRiskContainer');
      if (riskContainer) {
        if (riskData && riskData.risks && riskData.risks.length > 0) {
          riskContainer.innerHTML = riskData.risks.map(r => {
            let badgeClass = 'badge-info';
            if (r.severity === 'HIGH' || r.severity === 'CRITICAL') badgeClass = 'badge-danger';
            else if (r.severity === 'MEDIUM') badgeClass = 'badge-warning';

            return `
              <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: var(--radius-md); border-left: 4px solid var(--color-expense); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div>
                  <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${escapeHTML(r.type || 'Cash Flow Risk')}</div>
                  <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;">${escapeHTML(r.message)}</div>
                </div>
                <span class="badge ${badgeClass}">${r.severity} RISK</span>
              </div>
            `;
          }).join('');
        } else {
          riskContainer.innerHTML = `
            <div style="background: var(--bg-elevated); padding: 12px 16px; border-radius: var(--radius-md); border-left: 4px solid var(--color-income); color: var(--color-income); font-size: 0.85rem; font-weight: 600;">
              ✅ Healthy Cash-Flow projection: No critical cash-flow deficits or high-risk factors detected for the selected horizon.
            </div>
          `;
        }
      }

      // Render Forecast Chart
      if (forecastData && forecastData.forecastMonths) {
        renderForecastChart(forecastData.historicalMonths || [], forecastData.forecastMonths || []);
      }
    } catch (err) {
      console.error('Failed to load cash flow forecast:', err);
    }
  }

  function renderForecastChart(historical, forecast) {
    const canvas = document.getElementById('cashFlowForecastChart');
    if (!canvas) return;

    if (forecastChartInstance) {
      forecastChartInstance.destroy();
    }

    const labels = [
      ...historical.map(h => formatMonthName(h.month)),
      ...forecast.map(f => `* ${formatMonthName(f.month)}`)
    ];

    const incomeData = [
      ...historical.map(h => h.income),
      ...forecast.map(f => f.projectedIncome)
    ];

    const expenseData = [
      ...historical.map(h => h.expense),
      ...forecast.map(f => f.projectedExpense)
    ];

    const netData = [
      ...historical.map(h => h.netCashFlow),
      ...forecast.map(f => f.projectedNetCashFlow)
    ];

    const lowerBounds = [
      ...historical.map(() => null),
      ...forecast.map(f => f.lowerNetBound)
    ];

    const upperBounds = [
      ...historical.map(() => null),
      ...forecast.map(f => f.upperNetBound)
    ];

    const ctx = canvas.getContext('2d');
    forecastChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Projected Net Cash-Flow',
            data: netData,
            borderColor: '#6366F1',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            fill: true,
            tension: 0.3,
            borderWidth: 3
          },
          {
            label: 'Projected Income',
            data: incomeData,
            borderColor: '#20C997',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: 'Projected Expenses',
            data: expenseData,
            borderColor: '#F43F5E',
            borderDash: [5, 5],
            tension: 0.3,
            borderWidth: 2
          },
          {
            label: 'Upper Bound',
            data: upperBounds,
            borderColor: 'rgba(148, 163, 184, 0.4)',
            borderDash: [2, 4],
            pointRadius: 0,
            borderWidth: 1
          },
          {
            label: 'Lower Bound',
            data: lowerBounds,
            borderColor: 'rgba(148, 163, 184, 0.4)',
            borderDash: [2, 4],
            pointRadius: 0,
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: 'rgba(226, 232, 240, 0.2)' } }
        }
      }
    });
  }

  // ─── 3. Expense Anomaly Detection ──────────────────────────────
  async function loadAnomalies() {
    try {
      const selectedMonth = analyticsMonthSelect?.value;
      const data = await apiGetAnomalies({ month: selectedMonth });

      const container = document.getElementById('anomaliesListContainer');
      if (!container) return;

      const anomalies = data?.anomalies || [];
      if (anomalies.length === 0) {
        container.innerHTML = `
          <div style="background: var(--bg-elevated); padding: 20px; border-radius: var(--radius-md); text-align: center; color: var(--text-muted);">
            <span>🎉</span> No expense anomalies detected for the selected period. All transactions are within normal statistical ranges.
          </div>
        `;
        return;
      }

      const cur = (window.getUserCurrencySymbol) ? window.getUserCurrencySymbol() : '₹';

      container.innerHTML = `
        <div style="overflow-x: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="text-align: left; border-bottom: 2px solid var(--border-subtle); font-size: 0.8rem; color: var(--text-secondary);">
                <th style="padding: 10px;">Date</th>
                <th style="padding: 10px;">Category</th>
                <th style="padding: 10px;">Amount</th>
                <th style="padding: 10px;">Normal Avg</th>
                <th style="padding: 10px;">Deviation</th>
                <th style="padding: 10px;">Reason</th>
                <th style="padding: 10px;">Severity</th>
              </tr>
            </thead>
            <tbody>
              ${anomalies.map(a => {
                let badgeClass = 'badge-warning';
                if (a.severity === 'CRITICAL' || a.severity === 'HIGH') badgeClass = 'badge-danger';

                return `
                  <tr style="border-bottom: 1px solid var(--border-subtle); font-size: 0.83rem;">
                    <td style="padding: 10px; font-weight: 600;">${a.date || 'N/A'}</td>
                    <td style="padding: 10px;"><span class="badge" style="background: var(--bg-elevated); color: var(--text-primary);">${escapeHTML(a.category || 'General')}</span></td>
                    <td style="padding: 10px; font-weight: 700; color: var(--color-expense);">${cur}${Number(a.amount || 0).toLocaleString()}</td>
                    <td style="padding: 10px; color: var(--text-secondary);">${cur}${Math.round(a.expectedAvg || 0).toLocaleString()}</td>
                    <td style="padding: 10px; font-weight: 600; color: var(--color-warning);">${a.deviationMultiplier ? `${a.deviationMultiplier}x` : `${a.zScore}σ`}</td>
                    <td style="padding: 10px; color: var(--text-secondary); max-width: 220px;">${escapeHTML(a.reason || 'Unusual spike')}</td>
                    <td style="padding: 10px;"><span class="badge ${badgeClass}">${a.severity || 'MEDIUM'}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      console.error('Failed to load anomalies:', err);
    }
  }

  // ─── 4. Multi-Period & Comparative Analytics ──────────────────
  async function loadComparativeAnalytics() {
    try {
      const month = analyticsMonthSelect?.value;
      const compareMonth = comparisonMonthSelect?.value;

      const data = await apiGetAnalyticsComparison({ month, compareMonth });
      const container = document.getElementById('periodComparisonContainer');
      if (!container || !data || !data.changes) return;

      const { income, expense, balance, savingsRate } = data.changes;
      const cur = (window.getUserCurrencySymbol) ? window.getUserCurrencySymbol() : '₹';

      function renderCompCard(title, val, pct, isIncomeOrSavings = true) {
        const isPositive = pct >= 0;
        let color = isIncomeOrSavings ? (isPositive ? 'var(--color-income)' : 'var(--color-expense)') : (isPositive ? 'var(--color-expense)' : 'var(--color-income)');
        let arrow = isPositive ? '▲' : '▼';

        return `
          <div style="background: var(--bg-elevated); padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">${title}</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin: 4px 0;">
              ${typeof val === 'number' ? `${cur}${Math.round(val).toLocaleString()}` : val}
            </div>
            <div style="font-size: 0.75rem; font-weight: 700; color: ${color}; display: flex; align-items: center; gap: 4px;">
              <span>${arrow}</span>
              <span>${Math.abs(pct)}% vs comparison</span>
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        ${renderCompCard('Income Change', data.current.income, income.percentageChange, true)}
        ${renderCompCard('Expense Change', data.current.expense, expense.percentageChange, false)}
        ${renderCompCard('Net Balance Change', data.current.balance, balance.percentageChange, true)}
        ${renderCompCard('Savings Rate', `${data.current.savingsRate}%`, savingsRate.percentageChange, true)}
      `;
    } catch (err) {
      console.error('Failed to load comparative analytics:', err);
    }
  }

  async function loadTrendsAndBreakdowns() {
    try {
      const month = analyticsMonthSelect?.value;
      const [trends, categories, monthly] = await Promise.all([
        apiGetAnalyticsTrends({ month }),
        apiGetAnalyticsCategories({ month }),
        apiGetAnalyticsMonthly({ months: 6 })
      ]);

      renderTrendsChart(trends?.trends || []);
      renderCategoryChart(categories?.categories || []);
      renderMonthlyHistoryChart(monthly?.monthlyHistory || []);
    } catch (err) {
      console.error('Failed to load trends and breakdowns:', err);
    }
  }

  function renderTrendsChart(trendsData) {
    const canvas = document.getElementById('analyticsTrendsChart');
    if (!canvas) return;

    if (trendsChartInstance) trendsChartInstance.destroy();

    const labels = trendsData.map(t => t.date || t.period);
    const incomeData = trendsData.map(t => t.income);
    const expenseData = trendsData.map(t => t.expense);

    const ctx = canvas.getContext('2d');
    trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: incomeData, borderColor: '#20C997', backgroundColor: 'rgba(32, 201, 151, 0.1)', tension: 0.3, fill: true },
          { label: 'Expense', data: expenseData, borderColor: '#F43F5E', backgroundColor: 'rgba(244, 63, 94, 0.1)', tension: 0.3, fill: true }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  function renderCategoryChart(categoriesData) {
    const canvas = document.getElementById('analyticsCategoryChart');
    if (!canvas) return;

    if (categoryChartInstance) categoryChartInstance.destroy();

    const labels = categoriesData.map(c => c.category);
    const amounts = categoriesData.map(c => c.amount);

    const colors = ['#20C997', '#6366F1', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6', '#10B981', '#F43F5E'];

    const ctx = canvas.getContext('2d');
    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: amounts,
          backgroundColor: colors.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } }
      }
    });
  }

  function renderMonthlyHistoryChart(monthlyData) {
    const canvas = document.getElementById('analyticsMonthlyHistoryChart');
    if (!canvas) return;

    if (monthlyHistoryChartInstance) monthlyHistoryChartInstance.destroy();

    const labels = monthlyData.map(m => formatMonthName(m.month));
    const incomeData = monthlyData.map(m => m.income);
    const expenseData = monthlyData.map(m => m.expense);

    const ctx = canvas.getContext('2d');
    monthlyHistoryChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Income', data: incomeData, backgroundColor: '#20C997', borderRadius: 4 },
          { label: 'Expense', data: expenseData, backgroundColor: '#F43F5E', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  // ─── 5. AI Executive Monthly Financial Report ────────────────
  async function generateMonthlyReport() {
    const month = reportMonthSelect?.value || new Date().toISOString().substring(0, 7);
    const container = document.getElementById('monthlyReportContainer');
    if (!container) return;

    btnGenerateReport.disabled = true;
    btnGenerateReport.innerHTML = '<span>⏳</span> Generating AI Report...';

    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <div style="font-size: 2rem; animation: aiBounce 1.4s infinite ease-in-out;">🤖</div>
        <h4 style="font-size: 1.05rem; font-weight: 700; margin-top: 12px; color: var(--text-primary);">Synthesizing AI Executive Report...</h4>
        <p style="font-size: 0.83rem; color: var(--text-muted); margin-top: 4px;">Performing multi-variable analysis across transactions, budgets, goals, health score, and cash-flow risk models.</p>
      </div>
    `;

    try {
      const data = await apiGenerateMonthlyReport({ month });
      const report = data?.report;

      if (!report || !report.sections) {
        container.innerHTML = `<div style="color:var(--color-expense); padding:20px; text-align:center;">Failed to generate structured report.</div>`;
        return;
      }

      container.innerHTML = `
        <div style="border-bottom: 2px solid var(--border-subtle); padding-bottom: 16px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin: 0;">${escapeHTML(report.title || 'Executive Financial Report')}</h3>
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px;">
              Period: <strong>${formatMonthName(report.month)}</strong> | Generated: ${new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
          <span class="badge badge-success" style="font-size: 0.85rem; padding: 6px 14px;">Phase 4B AI Verified</span>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${report.sections.map((sec, idx) => `
            <div style="background: var(--bg-surface); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); border-left: 4px solid var(--accent-primary);">
              <h4 style="font-size: 1.02rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                <span style="color: var(--accent-primary); font-weight: 800;">${idx + 1}.</span>
                <span>${escapeHTML(sec.title)}</span>
              </h4>
              <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.55; white-space: pre-line;">${escapeHTML(sec.content)}</p>
            </div>
          `).join('')}
        </div>
      `;
    } catch (err) {
      console.error('Failed to generate report:', err);
      container.innerHTML = `
        <div style="background: var(--bg-elevated); padding: 20px; border-radius: var(--radius-md); border-left: 4px solid var(--color-expense); color: var(--color-expense);">
          <strong>Report Generation Error:</strong> ${escapeHTML(err.message || 'Unable to contact AI service.')}
        </div>
      `;
    } finally {
      btnGenerateReport.disabled = false;
      btnGenerateReport.innerHTML = '<span>✨</span> Generate Report';
    }
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
