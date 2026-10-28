/* =====================================================================
   TraceNet — Two-Phase Locking (2PL) — SQL Server / T-SQL
   ---------------------------------------------------------------------
   2PL ensures SERIALIZABILITY by making every transaction:
      Phase 1 (GROWING)   : acquire locks, never release any
      Phase 2 (SHRINKING) : release locks at COMMIT/ROLLBACK, never acquire
   
   Strict 2PL (the safe default in SQL Server) holds ALL locks until
   COMMIT/ROLLBACK — this is what SQL Server does by default for
   strictness, prevents cascading rollbacks.
   ---------------------------------------------------------------------
   Run each numbered block in its own SSMS query window.
   ===================================================================== */

USE TraceNet;
GO

/* =====================================================================
   DEMO A — Strict 2PL working correctly
   =====================================================================
   Two "users" both try to update the SAME case. 2PL forces serialization.
   The second one waits, then succeeds — no lost update.
   ===================================================================== */

/* ---------- Window #1 (User A) ---------- */
BEGIN TRANSACTION;
    -- Acquire X lock (growing phase)
    UPDATE cases SET status = 'Active' WHERE id = 20;

    -- Simulate work
    WAITFOR DELAY '00:00:04';

    -- This is still the growing phase — no locks released yet
    -- Would fail here if any other TX held a blocking lock:
    SELECT * FROM cases WHERE id = 20;

COMMIT TRANSACTION;
-- Now shrinking phase: all locks released atomically.

/* ---------- Window #2 (User B) — start 1 second later ---------- */
BEGIN TRANSACTION;
    -- B tries to acquire the same X lock → BLOCKS (2PL protocol)
    -- It will wait until A commits.
    UPDATE cases SET status = 'Pending' WHERE id = 20;

    SELECT * FROM cases WHERE id = 20;

COMMIT TRANSACTION;

/* ---------- Expected outcome ---------- */
/*
   Timeline:
   t=0s   A: BEGIN, acquires X on row 20
   t=1s   B: BEGIN, tries X on row 20 → BLOCKED (waiting for A)
   t=4s   A: COMMIT → releases X
   t=4s   B: acquires X, updates row 20
   t=5s   B: COMMIT

   Final status = 'Pending' (B wins, no lost update)
   Both transactions ran IN FULL; 2PL serialized them.
*/


/* =====================================================================
   DEMO B — 2PL with SELECT (Shared lock then Upgrade)
   =====================================================================
   Shows the classic "S → X upgrade" scenario and why proper 2PL matters.
   ===================================================================== */

/* ---------- Window #1 ---------- */
BEGIN TRANSACTION;
    -- Acquire S lock (shared reader)
    SELECT * FROM cases WHERE id = 21;

    -- Later, try to upgrade to X (writer)
    UPDATE cases SET status = 'Closed' WHERE id = 21;
COMMIT TRANSACTION;

/* ---------- Window #2 (start immediately) ---------- */
BEGIN TRANSACTION;
    SELECT * FROM cases WHERE id = 21;   -- S lock OK (S+S compatible)
    UPDATE cases SET status = 'Pending' WHERE id = 21;
    -- ^ If #1 already upgraded to X, this BLOCKS
    --   If #2 grabbed the X first, #1's update will BLOCK
COMMIT TRANSACTION;

/* ---------- Expected outcome ---------- */
/*
   Whichever window's UPDATE runs first acquires the X lock,
   the other waits. Both eventually complete.

   Without 2PL, a buggy engine could allow #1 to hold an S lock and
   #2 to hold an X lock on the same row → inconsistent state.
   2PL's rule "no new locks after any release" prevents this.
*/


/* =====================================================================
   DEMO C — Growing phase violation (how a NON-2PL schedule would break)
   =====================================================================
   SQL Server's engine is NOT strictly 2PL under READ COMMITTED — it
   releases S locks immediately after the statement finishes. This is
   the tradeoff for higher concurrency.
   
   To enforce strict 2PL manually, use explicit HOLDLOCK hints.
   ===================================================================== */

/* ---------- Window #1 — with HOLDLOCK (proper 2PL) ---------- */
BEGIN TRANSACTION;
    SELECT * FROM cases WITH (HOLDLOCK) WHERE status = 'Active';
    -- HOLDLOCK = SERIALIZABLE hint on this statement,
    -- keeps S lock held until COMMIT (mimics real 2PL growing phase)
    WAITFOR DELAY '00:00:05';
    UPDATE cases SET priority = 'High' WHERE status = 'Active';
COMMIT TRANSACTION;

/* ---------- Window #2 — without HOLDLOCK ---------- */
BEGIN TRANSACTION;
    -- Under READ COMMITTED, this S lock releases immediately
    SELECT * FROM cases WHERE status = 'Active';
    -- Meanwhile #1 is holding a range S lock (via HOLDLOCK)
    -- → #2's update will BLOCK until #1 commits.
    UPDATE cases SET priority = 'Low' WHERE status = 'Active';
COMMIT TRANSACTION;

/* ---------- The lesson ---------- */
/*
   2PL is a PROTOCOL, not a physical thing. It's the sequence of lock
   acquire/release operations that guarantees serializability.
   SQL Server's default READ COMMITTED breaks 2PL for performance.
   
   Strict 2PL (which we get via HOLDLOCK / higher isolation) is what you
   need for the strongest guarantees — at the cost of more blocking.
*/


/* =====================================================================
   DEMO D — Lock escalation (implicit 2PL hazard)
   =====================================================================
   SQL Server escalates row locks → page → table locks when a statement
   touches enough rows. This can silently serialise much more than 2PL
   requires.
   ===================================================================== */

/* Insert enough rows to trigger escalation (usually > 5000 row locks): */
BEGIN TRANSACTION;
    UPDATE cases SET priority = 'Medium';   -- will likely escalate to TABLE X lock
    WAITFOR DELAY '00:00:05';
COMMIT TRANSACTION;

/* Meanwhile, in another window: */
-- SELECT * FROM cases WHERE id = 1;   -- BLOCKS on the table X lock
-- Even though row 1 wasn't technically modified by the bulk update.

/* Check lock escalation events: */
SELECT  *
FROM    sys.dm_db_index_operational_stats(DB_ID(), NULL, NULL, NULL)
WHERE   index_id = 1
ORDER BY row_lock_wait_count DESC;
GO


/* =====================================================================
   TIE-BREAKER: 2PL vs MVCC (Snapshot Isolation)
   =====================================================================
   SQL Server also supports SNAPSHOT isolation (MVCC), where readers
   never block writers and vice-versa. Enable it once per database:

       ALTER DATABASE TraceNet SET ALLOW_SNAPSHOT_ISOLATION ON;
       ALTER DATABASE TraceNet SET READ_COMMITTED_SNAPSHOT ON;

   After that, readers take a consistent version snapshot → no 2PL
   blocking on reads. This is the modern alternative to strict 2PL.
   ===================================================================== */