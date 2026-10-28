/**
 * TraceNet — DB Reset Utility
 * Usage:  npm run db:reset
 *
 * Deletes the existing tracenet.db (+ WAL side files) then recreates
 * and re-seeds the schema by importing ./database.
 */
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'tracenet.db');

for (const suffix of ['', '-wal', '-shm']) {
  const p = DB_PATH + suffix;
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    // eslint-disable-next-line no-console
    console.log(`[reset] removed ${path.basename(p)}`);
  }
}

// Import AFTER deleting so database.ts creates a fresh DB
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initializeDatabase } = require('./database');
initializeDatabase();

// eslint-disable-next-line no-console
console.log('[reset] fresh database created and seeded.');