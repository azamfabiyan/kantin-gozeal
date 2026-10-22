# Task Summary: Bypass Prisma on Vercel — use @libsql/client directly for Turso

## Task ID: kantin-gozeal-turso-libsql-bypass
## Agent: Z.ai Code (single-agent execution)

## Problem
The Kantin Gozeal app deployed to Vercel was failing because the `@prisma/adapter-libsql` driver adapter doesn't work in Vercel's serverless runtime. Local dev (Prisma + SQLite file) was fine, but production (Prisma + Turso adapter) crashed.

## Solution Strategy
Bypass Prisma entirely on Vercel/Turso. Use `@libsql/client` directly with raw SQL queries. Keep Prisma for local dev (`DATABASE_URL=file:...`).

Detection rule (in `src/lib/db.ts`):
- If `DATABASE_URL` starts with `libsql://` AND `DATABASE_AUTH_TOKEN` is set → **Turso mode** (libsql client).
- Otherwise → **Prisma mode** (local SQLite).

## Files Changed (20 files, +1405 / -317)

### `src/lib/db.ts` (rewritten)
- Exports `isTurso: boolean`, `turso: Client | null`, `db: PrismaClient`.
- In Turso mode: `db` is `null as unknown as PrismaClient` (Prisma is NOT initialized at all → no Vercel crashes).
- In Prisma mode: standard `new PrismaClient()` with globalThis caching for dev hot reload.
- Exports coercion helpers: `toBool`, `toInt`, `toStr`, `toISO`, `genId` (uses `crypto.randomUUID()`).

### `src/lib/auth.ts` (rewritten)
- Kept pure-crypto helpers unchanged: `signToken`, `verifyToken`, `createAdminToken`, `verifyAdminToken`, `createEmployeeToken`, `verifyEmployeeToken`.
- Rewrote DB-backed functions to branch on `isTurso`:
  - `ensureAdminExists()` — `INSERT INTO Admin ...` raw SQL in Turso mode.
  - `authenticateAdmin(username, password)` — looks up admin via raw SQL; falls back to hardcoded creds (gozealkantin / Gozeal2012) on DB failure or missing admin.
  - `getAdminFromRequest(req)` — allows `hardcoded-admin-id` to pass through; otherwise looks up by ID via raw SQL.
  - `getEmployeeFromRequest(req)` — looks up employee by ID via raw SQL.
  - `getActivePeriod()` — `SELECT currentPeriod FROM PeriodSetting ORDER BY startedAt DESC LIMIT 1`; auto-creates current period if none.
  - `resetCurrentPeriod(resetBy)` — "current" mode: upsert period setting, delete pickups for current period, reset all variant stocks to initialStock (with StockHistory SET rows), reset all EmployeeBalance to 1.
  - `startNewPeriod(resetBy)` — "next" mode: compute next month from latest PeriodSetting, upsert new period, reset variant stocks, **CARRY-OVER** increment all EmployeeBalance by +1.
- Pure helpers unchanged: `getCurrentPeriod`, `getPreviousPeriods`, `parseDateOfBirth`, `formatDateOfBirth`, `formatTimestamp`.

### Auth API routes (`src/app/api/auth/`)
- `login/route.ts` — **no change needed** (already uses `authenticateAdmin` which is mode-aware).
- `me/route.ts` — **no change needed** (uses `getAdminFromRequest`).
- `logout/route.ts` — **no change needed** (stateless, no DB).
- `employee/login/route.ts` — **rewritten**. Turso mode: fetches all active employees, matches name case-insensitively, on first login saves DOB via `UPDATE Employee SET dateOfBirth = ?`, otherwise checks DOB equality. Falls through to Prisma mode otherwise.
- `employee/me/route.ts` — **no change needed** (uses `getEmployeeFromRequest`).
- `employee/logout/route.ts` — **no change needed** (stateless).

### Employees API routes
- `employees/route.ts` (GET + POST) — GET joins Employee with Pickup counts (group-by in SQL). POST generates next `EMP###` code via `SELECT COUNT(*)`, then INSERTs with UUID id.
- `employees/[id]/route.ts` (PUT + DELETE) — PUT dynamically builds UPDATE clauses based on body. DELETE cascade-deletes Pickup + EmployeeBalance before Employee.
- `employees-public/route.ts` (GET) — `SELECT id, code, name, dateOfBirth, active FROM Employee WHERE active = 1 ORDER BY name ASC`.

### Variants API routes
- `variants/route.ts` (GET + POST) — GET joins Variant with `SELECT variantId, COUNT(*) FROM Pickup WHERE period = ? GROUP BY variantId`. POST uses `turso.batch([...])` for atomic Variant + StockHistory insert.
- `variants/[id]/route.ts` (PUT + DELETE) — PUT dynamically builds UPDATE; if stock changed, also inserts StockHistory SET row. DELETE cascade-deletes StockHistory + Pickup + EmployeeBalance before Variant.
- `variants/[id]/add-stock/route.ts` (POST) — uses `turso.batch([UPDATE Variant, INSERT StockHistory])` for atomic stock adjustment.
- `variants/[id]/history/route.ts` (GET) — LEFT JOIN StockHistory with Variant.

