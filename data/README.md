# data/

Reference data + schema. Read by `scripts/seed-db.ts`.

```
data/
├── schema.sql         ← authoritative SQLite schema (tables + indexes)
├── fsg_groups.json    ← 78 FSG groups — 2-digit category buckets
│                        { group: "34", name: "Metalworking Machinery" }
└── fsc_codes.json     ← 661 FSC codes — 4-digit product/service codes
                         { code: "3408", description: "Machining Centers and Way-Type Machines",
                           group: "34", group_name: "Metalworking Machinery" }
```

## Workflow

- Edit `schema.sql` → `npm run seed` to apply.
- For additive schema changes (new columns), also add an idempotent
  `ALTER TABLE ADD COLUMN` to `scripts/seed-db.ts` so existing databases
  pick up the change on the next seed. SQLite has no
  `ADD COLUMN IF NOT EXISTS`, so each ALTER is wrapped in try/catch.
- Safe to re-run at any time. To fully reset, delete `fsc.db*` and re-run.

## Run-history columns

The `runs` table persists the complete pipeline state per classification:

| Column | Content |
|---|---|
| `profile_json` | `CompanyProfile` from Stage 1 — structured extraction output |
| `hints_json` | `HintSignals` from Stage 2 — keyword-score rollup |
| `narrowed_groups_json` | Stage 3 output — chosen FSG group codes |
| `raw_corpus` | full assembled string sent to Haiku — enables full replay |
| `scraped_pages_json` | URLs actually fetched (primary + sitemap/link-crawl extras) |
| `timings_json` | per-stage durations in ms: `{scrape, pdf, extract, hint, narrow, match}` |

Types live in `lib/types.ts`; API shapes in `app/api/runs/[id]/route.ts`.

## Provenance

- `fsc_codes.json`: merged from the official DLA PDF
  (`SalesPatriot_interview_task_fsc/AV_FSCClassAssignment._151007.pdf` — 580 codes)
  supplemented with the NATO Supply Classification list (Wikipedia — 81 extra codes
  covering ships, food, clothing, etc. that the DLA PDF omits).
- `fsg_groups.json`: 78 group names from asap-components.com/nsn/fscs/.
