/**
 * =====================================================================
 *  TraceNet — Database Initialization & Seed
 *  ---------------------------------------------------------------------
 *  - Uses better-sqlite3 (synchronous, fast, ACID-compliant SQLite).
 *  - Enables FOREIGN KEYS + WAL journal mode.
 *  - Full normalized schema:
 *      users, investigators, cases,
 *      suspects, victims, witnesses,
 *      case_suspects, case_victims, case_witnesses,   (M:N junctions)
 *      evidence, clues, evidence_clues,               (M:N junction)
 *      evidence_custody, case_notes, case_activity
 *  - Idempotent seed → safe to run on every server start.
 * =====================================================================
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'tracenet.db');

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');   // better concurrency, still ACID
db.pragma('foreign_keys = ON');    // referential integrity
db.pragma('synchronous = NORMAL'); // safe & fast

/* ------------------------------------------------------------------ */
/*  SCHEMA                                                            */
/* ------------------------------------------------------------------ */
export function createSchema(): void {
  db.exec(`
    --------------------------------------------------------------------
    -- USERS (authentication)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      email          TEXT    UNIQUE NOT NULL,
      password_hash  TEXT    NOT NULL,
      name           TEXT    NOT NULL,
      role           TEXT    NOT NULL DEFAULT 'user'
                              CHECK (role IN ('admin','detective','analyst','user')),
      created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    --------------------------------------------------------------------
    -- INVESTIGATORS
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS investigators (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER,
      name           TEXT    NOT NULL,
      badge_number   TEXT    UNIQUE NOT NULL,
      rank           TEXT    NOT NULL,
      department     TEXT    NOT NULL,
      email          TEXT,
      phone          TEXT,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- CASES
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      case_number     TEXT    UNIQUE NOT NULL,
      title           TEXT    NOT NULL,
      description     TEXT,
      status          TEXT    NOT NULL DEFAULT 'Active'
                              CHECK (status IN ('Active','Pending','Closed','Cold')),
      priority        TEXT    NOT NULL DEFAULT 'Medium'
                              CHECK (priority IN ('Low','Medium','High','Critical')),
      opened_date     TEXT    NOT NULL,
      closed_date     TEXT,
      investigator_id INTEGER,
      created_by      INTEGER,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (investigator_id) REFERENCES investigators(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by)      REFERENCES users(id)         ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- SUSPECTS
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS suspects (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      age             INTEGER,
      gender          TEXT,
      criminal_record TEXT,
      address         TEXT,
      phone           TEXT,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    --------------------------------------------------------------------
    -- VICTIMS
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS victims (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      age        INTEGER,
      gender     TEXT,
      status     TEXT,
      contact    TEXT,
      address    TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    --------------------------------------------------------------------
    -- WITNESSES
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS witnesses (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      name               TEXT    NOT NULL,
      phone              TEXT,
      address            TEXT,
      statement          TEXT,
      reliability_score  INTEGER DEFAULT 50
                                CHECK (reliability_score BETWEEN 0 AND 100),
      created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    --------------------------------------------------------------------
    -- CASE ⇄ SUSPECT (M:N)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS case_suspects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id    INTEGER NOT NULL,
      suspect_id INTEGER NOT NULL,
      role       TEXT DEFAULT 'Suspect',
      added_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (case_id, suspect_id),
      FOREIGN KEY (case_id)    REFERENCES cases(id)    ON DELETE CASCADE,
      FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE
    );

    --------------------------------------------------------------------
    -- CASE ⇄ VICTIM (M:N)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS case_victims (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id   INTEGER NOT NULL,
      victim_id INTEGER NOT NULL,
      added_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (case_id, victim_id),
      FOREIGN KEY (case_id)   REFERENCES cases(id)   ON DELETE CASCADE,
      FOREIGN KEY (victim_id) REFERENCES victims(id) ON DELETE CASCADE
    );

    --------------------------------------------------------------------
    -- CASE ⇄ WITNESS (M:N)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS case_witnesses (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id    INTEGER NOT NULL,
      witness_id INTEGER NOT NULL,
      added_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (case_id, witness_id),
      FOREIGN KEY (case_id)    REFERENCES cases(id)     ON DELETE CASCADE,
      FOREIGN KEY (witness_id) REFERENCES witnesses(id) ON DELETE CASCADE
    );

    --------------------------------------------------------------------
    -- EVIDENCE
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS evidence (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id        INTEGER NOT NULL,
      name           TEXT    NOT NULL,
      type           TEXT    NOT NULL,
      description    TEXT,
      location_found TEXT,
      collected_date TEXT,
      status         TEXT    NOT NULL DEFAULT 'Collected'
                             CHECK (status IN ('Collected','In Lab','Analyzed','Archived','Disposed')),
      collected_by   INTEGER,
      created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id)      REFERENCES cases(id)        ON DELETE CASCADE,
      FOREIGN KEY (collected_by) REFERENCES investigators(id) ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- CLUES
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS clues (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id      INTEGER NOT NULL,
      name         TEXT    NOT NULL,
      description  TEXT,
      significance TEXT    CHECK (significance IN ('Low','Medium','High','Critical')),
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    );

    --------------------------------------------------------------------
    -- EVIDENCE ⇄ CLUE (M:N)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS evidence_clues (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id INTEGER NOT NULL,
      clue_id     INTEGER NOT NULL,
      UNIQUE (evidence_id, clue_id),
      FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
      FOREIGN KEY (clue_id)     REFERENCES clues(id)    ON DELETE CASCADE
    );

    --------------------------------------------------------------------
    -- CHAIN OF CUSTODY
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS evidence_custody (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      evidence_id   INTEGER NOT NULL,
      custodian_id  INTEGER,
      action        TEXT    NOT NULL
                            CHECK (action IN ('Collected','Transferred','Analyzed','Stored','Returned','Disposed')),
      notes         TEXT,
      transferred_at TEXT   NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (evidence_id)  REFERENCES evidence(id)       ON DELETE CASCADE,
      FOREIGN KEY (custodian_id) REFERENCES investigators(id)  ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- CASE NOTES
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS case_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id    INTEGER NOT NULL,
      author_id  INTEGER,
      note       TEXT    NOT NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id)   REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- CASE ACTIVITY (audit log — written by middleware)
    --------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS case_activity (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id     INTEGER NOT NULL,
      user_id     INTEGER,
      action      TEXT    NOT NULL,
      entity_type TEXT,
      entity_id   INTEGER,
      details     TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    --------------------------------------------------------------------
    -- INDEXES (performance for common queries / filters)
    --------------------------------------------------------------------
    CREATE INDEX IF NOT EXISTS idx_cases_status        ON cases(status);
    CREATE INDEX IF NOT EXISTS idx_cases_priority      ON cases(priority);
    CREATE INDEX IF NOT EXISTS idx_cases_opened        ON cases(opened_date);
    CREATE INDEX IF NOT EXISTS idx_cases_investigator  ON cases(investigator_id);
    CREATE INDEX IF NOT EXISTS idx_suspects_name       ON suspects(name);
    CREATE INDEX IF NOT EXISTS idx_victims_name        ON victims(name);
    CREATE INDEX IF NOT EXISTS idx_witnesses_name      ON witnesses(name);
    CREATE INDEX IF NOT EXISTS idx_evidence_case       ON evidence(case_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_type       ON evidence(type);
    CREATE INDEX IF NOT EXISTS idx_evidence_status     ON evidence(status);
    CREATE INDEX IF NOT EXISTS idx_clues_case          ON clues(case_id);
    CREATE INDEX IF NOT EXISTS idx_activity_case       ON case_activity(case_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created    ON case_activity(created_at);
  `);
}

