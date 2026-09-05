# ExpenseIQ — Intelligent Personal Finance Tracker

ExpenseIQ is a full-stack personal finance management application built with Node.js, Express, MongoDB (with automated development JSON storage fallback), and a modern vanilla JavaScript frontend. It features security-hardened OpenAI AI Assistant integration, Financial Health Score 2.0, Cash-Flow Forecasting, Expense Anomaly Detection, Bill Reminders, Recurring Transaction Automation, and Notification Center alerts.

---

## 🌟 Key Features Overview

### Phase 4B: Advanced Financial Intelligence & Analytics
1. **Financial Health Score 2.0 (`/api/financial-health`)**
   - Transparent 0–100 overall score evaluated across 6 weighted sub-components:
     * **Savings Rate Score** (weight 25%)
     * **Budget Adherence Score** (weight 20%)
     * **Goal Progress Score** (weight 15%)
     * **Debt Ratio Score** (weight 15%)
     * **Expense Stability Score** (weight 15%)
     * **Emergency Fund Ratio Score** (weight 10%)
   - Letter grade assignments (`A`, `B`, `C`, `D`, `F`) with identified strengths, weaknesses, and personalized recommendations.

2. **Cash-Flow Forecasting & Risk Evaluation (`/api/cash-flow`)**
   - Deterministic 1–12 month cash-flow model based on weighted moving averages and upper/lower variance bounds.
   - Risk evaluation system identifying cash-flow deficits, income volatility, accelerating expense growth, and short emergency fund runways.

3. **Expense Anomaly Detection (`/api/anomalies`)**
   - Automated statistical outlier detection (Z-Score $\ge 2.0$ or category spending ratio $\ge 1.5\times$ expected average).
   - Trigger scan integration with Notification Center for real-time anomaly alerts.

4. **Advanced Analytics & Comparative Trends (`/api/analytics`)**
   - Multi-period comparison (% change in income, expenses, net balance, and savings rate).
   - Category breakdown, trend history, and stacked monthly performance visualizations.

5. **AI-Powered Monthly Financial Report (`/api/financial-reports`)**
   - 10-section structured AI executive summary: Executive Summary, Income Analysis, Expense Breakdown, Budget vs Actual, Goal Tracking, Savings & Cash Flow, Cash-Flow Risk, Anomaly Summary, Health Score Breakdown, and Actionable AI Recommendations.

### Phase 4A & Core Features
- **Recurring Transactions (`/api/recurring`)**: Automated recurring income/expense execution (`daily`, `weekly`, `monthly`, `quarterly`, `yearly`) with month-end safety (e.g. Jan 31 + 1m $\rightarrow$ Feb 28/29) and concurrency claim protection.
- **Bill Reminders (`/api/reminders`)**: Upcoming/overdue bill tracking, status transitions, and completion timestamps.
- **Notification Center (`/api/notifications`)**: Periodic unread badge updates, configurable `reminderDaysBefore` window (0–30 days), budget threshold alerts (70%, 90%, 100%), and goal milestone notifications.
- **AI Financial Assistant (`/api/ai/chat`)**: Security-hardened assistant with prompt-injection defenses, rate limiting (HTTP 429), and strict 503 provider error fallbacks.

---

## 🔒 Security Model & Storage Architecture

### Database Storage & Development Fallback
- **MongoDB**: Used as primary database storage when configured and connected (`MONGODB_URI`).
- **JSON File Fallback**: Automatically activates when MongoDB is unavailable or disconnected, persisting local development data in `data/*.json` files.
- **Degraded Status Reporting**: `GET /api/health` accurately reports database status (`connected` or `degraded`).

### Security Controls
- **JWT Authentication**: Password hashing with `bcryptjs` and signed JWT bearer tokens.
- **Strict User Isolation**: All query operations enforce `userId` scoping based on authenticated token payload. Body, query, or parameter `userId` overrides are strictly ignored.
- **AI Prompt-Injection Protection**: Untrusted input fields (notes, category names, goal titles) are strictly delimited in prompt construction. System instructions enforce trust hierarchy.
- **Rate Limiting**: Rate limiter middleware prevents brute-force abuse on authentication and AI endpoints.

---

## 🛠️ Environment Variables & Installation

Copy `.env.example` to create your local `.env` configuration:

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

# Recurring Scheduler Configuration
RECURRING_SCHEDULER_ENABLED=false
RECURRING_SCHEDULER_INTERVAL=3600000
```

### Installation & Execution
```bash
npm install
npm run dev
```

Server will start on `http://localhost:3000`.

---

## 🧪 Testing Instructions

Run the full automated deterministic test suite:

```bash
npm test
```

All 15 test suites execute deterministically using isolated storage environments:
1. `analytics.test.js`
2. `cash_flow.test.js`
3. `anomalies.test.js`
4. `financial_health.test.js`
5. `financial_reports.test.js`
6. `notifications.test.js`
7. `recurring.test.js`
8. `reminders.test.js`
9. `security_isolation.test.js`
10. `ai_deterministic.test.js`
11. `ai_endpoints.test.js`
12. `context.test.js`
13. `context_accuracy.test.js`
14. `regression.test.js`
15. `test_isolation_regression.test.js`

---

## 📌 Limitations
- **Cash-Flow Forecasting**: Uses deterministic weighted moving averages and active recurring transactions. It does not employ complex neural network or machine learning models.
- **AI Provider Dependency**: OpenAI API calls require a valid `OPENAI_API_KEY`. When offline or unavailable, ExpenseIQ falls back gracefully to structured deterministic reports and HTTP 503 provider responses.
