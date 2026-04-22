/**
 * Seed the SQLite database with reference data.
 *
 * Run with: `npm run seed`
 *
 * Safe to re-run — uses IF NOT EXISTS + INSERT OR REPLACE. To fully reset
 * the DB, delete `fsc.db` + `fsc.db-shm` + `fsc.db-wal` and run again.
 *
 * Source files:
 *   data/schema.sql         — authoritative schema (tables, indexes)
 *   data/fsg_groups.json    — 78 FSG groups
 *   data/fsc_codes.json     — 661 FSC codes with group metadata
 */

import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const DB_PATH = join(ROOT, "fsc.db");
const SCHEMA_PATH = join(ROOT, "data", "schema.sql");
const GROUPS_PATH = join(ROOT, "data", "fsg_groups.json");
const CODES_PATH = join(ROOT, "data", "fsc_codes.json");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ---- Schema ----
const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);
console.log("Applied schema from data/schema.sql");

// ---- Additive migrations ----
// SQLite doesn't support `ADD COLUMN IF NOT EXISTS`. Each statement is wrapped
// in try/catch so existing databases pick up new columns without us having to
// blow away fsc.db. Keep these idempotent — append-only. Column must also
// exist in schema.sql so a fresh DB skips these (they'll no-op silently).
const migrations = [
  "ALTER TABLE runs ADD COLUMN raw_corpus TEXT",
  "ALTER TABLE runs ADD COLUMN scraped_pages_json TEXT",
  "ALTER TABLE runs ADD COLUMN timings_json TEXT",
];
for (const sql of migrations) {
  try {
    db.exec(sql);
    console.log(`  migrated: ${sql}`);
  } catch {
    // column already exists — expected for fresh DBs or repeat seeds
  }
}

// ---- Seed FSG groups ----
const groups: { group: string; name: string }[] = JSON.parse(
  readFileSync(GROUPS_PATH, "utf-8"),
);

const insertGroup = db.prepare(
  "INSERT OR REPLACE INTO fsg_groups (group_code, name) VALUES (?, ?)",
);
const seedGroups = db.transaction((rows: typeof groups) => {
  for (const g of rows) insertGroup.run(g.group, g.name);
});
seedGroups(groups);
console.log(`Seeded ${groups.length} FSG groups`);

// ---- Seed FSC codes ----
const codes: { code: string; description: string; group: string }[] = JSON.parse(
  readFileSync(CODES_PATH, "utf-8"),
);

const insertCode = db.prepare(
  "INSERT OR REPLACE INTO fsc_codes (code, description, group_code) VALUES (?, ?, ?)",
);
const seedCodes = db.transaction((rows: typeof codes) => {
  for (const c of rows) insertCode.run(c.code, c.description, c.group);
});
seedCodes(codes);
console.log(`Seeded ${codes.length} FSC codes`);

db.close();
console.log(`Database ready at ${DB_PATH}`);
