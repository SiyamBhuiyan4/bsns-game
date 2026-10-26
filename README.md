# Marketing Performance System (MPS)

> A modern, results-driven marketing operations and sales tracking platform built for high-velocity marketing teams and digital marketers.

---

## 1. Project Overview & Business Context

The **Marketing Performance System (MPS)** is an end-to-end platform engineered to eliminate marketing opacity, enforce daily posting discipline, track CRM lead pipelines, calculate objective 5-dimension performance scores, and empower leadership with automated weekly strategic insights and 90-day execution plans.

### Core Value Propositions
- **Segmented Audience Outreach**: Group Facebook communities into structured sections with automated duplicate-detection CSV ingestion.
- **Single-Click Task Queue**: Marketers receive clean daily queues of Facebook groups, open links directly, and mark tasks complete with instantaneous undo protection.
- **Strict Data Integrity**: Daily sales, profit, client acquisition, and reflections are locked into strict submission windows in the `Asia/Dhaka` timezone.
- **5-Dimensional Weighted Scoring**: Objective evaluation spanning Revenue & Margin (30%), Content/Posting (20%), New Buyers/B2B (20%), Retention (15%), and Follow-ups (15%).
- **Automated Sunday Strategic Reports**: Aggregates top-performing products, campaign ROAS, pipeline drop-offs, and prompts leadership with 5 structured strategic review questions.
- **90-Day Execution Engine**: Breaks quarterly growth into three 30-day phases with task owners, due dates, and milestone reviews.

---

## 2. Tech Stack & Architecture

```
+-----------------------------------------------------------------------------------+
|                                 Next.js 15 App Router                             |
|  +-------------------------------------+  +------------------------------------+  |
|  |     Admin Web Experience (/admin)   |  |   Employee Web Experience (/employee)|  |
|  |  Sections, Targets, Budgets, Reports |  |   Task Queue, Daily Entry, Leads   |  |
|  +-------------------------------------+  +------------------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  |                           Secure REST API Layer (/api)                      |  |
|  |       Auth, Sections, CSV, Tasks, Daily Entry, Leads, Plan, Cron, Audit     |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
|  Libraries: Zod (Validation) | Jose (JWT Auth) | Bcrypt.js | ExcelJS | PDFKit     |
+-----------------------------------------------------------------------------------+
|                              Prisma ORM 6.4.1 Client                              |
+-----------------------------------------------------------------------------------+
|                           PostgreSQL Relational Database                          |
+-----------------------------------------------------------------------------------+
```

