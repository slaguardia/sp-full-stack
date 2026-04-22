-- ---------------------------------------------------------------------------
-- FSC Classifier — SQLite schema
--
-- Single source of truth for all tables. `scripts/seed-db.ts` reads this file
-- and executes it verbatim before seeding reference data from the JSON files.
--
-- Safe to re-run (all statements are `CREATE ... IF NOT EXISTS`).
-- ---------------------------------------------------------------------------

-- ============================================================================
-- Reference data — populated from data/fsg_groups.json + data/fsc_codes.json
-- ============================================================================

-- 2-digit FSG buckets (78 rows)
CREATE TABLE IF NOT EXISTS fsg_groups (
  group_code TEXT PRIMARY KEY,
  name       TEXT NOT NULL
);

-- 4-digit FSC codes (661 rows)
CREATE TABLE IF NOT EXISTS fsc_codes (
  code        TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  group_code  TEXT NOT NULL,
  FOREIGN KEY (group_code) REFERENCES fsg_groups(group_code)
);

-- ============================================================================
-- Classification run history — persists the full pipeline state per run so
-- the /history + /results views can show exactly how each match was reached.
-- ============================================================================

CREATE TABLE IF NOT EXISTS runs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name         TEXT NOT NULL,
  website_url          TEXT,
  email_domain         TEXT,
  additional_text      TEXT,
  uploaded_filename    TEXT,
  company_summary      TEXT,                        -- prose summary from CompanyProfile
  profile_json         TEXT,                        -- CompanyProfile  (lib/types.ts)
  hints_json           TEXT,                        -- HintSignals     (lib/types.ts)
  narrowed_groups_json TEXT,                        -- string[] of FSG group codes
  raw_corpus           TEXT,                        -- full assembled input sent to Haiku (replay)
  scraped_pages_json   TEXT,                        -- JSON array of URLs actually fetched
  timings_json         TEXT,                        -- JSON { scrape, pdf, extract, hint, narrow, match } in ms
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Matched codes per run (result of Stage 4 — match)
CREATE TABLE IF NOT EXISTS run_results (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id     INTEGER NOT NULL,
  fsc_code   TEXT NOT NULL,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  reasoning  TEXT,
  FOREIGN KEY (run_id)   REFERENCES runs(id)      ON DELETE CASCADE,
  FOREIGN KEY (fsc_code) REFERENCES fsc_codes(code)
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_run_results_run_id ON run_results (run_id);
CREATE INDEX IF NOT EXISTS idx_fsc_codes_group    ON fsc_codes    (group_code);
CREATE INDEX IF NOT EXISTS idx_runs_created_at    ON runs         (created_at DESC);
