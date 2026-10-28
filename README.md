# TraceNet — Crime & Clue Relationship Engine

**ADBMS Final Project · SZABIST**

A modern "Sash"-style admin dashboard backed by a fully normalized SQLite
schema, real JWT authentication, transactional evidence intake (ACID demo),
audit logging, and a relationship engine — plus a companion folder of
SQL Server scripts that demonstrate the same concepts (stored procedures,
2PL, deadlocks, isolation levels) in T-SQL.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite + **TypeScript** + Tailwind CSS + Recharts + Lucide + Axios |
| Backend  | Node.js + Express + **TypeScript** + Zod + JWT + bcrypt |
| Database | SQLite via `better-sqlite3` (WAL mode, foreign keys enforced) |
| ADBMS    | `db.transaction()` · audit middleware · stored-proc routes · T-SQL scripts |

---

## Prerequisites (Windows)

1. **Node.js 20 LTS or newer** — https://nodejs.org (tick "Add to PATH")
2. **Git for Windows** — https://git-scm.com (optional but recommended)
3. **VS Code** — https://code.visualstudio.com
4. **VS Code extensions**
   - ESLint
   - Tailwind CSS IntelliSense
   - **REST Client** (for `test.http`)
5. **SQL Server Management Studio** (SSMS) — only needed for `sql-server-scripts/`

Verify Node is installed:
```powershell
node -v      # v20.x.x or newer
npm -v       # 10.x.x or newer
```

---

## Quick Start (Windows CMD or PowerShell)

### 1. Clone / extract

If you received this as a ZIP:
```powershell
Expand-Archive .\tracenet.zip -DestinationPath C:\projects
cd C:\projects\tracenet
```

### 2. Install backend

```powershell
cd server
npm install
```

Create `.env` from the example:
```powershell
Copy-Item .env.example .env
```
Then open `.env` in VS Code and (optionally) change `JWT_SECRET`.

### 3. Install frontend

```powershell
cd ..\client
npm install
```

### 4. Initialize + seed the database

The seed runs automatically on first server boot, but you can force
it manually:
```powershell
cd ..\server
npm run db:reset      # deletes tracenet.db + re-seeds
```

This creates `server/tracenet.db` with:
- 2 demo users
- 4 investigators
- 24 cases (Jan–Dec 2025)
- 15 suspects, 12 victims, 10 witnesses
- 48 evidence items with chain-of-custody
- ~36 clues linked to evidence

### 5. Start both servers

**Terminal 1 — Backend**
```powershell
cd server
npm run dev
```
Expected output:
```
🚀  TraceNet API listening on http://localhost:5000  (development)
    Demo login: admin@tracenet.local / Admin123!
```

**Terminal 2 — Frontend**
```powershell
cd client
npm run dev
```
Expected output:
```
  VITE v5.4.x  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** — the login page appears.

---

## Demo Credentials

| Email | Password | Role |
|---|---|---|
| `admin@tracenet.local`     | `Admin123!`     | admin |
| `detective@tracenet.local` | `Detective123!` | detective |

---

## What's in the App

### 🏠 Dashboard
- **4 KPI cards** with sparklines — Total Cases, Active, Solved, Total Evidence
- **Area chart** "Cases Over Time" — 12-month rolling window
- **Bar chart** "Evidence Types" — Physical / Digital / Forensic / Biological / Documentary
- **Recent Cases** table (6 rows)
- **Recent Activity** feed — pulls from `case_activity` (audit trail)

### 📁 Cases
- Debounced search, status filter, priority filter, sortable columns
- Full pagination (server-side)
- **Add Case** modal → `POST /api/cases`
- Edit / Delete / View modals — all wired to real API

### 👤 Suspects
- Search + pagination
- Add / Edit / Delete
- **Link-to-case drawer**: view all cases this suspect is attached to,
  and link/unlink cases live

### 🔍 Evidence ⭐
- Search, type/status filters, pagination
- Add / Edit / Delete
- **Chain-of-custody viewer** — full audit history per evidence item
- Log new custody events
- **Live ADBMS rollback toggle** — see "ADBMS Demo" below

### 🕸️ Relationship Engine
- Case selector dropdown
- **4-column graph**: Suspects · Victims · Witnesses · Evidence
- **Clues → Evidence connection map** — shows M:N relationships

---

## ADBMS Demonstrations

### 1. ACID Atomicity (the showpiece)

**Trigger from the UI:**
1. Go to **Evidence** → **Add Evidence**
2. Pick any case, name it `Rollback Demo`
3. ✅ Check **"ADBMS Demo: Simulate Custody Failure"**
4. Click **Create Evidence**

**Expected result:** A green toast says:
> ✅ ADBMS DEMO — Transaction rolled back atomically. No evidence row was created.

Verify in the DB:
```powershell
cd server
sqlite3 tracenet.db "SELECT * FROM evidence WHERE name='Rollback Demo';"
# → no rows returned
```

**Trigger via API** — see `test.http` file, request #7.

**What happens under the hood** (`server/src/controllers/evidence.controller.ts`):

```typescript
const createEvidenceTx = db.transaction((payload) => {
  const evId = insertEvidenceStmt.run(...).lastInsertRowid;
  if (payload.simulate_custody_failure) {
    throw new Error('SIMULATED CUSTODY INSERT FAILURE');
  }
  insertCustodyStmt.run(evId, ...);   // if this fails → whole tx rolls back
  return evId;
});
```

better-sqlite3 throws, the transaction rolls back, and **zero** rows survive.

### 2. Audit Logging

Every case-related mutation (create, update, delete, link, note, evidence
change) writes a row to the `case_activity` table with:
- `case_id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`

View them live on the Dashboard's **Recent Activity** panel, or query:
```sql
SELECT * FROM case_activity ORDER BY created_at DESC LIMIT 20;
```

### 3. Stored Procedures (SQL Server variant)

See `sql-server-scripts/stored-procedures.sql`:
- `sp_SearchCases` — parameterized + paginated search
- `sp_GetSuspectsForCase` — JOIN + CASE logic
- `sp_AddEvidenceWithCustody` — TRY/CATCH transactional insert

### 4. Locking · 2PL · Deadlocks

See `sql-server-scripts/locking-isolation.sql` and `concurrency-2pl.sql`.
Each file has numbered blocks you run in **two SSMS windows** to observe
blocking and deadlock resolution live.

### 5. Fastest way to run the SQL Server demos

```powershell
# 1. Open SSMS, connect to localhost\SQLEXPRESS
# 2. Create an empty DB
CREATE DATABASE TraceNet;
# 3. Open each .sql script, then run the DDL block at the top of
#    stored-procedures.sql to create the tables.
# 4. Open two query windows side by side.
# 5. Copy Block "A" from a demo into window 1, Block "B" into window 2.
```

---

## Windows Troubleshooting

### `better-sqlite3` fails to install
You need **Visual Studio Build Tools** (C++ workload) OR Python 3.10+.

Easiest fix:
```powershell
# Install Python from the Microsoft Store (or python.org), then:
npm install --global windows-build-tools   # legacy, may not be needed on Node 20+
npm rebuild better-sqlite3
```

Modern better-sqlite3 ships prebuilt binaries for Node 20 on Windows. If
it fails, run PowerShell as **Administrator**:
```powershell
npm install --build-from-source
```

### Port 5000 already in use
Either kill the process:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process
```
Or change `PORT=5001` in `server/.env`.