- **Framework**: [Next.js 15.2](https://nextjs.org/) (App Router, Server Actions, Route Handlers)
- **UI & Styling**: [React 19](https://react.dev/), [Tailwind CSS 4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM 6.4](https://www.prisma.io/)
- **Authentication**: Stateless HMAC-SHA256 JWT using [jose](https://github.com/panva/jose) in HttpOnly cookies, bcryptjs (Cost 12) password hashing
- **Data Validation**: [Zod 4](https://zod.dev/) input validation and sanitization
- **Reporting & Exports**: [ExcelJS](https://github.com/exceljs/exceljs) & [PDFKit](https://pdfkit.org/) for automated spreadsheet and executive document generation
- **Testing**: [Vitest 5](https://vitest.dev/) integration and unit test runner

---

## 3. Environment Variables Setup

Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Configure the following environment variables:

| Variable | Description | Example Value |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@localhost:5432/marketing_performance` |
| `JWT_SECRET` | **Required in production.** 32+ character random secret for JWT signing. Generate one with `openssl rand -base64 48`; never copy an example. | *(generate your own)* |
| `ADMIN_PASSWORD` | Default password used when seeding the initial Admin user | `AdminPassword123!` |
| `ADMIN_PASSCODE` | Passcode for the `/admin-login` page | *(generate your own)* |
| `NEXT_PUBLIC_APP_TIMEZONE` | Business timezone for daily locks and date math | `Asia/Dhaka` |
| `CRON_SECRET` | **Required in production.** Bearer token the `/api/cron/*` endpoints demand. Without it those endpoints refuse every request. | *(generate your own)* |

> The app refuses to start in production if `JWT_SECRET` is missing or still set to a development placeholder: an unset signing secret would let anyone mint an admin session. The same applies to `CRON_SECRET` when a cron endpoint is called.

---

## 4. Database Setup & Seeding

Ensure your local or remote PostgreSQL instance is running, then execute migrations:

```bash
# 1. Generate Prisma Client
npx prisma generate

# 2. Apply database migrations
npx prisma migrate dev --name init

# 3. Seed initial admin, products, sections, and default scoring settings
npm run prisma:seed
# Or:
npx tsx prisma/seed.ts
```

### Default Seed Credentials
- **Admin Account**: `admin@company.com` / Password: `AdminPassword123!` (or value from `ADMIN_PASSWORD`)
- **Default Marketer Accounts**:
  - `employee1@company.com` / `EmployeePass123!`
  - `employee2@company.com` / `EmployeePass123!`

---

## 5. Development & Running the Application

```bash
# Start Next.js development server
npm run dev

# Build production bundle
npm run build

# Start production server
npm run start

# Run ESLint checks
npm run lint
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 6. How to Run Tests (Vitest)

The test suite covers authentication security, CSV processing, daily entry edit windows, performance scoring math, pro-rating engines, weekly reports, and 90-day plan management.

```bash
# Run all test suites
npm test

# Run a specific test suite
npx vitest run tests/auth.test.ts
npx vitest run tests/csv.test.ts
npx vitest run tests/targets.test.ts
npx vitest run tests/scoring.test.ts
npx vitest run tests/plan-api.test.ts

# Run tests in watch mode
npx vitest
```

> [!TIP]
> Database integration tests create and clean up test records against the database configured in `DATABASE_URL`. Ensure your test database is migrated and accessible before running tests.

---

## 7. How to Run Scheduled Cron Jobs

The system provides automated background cron endpoints to maintain data locks and compile weekly drafts.

### Available Cron Endpoints
1. **Daily Lock Window (`/api/cron/daily-lock`)**:
   - Evaluates all past entries against `ScoringSettings.employee_edit_window_days` in `Asia/Dhaka` timezone and ensures previous days are locked from modification.
2. **Sunday Weekly Report Draft (`/api/cron/weekly-report` or `/api/cron/weekly-report-draft`)**:
   - Executes weekly every Sunday at 09:00 AM Dhaka time.
   - Computes previous week's total sales, top products, ad spend ROAS, and lead pipeline conversion rates.
   - Instantiates a `DRAFT` weekly report with the 5 structured strategic review questions ready for the Head of Marketing.

### Triggering via Linux Crontab
```cron
# Daily lock at 00:05 AM Asia/Dhaka
5 0 * * * curl -X POST -H "Authorization: Bearer secure-cron-secret-token" https://marketing.yourdomain.com/api/cron/daily-lock

# Sunday Weekly Report Draft at 09:00 AM Asia/Dhaka
0 9 * * 0 curl -X POST -H "Authorization: Bearer secure-cron-secret-token" https://marketing.yourdomain.com/api/cron/weekly-report
```

### Triggering via Vercel Cron (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-lock",
      "schedule": "5 18 * * *"
    },
    {
      "path": "/api/cron/weekly-report",
      "schedule": "0 3 * * 0"
    }
  ]
}
```
*(Note: Vercel Cron expressions use UTC. 00:05 AM Dhaka = 18:05 UTC previous day; 09:00 AM Dhaka Sunday = 03:00 UTC Sunday).*

---

## 8. Security & Deployment Architecture

### Security Controls
- **Bcrypt (Cost 12)**: Industry-standard password hashing with individual salting.
- **JWT in HttpOnly Cookies**: Protection against Cross-Site Scripting (XSS).
- **IP Rate Limiting**: In-memory sliding window rate limiter allowing max 5 login attempts per minute per IP to thwart brute force attacks.
- **Strict Role-Based Scoping**:
  - Admins cannot submit daily performance entries (HTTP 403 rule).
  - Marketers can only view and mutate their assigned sections, task links, and own leads.
- **Tamper-Evident Audit Logging**: Every critical mutation (`LOGIN`, `CREATE`, `UPDATE`, `DELETE`, `UNDO`, `REPORT_PUBLISH`, `TARGET_SET`) is preserved with actor, timestamp, IP, and payload snapshot in `AuditLog`.
- **Timezone Standardization**: All business day roll-overs, lock windows, and weekly intervals are pinned to `Asia/Dhaka` (UTC+6) irrespective of host server location.

### Production Deployment Checklist
1. Set strong, freshly generated values for `JWT_SECRET`, `CRON_SECRET`, `ADMIN_PASSCODE` and `ADMIN_PASSWORD` — the app refuses to boot without the first, and the cron endpoints refuse to run without the second.
2. Configure a managed PostgreSQL database with automatic backups and connection pooling.
3. Set `NODE_ENV=production` and build Next.js using `npm run build`.
4. Deploy behind a secure reverse proxy (Nginx, Caddy, Vercel, or AWS ECS/App Runner) with TLS/SSL enabled.

---

## 9. Comprehensive Documentation

- [Detailed REST API Documentation (docs/API.md)](file:///Users/mdyeakubsarker/Documents/game%20of%20bsns/docs/API.md) - Complete endpoints, parameters, JSON payloads, responses, and error codes.
- [বাংলা ব্যবহারকারী নির্দেশিকা (docs/USER_GUIDE_BN.md)](file:///Users/mdyeakubsarker/Documents/game%20of%20bsns/docs/USER_GUIDE_BN.md) - হেড অব মার্কেটিং ও ডিজিটাল মার্কেটারদের জন্য বিস্তারিত বাংলা ইউজার ম্যানুয়াল।
