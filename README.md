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
