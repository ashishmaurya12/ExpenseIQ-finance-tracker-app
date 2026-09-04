# ExpenseIQ — Intelligent Personal Finance Tracker

ExpenseIQ is a full-stack personal finance application built with Node.js, Express, MongoDB (with JSON storage fallback), and a modern vanilla JS frontend. It features deterministic insights, security-hardened OpenAI AI Assistant integration, and automated personal finance tools.

---

## Phase 4A Features

### 1. Recurring Transactions
- Automates recurring income and expenses (`daily`, `weekly`, `monthly`, `quarterly`, `yearly`).
- Features safe month-end date calculations (e.g., Jan 31 + 1 month $\rightarrow$ Feb 28/29).
- Controlled auto-creation service `processDueRecurringTransactions()` with strict idempotency checks to prevent duplicate transactions.

### 2. Bill & Payment Reminders
- Tracks upcoming and overdue bill payments.
- Automatic overdue status transitions for past pending bills.
- Full completion workflow marking bills completed with timestamps.

### 3. Notification Center
- Smart notification center with periodically refreshed unread notification badge, pagination, mark read, mark all read, and deletion.
- Configurable `reminderDaysBefore` window (0–30 days, default 3) controlling when reminder notifications trigger.
- Automated deduplicated alert generation for bill due dates (due today, due tomorrow, overdue) using MongoDB compound unique indexes (`userId` + `dedupKey`).
- User preference toggles (`notificationsEnabled`, `reminderAlertsEnabled`) to control notification generation and badge rendering.
- Budget utilization threshold alerts (70%, 90%, 100%).
- Savings goal milestone alerts and deadline warnings.

---

## Phase 4B Features — Advanced Financial Intelligence & Automation

### 1. Financial Health Score 2.0
- Transparent 0–100 overall score evaluated across 6 weighted sub-components:
  * Savings Rate Score (weight 25%)
  * Budget Adherence Score (weight 20%)
  * Goal Progress Score (weight 15%)
  * Debt Ratio Score (weight 15%)
  * Expense Stability Score (weight 15%)
  * Emergency Fund Ratio Score (weight 10%)
- Grade assignments (`A`, `B`, `C`, `D`, `F`) with identified strengths, weaknesses, and personalized recommendations.

### 2. Cash-Flow Forecasting & Risk Evaluation
- Deterministic 1–12 month cash-flow model based on weighted moving averages and variance bounds (upper/lower confidence intervals).
- Risk evaluation system identifying cash-flow deficits, income volatility, accelerating expense growth, and short emergency fund runways.

### 3. Expense Anomaly Detection
- Automated statistical outlier detection (Z-Score > 2.0 or category spike > 1.5x expected average).
- Trigger scan integration with Notification Center for real-time anomaly alerts.

### 4. Advanced Analytics & Comparative Trends
- Multi-period comparison (% change in income, expenses, net balance, and savings rate).
- Category breakdown, trend history, and stacked monthly performance visualizations.

### 5. AI-Powered Monthly Financial Report
- 10-section structured AI executive summary: Executive Summary, Income Analysis, Expense Breakdown, Budget vs Actual, Goal Tracking, Savings & Cash Flow, Cash-Flow Risk, Anomaly Summary, Health Score Breakdown, and Actionable AI Recommendations.


---

## API Endpoints (Phase 4A)

### Recurring Transactions (`/api/recurring`)
- `GET /api/recurring` — List user's recurring transactions (paginated).
- `POST /api/recurring` — Create a recurring transaction schedule.
- `GET /api/recurring/:id` — Get recurring transaction details.
- `PUT /api/recurring/:id` — Update recurring transaction.
- `DELETE /api/recurring/:id` — Delete recurring transaction schedule.
- `POST /api/recurring/process` — Trigger due recurring transaction auto-creation.

### Bill Reminders (`/api/reminders`)
- `GET /api/reminders` — List user's bill reminders (supports status filter).
- `POST /api/reminders` — Create a new bill reminder.
- `GET /api/reminders/:id` — Get reminder details.
- `PUT /api/reminders/:id` — Update reminder.
- `DELETE /api/reminders/:id` — Delete reminder.
- `POST /api/reminders/:id/complete` — Mark reminder as completed.

### Notification Center (`/api/notifications`)
- `GET /api/notifications` — List notifications with pagination (`page`, `limit`).
- `PUT /api/notifications/:id/read` — Mark notification as read.
- `POST /api/notifications/read-all` — Mark all user notifications as read.
- `DELETE /api/notifications/:id` — Delete notification.

### Advanced Analytics (`/api/analytics`)
- `GET /api/analytics/overview` — Get financial metrics overview for period.
- `GET /api/analytics/trends` — Get spending/income trends.
- `GET /api/analytics/categories` — Get expense category breakdown.
- `GET /api/analytics/monthly` — Get historical monthly performance.
- `GET /api/analytics/comparison` — Compare two monthly periods.

### Cash-Flow Forecasting (`/api/cash-flow`)
- `GET /api/cash-flow/forecast` — Deterministic 1–12 month cash-flow forecast with confidence bounds.
- `GET /api/cash-flow/risk` — Risk evaluation for cash-flow deficits, volatility, and runway.

### Expense Anomalies (`/api/anomalies`)
- `GET /api/anomalies` — List statistical transaction outliers.
- `POST /api/anomalies/analyze` — Trigger anomaly scan and notification alerts.

### Financial Health (`/api/financial-health`)
- `GET /api/financial-health` — Get Health Score 2.0 (0–100, 6 components, grade, strengths, weaknesses).
- `GET /api/financial-health/recommendations` — Get personalized health recommendations.

### AI Monthly Reports (`/api/financial-reports`)
- `GET /api/financial-reports/monthly` — Generate 10-section AI executive monthly report.

---

## Environment Variables

Configure your environment in `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/expenseiq
JWT_SECRET=replace_with_a_long_random_secure_secret_key
JWT_EXPIRES_IN=1h
FRONTEND_URL=http://localhost:3000
NODE_ENV=development

# AI Assistant Configuration
AI_ENABLED=true
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Recurring Scheduler Configuration (Phase 4A)
RECURRING_SCHEDULER_ENABLED=false
RECURRING_SCHEDULER_INTERVAL=3600000
```

---

## Running the Application

### Development Server
```bash
npm run dev
```
Or start server:
```bash
npm start
```

Access application at `http://localhost:3000`.

---

## Testing Instructions

Run the full automated deterministic test suite:

```bash
npm test
```

All tests run offline without external API dependencies using Node.js native test runner (`node --test`).