/* ------------------------------------------------------------------ */
/*  SEED — runs only if the DB is empty                               */
/* ------------------------------------------------------------------ */

function isDatabaseEmpty(): boolean {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM users`).get() as { c: number };
  return row.c === 0;
}

function hashPassword(plain: string): string {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '10', 10);
  return bcrypt.hashSync(plain, rounds);
}

/* ------------------------------------------------------------------ */
/*  Seed reference data (arrays)                                      */
/* ------------------------------------------------------------------ */
const CASE_TITLES: string[] = [
  'Midnight Warehouse Arson',
  'Riverside Jewelry Heist',
  'The Vanishing Ledger',
  'Neon Alley Assault',
  'Counterfeit Currency Ring',
  'Harbour Container Smuggling',
  'The Silent Server Breach',
  'Downtown Art Forgery',
  'Phantom Ride-Share Scam',
  'Copper Wire Theft Spree',
  'Cold Case: The Glass Key',
  'Blackmail in the Boardroom',
  'Pharmacy Prescription Fraud',
  'Highway Cargo Hijack',
  'The Masked ATM Crew',
  'Suburban Arson Series',
  'Crypto Wallet Drain',
  'Hotel Room Poisoning',
  'Missing Person: Anna Cole',
  'Identity Theft Network',
  'Vehicle VIN Cloning',
  'Museum Night Intrusion',
  'Payroll Skimming Scheme',
  'The Lockbox Murders',
];

const SUSPECT_NAMES: string[] = [
  'Victor Hale','Maya Ortiz','Dmitri Volkov','Aaron Blake','Lucia Vance',
  'Trevor Nash','Nadia Rahman','Kyle Brennan','Rosa Delgado','Simon Petrov',
  'Hannah Wu','Elias Kane','Priya Malhotra','Oscar Mensah','Zara Qureshi',
];

const VICTIM_NAMES: string[] = [
  'Jordan Miles','Priya Nair','Owen Fletcher','Camila Reyes','Henry Walsh',
  'Aisha Bello','Noah Grant','Lena Fischer','Diego Ramirez','Yuki Tanaka',
  'Ava Thompson','Malik Osei',
];

const WITNESS_NAMES: string[] = [
  'Grace Kim','Tom Alvarez','Ravi Menon','Sofia Rossi','Ben Carter',
  'Mia Chen','Olivia Frost','Ethan Brooks','Chloe Dupont','Faisal Ahmed',
];

const EVIDENCE_BY_TYPE: Record<string, { name: string; description: string }[]> = {
  Physical: [
    { name: 'Latent Fingerprint',   description: 'Partial print lifted from the scene.' },
    { name: 'Shell Casing',         description: '9mm casing recovered from loading dock.' },
    { name: 'Fiber Sample',         description: 'Fibers matching a specific jacket brand.' },
    { name: 'Footprint Cast',       description: 'Plaster cast of shoe print near entrance.' },
    { name: 'Weapon Fragment',      description: 'Metal shard consistent with a knife blade.' },
  ],
  Digital: [
    { name: 'CCTV Footage',         description: 'Camera feed covering the incident window.' },
    { name: 'Laptop Hard Drive',    description: 'Seized drive pending forensic imaging.' },
    { name: 'Phone Records',        description: 'Call and SMS data for the past 30 days.' },
    { name: 'USB Drive',            description: 'Encrypted drive recovered from suspect.' },
    { name: 'Email Archive',        description: 'Export of corporate emails for the quarter.' },
  ],
  Forensic: [
    { name: 'Blood Sample',         description: 'Sample sent to county lab for DNA.' },
    { name: 'DNA Swab',             description: 'Saliva swab collected from evidence surface.' },
    { name: 'Toxicology Report',    description: 'Post-mortem toxicology panel.' },
    { name: 'Ballistics Report',    description: 'Comparison of recovered bullets.' },
    { name: 'Hair Sample',          description: 'Hair with follicle recovered on scene.' },
  ],
  Biological: [
    { name: 'Saliva Swab',          description: 'Swab from discarded cup at scene.' },
    { name: 'Hair Follicle',        description: 'Follicle suitable for nuclear DNA.' },
    { name: 'Skin Cells',           description: 'Touch DNA from recovered phone.' },
    { name: 'Bloodstain',           description: 'Bloodstain preserved on clothing.' },
  ],
  Documentary: [
    { name: 'Bank Statement',       description: 'Statement showing suspicious transfers.' },
    { name: 'Forged Signature',     description: 'Signature suspected of forgery.' },
    { name: 'Contract File',        description: 'Signed contract under dispute.' },
    { name: 'ID Document',          description: 'Identification document requiring verification.' },
    { name: 'Financial Ledger',     description: 'Handwritten ledger of payments.' },
  ],
};

const EVIDENCE_TYPES: string[] = Object.keys(EVIDENCE_BY_TYPE);

const EVIDENCE_STATUSES: Array<'Collected' | 'In Lab' | 'Analyzed' | 'Archived' | 'Disposed'> = [
  'Collected', 'In Lab', 'Analyzed', 'Archived',
];

const CLUE_POOL: { name: string; description: string; significance: 'Low' | 'Medium' | 'High' | 'Critical' }[] = [
  { name: 'Suspicious Phone Call',      description: 'Call between victim and unknown number hours before incident.', significance: 'High' },
  { name: 'Unknown Fingerprint',        description: 'Print matching no known database entry.',                       significance: 'Medium' },
  { name: 'Financial Irregularity',     description: 'Unusual transfer to offshore account.',                         significance: 'High' },
  { name: 'Witness Contradiction',      description: 'Two witness statements do not align on timeline.',              significance: 'Low' },
  { name: 'Matching Tire Tread',        description: 'Tread pattern matches a stolen vehicle at scene.',               significance: 'High' },
  { name: 'Burner SIM Found',           description: 'Prepaid SIM with recent activity near scene.',                  significance: 'Critical' },
  { name: 'Prior Similar Modus Operandi', description: 'Matches MO of an unsolved case from 2023.',                  significance: 'Medium' },
  { name: 'Anomalous Cam Timestamp',    description: 'CCTV gap of four minutes around the incident.',                 significance: 'Critical' },
  { name: 'Off-Shore Shell Company',    description: 'Recipient of funds is an empty-shell corporation.',             significance: 'High' },
  { name: 'Missing Hotel Keycard',      description: 'Keycard access logs show an unregistered entry.',               significance: 'Medium' },
];

const EVIDENCE_LOCATIONS: string[] = [
  'Loading dock, unit 4B',
  'Rear alley behind 5th & Main',
  'Suspect residence — living room',
  'Vehicle trunk',
  'Bank vault antechamber',
  'Riverside pier, section 7',
  'Parking garage, level 2',
  'County lab',
  'Storage unit 211',
  'Rooftop access door',
];

/* ------------------------------------------------------------------ */
/*  Seed runner                                                       */
/* ------------------------------------------------------------------ */
export function seed(): void {
  if (!isDatabaseEmpty()) {
    // eslint-disable-next-line no-console
    console.log('[seed] data already present — skipping.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[seed] seeding TraceNet database…');

  const insertUser = db.prepare(
    `INSERT INTO users (email, password_hash, name, role) VALUES (?,?,?,?)`
  );
  const insertInvestigator = db.prepare(
    `INSERT INTO investigators (user_id, name, badge_number, rank, department, email, phone)
     VALUES (?,?,?,?,?,?,?)`
  );
  const insertCase = db.prepare(
    `INSERT INTO cases (case_number, title, description, status, priority, opened_date,
                        closed_date, investigator_id, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`
  );
  const insertSuspect = db.prepare(
    `INSERT INTO suspects (name, age, gender, criminal_record, address, phone)
     VALUES (?,?,?,?,?,?)`
  );
  const insertVictim = db.prepare(
    `INSERT INTO victims (name, age, gender, status, contact, address)
     VALUES (?,?,?,?,?,?)`
  );
const insertWitness = db.prepare(
  `INSERT INTO witnesses (name, phone, address, statement, reliability_score)
   VALUES (?,?,?,?,?)` 
);
  const insertCaseSuspect = db.prepare(
    `INSERT OR IGNORE INTO case_suspects (case_id, suspect_id, role) VALUES (?,?,?)`
  );
  const insertCaseVictim = db.prepare(
    `INSERT OR IGNORE INTO case_victims (case_id, victim_id) VALUES (?,?)`
  );
  const insertCaseWitness = db.prepare(
    `INSERT OR IGNORE INTO case_witnesses (case_id, witness_id) VALUES (?,?)`
  );
  const insertEvidence = db.prepare(
    `INSERT INTO evidence (case_id, name, type, description, location_found,
                           collected_date, status, collected_by)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  const insertClue = db.prepare(
    `INSERT INTO clues (case_id, name, description, significance) VALUES (?,?,?,?)`
  );
  const insertEvidenceClue = db.prepare(
    `INSERT OR IGNORE INTO evidence_clues (evidence_id, clue_id) VALUES (?,?)`
  );
  const insertCustody = db.prepare(
    `INSERT INTO evidence_custody (evidence_id, custodian_id, action, notes)
     VALUES (?,?,?,?)`
  );
  const insertNote = db.prepare(
    `INSERT INTO case_notes (case_id, author_id, note) VALUES (?,?,?)`
  );

  // Wrap the entire seed in a transaction — fast + atomic.
  const run = db.transaction(() => {
    /* --------------------------------------------------------- */
    /* 1. Users                                                   */
    /* --------------------------------------------------------- */
    const adminId = insertUser.run(
      'admin@tracenet.local',
      hashPassword('Admin123!'),
      'Muzamil hussain',
      'admin'
    ).lastInsertRowid as number;

    const detectiveId = insertUser.run(
      'detective@tracenet.local',
      hashPassword('Detective123!'),
      'Azeem Hunzai',
      'detective'
    ).lastInsertRowid as number;

    /* --------------------------------------------------------- */
    /* 2. Investigators                                           */
    /* --------------------------------------------------------- */
    const investigators: { name: string; rank: string; dept: string }[] = [
      { name: 'Muzamil hussain',  rank: 'Detective', dept: 'Homicide' },
      { name: 'Azeem khan',  rank: 'Sergeant',  dept: 'Cyber Crime' },
      { name: 'Rayan Asim',   rank: 'Inspector', dept: 'Narcotics' },
      { name: 'Ali hussain', rank: 'Detective', dept: 'Fraud' },
    ];

    const investigatorIds: number[] = investigators.map((inv, i) => {
      const isAdmin = i === 0;
      const isDetective = i === 1;
      const userId = isAdmin ? adminId : isDetective ? detectiveId : null;
      return insertInvestigator.run(
        userId,
        inv.name,
        `B-${1000 + i * 37}`,
        inv.rank,
        inv.dept,
        `${inv.name.toLowerCase().replace(/\s+/g, '.')}@tracenet.local`,
        `+1-555-01${String(10 + i).padStart(2, '0')}`
      ).lastInsertRowid as number;
    });

    /* --------------------------------------------------------- */
    /* 3. Suspects / Victims / Witnesses                          */
    /* --------------------------------------------------------- */
    const suspectIds: number[] = SUSPECT_NAMES.map((name, i) =>
      insertSuspect.run(
        name,
        20 + ((i * 7) % 40),
        i % 2 ? 'Male' : 'Female',
        i % 3 === 0 ? 'Prior arrest — theft' : i % 5 === 0 ? 'Prior arrest — assault' : 'None',
        `${100 + i} ${['Elm', 'Oak', 'Pine', 'Maple'][i % 4]} Street`,
        `+1-555-02${String(10 + i).padStart(2, '0')}`
      ).lastInsertRowid as number
    );

    const victimIds: number[] = VICTIM_NAMES.map((name, i) =>
      insertVictim.run(
        name,
        18 + ((i * 5) % 55),
        i % 2 ? 'Female' : 'Male',
        i % 4 === 0 ? 'Deceased' : 'Injured',
        `+1-555-03${String(10 + i).padStart(2, '0')}`,
        `${200 + i} ${['Cedar', 'Birch', 'Willow', 'Aspen'][i % 4]} Avenue`
      ).lastInsertRowid as number
    );

    const witnessIds: number[] = WITNESS_NAMES.map((name, i) =>
      insertWitness.run(
        name,
        `+1-555-04${String(10 + i).padStart(2, '0')}`,
        `${300 + i} ${['Spruce', 'Redwood', 'Poplar'][i % 3]} Boulevard`,
        `Witness statement #${i + 1}: observed activity near the scene on the night in question.`,
        40 + ((i * 13) % 60)
      ).lastInsertRowid as number
    );

    /* --------------------------------------------------------- */
    /* 4. Cases (24 across 12 months of 2025)                     */
    /* --------------------------------------------------------- */
    const caseIds: number[] = [];

    for (let i = 0; i < CASE_TITLES.length; i++) {
      const monthIdx = i % 12;                                // 0..11
      const day = ((i * 7) % 26) + 1;                         // 1..26
      const opened = `2025-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      let status: 'Active' | 'Pending' | 'Closed' | 'Cold';
      let closedDate: string | null = null;

      if (monthIdx < 4) {
        status = 'Closed';
        closedDate = `2025-${String(monthIdx + 2).padStart(2, '0')}-${String(((day + 12) % 26) + 1).padStart(2, '0')}`;
      } else if (monthIdx < 8) {
        status = i % 3 === 0 ? 'Pending' : 'Active';
      } else {
        status = i % 4 === 0 ? 'Cold' : (i % 2 === 0 ? 'Active' : 'Pending');
      }

      const priority = ['Low', 'Medium', 'High', 'Critical'][i % 4] as 'Low' | 'Medium' | 'High' | 'Critical';

      const caseId = insertCase.run(
        `CR-2025-${1000 + i}`,
        CASE_TITLES[i],
        `Investigation opened for "${CASE_TITLES[i]}". Field reports pending review.`,
        status,
        priority,
        opened,
        closedDate,
        investigatorIds[i % investigatorIds.length],
        adminId
      ).lastInsertRowid as number;

      caseIds.push(caseId);

      /* ---- link suspects (1–2 per case) ---- */
      const suspectCount = (i % 2) + 1;
      for (let s = 0; s < suspectCount; s++) {
        const sid = suspectIds[(i + s * 3) % suspectIds.length];
        insertCaseSuspect.run(caseId, sid, s === 0 ? 'Primary Suspect' : 'Person of Interest');
      }

      /* ---- link victim (1 per case) ---- */
      insertCaseVictim.run(caseId, victimIds[i % victimIds.length]);

      /* ---- link witness (70% of cases) ---- */
      if (i % 10 !== 3 && i % 10 !== 7) {
        insertCaseWitness.run(caseId, witnessIds[i % witnessIds.length]);
      }

      /* ---- evidence (2 per case) ---- */
      const evidenceIdsThisCase: number[] = [];
      for (let e = 0; e < 2; e++) {
        const type = EVIDENCE_TYPES[(i + e) % EVIDENCE_TYPES.length];
        const pool = EVIDENCE_BY_TYPE[type];
        const item = pool[(i + e) % pool.length];
        const evStatus = EVIDENCE_STATUSES[(i + e) % EVIDENCE_STATUSES.length];

        const evId = insertEvidence.run(
          caseId,
          item.name,
          type,
          item.description,
          EVIDENCE_LOCATIONS[(i + e) % EVIDENCE_LOCATIONS.length],
          opened,
          evStatus,
          investigatorIds[(i + e) % investigatorIds.length]
        ).lastInsertRowid as number;

        evidenceIdsThisCase.push(evId);

        /* ---- initial chain-of-custody record ---- */
        insertCustody.run(
          evId,
          investigatorIds[(i + e) % investigatorIds.length],
          'Collected',
          'Initial collection entry logged at scene.'
        );
      }

      /* ---- clues (1–2 per case) ---- */
      const clueCount = (i % 2) + 1;
      for (let c = 0; c < clueCount; c++) {
        const clueDef = CLUE_POOL[(i + c * 2) % CLUE_POOL.length];
        const clueId = insertClue.run(
          caseId,
          clueDef.name,
          clueDef.description,
          clueDef.significance
        ).lastInsertRowid as number;

        /* ---- link clue to one of this case's evidence items ---- */
        insertEvidenceClue.run(evidenceIdsThisCase[c % evidenceIdsThisCase.length], clueId);
      }

      /* ---- case note ---- */
      insertNote.run(
        caseId,
        adminId,
        `Initial review opened for ${CASE_TITLES[i]}. Assigned to ${investigators[i % investigators.length].name}.`
      );
    }
  });

  run();

  // eslint-disable-next-line no-console
  console.log(
    `[seed] done → ${CASE_TITLES.length} cases, ${SUSPECT_NAMES.length} suspects, ` +
    `${VICTIM_NAMES.length} victims, ${WITNESS_NAMES.length} witnesses.`
  );
}

/* ------------------------------------------------------------------ */
/*  Public entry point — called from server.ts on startup             */
/* ------------------------------------------------------------------ */
export function initializeDatabase(): void {
  createSchema();
  seed();
}

/* Auto-run when executed directly (npm run db:init) */
if (require.main === module) {
  createSchema();
  seed();
  // eslint-disable-next-line no-console
  console.log(`[database] ready at ${DB_PATH}`);
}