### Port 5173 already in use
```powershell
npm run dev -- --port 5174
```

### `SQLITE_BUSY` errors during demos
Kill the server, delete `tracenet.db-wal` and `tracenet.db-shm`, restart.

### CORS errors in the browser
Confirm `server/.env` has:
```
CLIENT_ORIGIN=http://localhost:5173
```
And that both processes are on `localhost` (not `127.0.0.1`).

### Database got corrupted after a crash
```powershell
cd server
npm run db:reset
```

---

## Project Layout

```
tracenet/
├── README.md                         (this file)
├── test.http                         (REST Client test suite)
├── .gitignore
│
├── sql-server-scripts/
│   ├── stored-procedures.sql         (SPs + TRY/CATCH transaction)
│   ├── locking-isolation.sql         (S/X locks + 4 isolation levels + deadlock)
│   └── concurrency-2pl.sql           (2PL demos + escalation + MVCC)
│
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   ├── tracenet.db                   (auto-created)
│   └── src/
│       ├── server.ts                 (bootstrap)
│       ├── database.ts               (schema + seed)
│       ├── reset.ts                  (drop + reseed)
│       ├── config/env.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── audit.ts              (writes case_activity)
│       │   └── errorHandler.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── cases.controller.ts
│       │   ├── suspects.controller.ts
│       │   ├── victims.controller.ts
│       │   ├── witnesses.controller.ts
│       │   ├── evidence.controller.ts  ⭐ (ACID transaction)
│       │   ├── clues.controller.ts
│       │   ├── dashboard.controller.ts
│       │   └── relationships.controller.ts
│       └── routes/                   (mounted in server.ts)
│
└── client/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/client.ts             (typed Axios + all endpoints)
        ├── context/AuthContext.tsx
        ├── components/               (Sidebar, Topbar, dropdowns, etc.)
        └── pages/
            ├── Login.tsx
            ├── Dashboard.tsx
            ├── Cases.tsx
            ├── Suspects.tsx
            ├── Evidence.tsx          ⭐ (ADBMS demo toggle)
            └── Relationships.tsx
```

---

## Verification Checklist (for the professor)

| ✔ | Check |
|---|---|
| ☐ | `npm run dev` in `server/` — no errors, DB seeded |
| ☐ | `npm run dev` in `client/` — opens at `http://localhost:5173` |
| ☐ | Login as `admin@tracenet.local / Admin123!` works |
| ☐ | Dashboard shows **24 cases**, 4 charts/cards with real numbers |
| ☐ | Cases page loads, search "arson" filters table, Add Case works |
| ☐ | Suspects page: create a suspect, then link to a case |
| ☐ | Evidence page: create evidence with the ADBMS toggle ON → rollback toast |
| ☐ | Evidence page: create evidence with toggle OFF → row persists |
| ☐ | Relationships page: select a case → 4 columns populate |
| ☐ | Audit log grows after every mutation (visible in Dashboard) |
| ☐ | `test.http` runs end-to-end without errors |
| ☐ | 3 SQL Server scripts open cleanly in SSMS |

---

## License

This project is for academic use. All data is fictional.