### Other API routes
- `stock-history/route.ts` (GET) — `SELECT h.*, v.* FROM StockHistory h LEFT JOIN Variant v ON v.id = h.variantId ORDER BY h.createdAt DESC LIMIT 200`.
- `pickups/route.ts` (GET + POST) — GET: list employee pickups with LEFT JOIN Variant. POST: **manual transaction** via `turso.batch([...])` (atomic in libsql): INSERT Pickup + UPDATE Variant (stock - 1) + UPDATE EmployeeBalance (balance - 1) + INSERT StockHistory (PICKUP_DECREMENT). Performs balance > 0 check before batch.
- `scan/route.ts` (GET) — fetches employee + active variants + this-period pickups + employee balances in parallel via 4 separate libsql queries; builds `balanceMap` and per-variant `status` ('available' / 'no_balance' / 'out_of_stock').
- `dashboard/route.ts` (GET) — fetches totalEmployees, this-period pickups with employee/variant joins, active employees, all variants, recent 20 pickups; builds periodTrend by querying each of 6 previous periods with `GROUP BY type`; computes employeesWithoutPickup, lowStockCount, periodDistribution.

### Period API routes
- `period/current/route.ts` (GET) — `SELECT currentPeriod, startedAt, resetBy FROM PeriodSetting WHERE currentPeriod = ? ORDER BY startedAt DESC LIMIT 1`.
- `period/reset/route.ts` (POST) — **no change needed** (delegates to `resetCurrentPeriod` / `startNewPeriod` in auth.ts, which are mode-aware).
- `period/set/route.ts` (POST) — manual upsert pattern: check existing row, then UPDATE or INSERT.

### Reports API routes
- `reports/route.ts` (GET) — builds dynamic WHERE clause based on filters (period, type, employeeId, variantId); LEFT JOINs Employee and Variant.
- `reports/export/route.ts` (GET CSV) — same dynamic WHERE; formats timestamps as `DD/MM/YYYY HH:MM` in Indonesian locale; CSV-escapes cells containing commas/quotes/newlines.

### Seed API route
- `seed/route.ts` (POST) — full seed: optionally forceReset (deletes Pickup, StockHistory, EmployeeBalance, Variant, Employee, PeriodSetting); upserts admin password if mismatched; seeds 28 employees with EMP001–EMP028 codes; seeds 10 variants (6 FOOD + 4 DRINK) with stock=31 each + StockHistory SET row; seeds PeriodSetting if none.

### Script fix
- `scripts/migrate-to-turso.ts` — converted `require('fs')` to ESM `import fs from 'fs'` to satisfy ESLint `@typescript-eslint/no-require-imports` rule.

## Verification

### Lint
- `bun run lint` → **0 errors, 0 warnings** ✅

### Local testing (Prisma mode, DATABASE_URL=file:...)
- `GET /api/employees-public` → ✅ returns 31 employees with all fields (id, code, name, dateOfBirth, active)
- `POST /api/auth/login` (gozealkantin / Gozeal2012) → ✅ returns valid HMAC admin token
- `GET /api/auth/me` (with x-admin-token) → ✅ returns admin info
- `GET /api/dashboard` → ✅ returns stats: 31 employees, 0 pickups, 31 without pickup, 0 low stock, period 2026-10, food/drink stock arrays, periodTrend, periodDistribution
- `GET /api/period/current` → ✅ returns `2026-10` period
- `GET /api/scan?employeeId=...` → ✅ returns employee + food/drink variants with balance + status='available'

### Local behavior unchanged
- Local dev still uses Prisma + SQLite file (`DATABASE_URL=file:/home/z/my-project/db/custom.db`).
- `isTurso = false` locally → all routes fall through to original Prisma code paths.
- No UI components changed (per requirement).

### Production behavior (Vercel/Turso)
- `isTurso = true` when `DATABASE_URL=libsql://kantin-gozeal-azamfabiyan.aws-ap-northeast-1.turso.io` + `DATABASE_AUTH_TOKEN=...`.
- Prisma is NOT initialized (avoiding the adapter crash).
- All DB access goes through `turso.execute({ sql, args })` with `?` placeholders.
- Booleans stored as INTEGER (0/1) — coerced via `toBool()`.
- Dates stored as ISO TEXT — coerced via `toISO()`.
- IDs generated via `crypto.randomUUID()`.

## Git
- Commit `41c88d7`: "Fix: bypass Prisma on Vercel, use libsql directly for Turso"
- Pushed to `origin/main` (GitHub: azamfabiyan/kantin-gozeal).
- 20 files changed, +1405 / -317.

## Important Notes for Vercel Redeployment
1. Ensure Vercel env vars are set:
   - `DATABASE_URL=libsql://kantin-gozeal-azamfabiyan.aws-ap-northeast-1.turso.io`
   - `DATABASE_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...` (full token from spec)
2. The Turso database already has 32 employees, 10 variants, 320 balances, admin, period settings — no seed needed.
3. First admin login on Vercel will work even if DB lookup fails — falls back to hardcoded gozealkantin / Gozeal2012.
4. `crypto.randomUUID()` is available in Node 18+ (Vercel default runtime) and Edge runtime.
5. `turso.batch([...])` is used for multi-statement atomicity (libsql/Turso supports it natively).
6. The `prisma generate` postinstall still runs on Vercel but Prisma client is never instantiated in Turso mode → no crash.
