# lib/

Server-side modules. Consumed by API routes in `app/api/*`.

```
lib/
├── types.ts            ← Shared types (CompanyProfile, HintSignals, MatchedCode,
│                         ClassifyEvent, StageTimings, …)
├── db.ts               ← SQLite connection (singleton, WAL mode)
├── scraper.ts          ← Fetch + cheerio — returns primary page plus up to 2
│                         sitemap- or link-discovered pages { url, title, text, pages }.
│                         Throws on primary-fetch failure; falls back https→http
│                         for bare-domain inputs.
├── pdf-parser.ts       ← pdf-parse wrapper → plain text (80kB cap)
├── stream.ts           ← NDJSON helpers: ndjsonStream (server), readNdjson (client)
├── json.ts             ← stripCodeFences — defuses ```json … ``` wrappers that
│                         Haiku/Sonnet emit despite response_format=json_object
├── prompts.ts          ← Single source of truth for system prompts
│                         (EXTRACT_SYSTEM, NARROW_SYSTEM, MATCH_SYSTEM)
│
│── Pipeline stages ─────────────────────────────────────────────────────
├── extract.ts          ← Stage 1 (Haiku): raw corpus → structured CompanyProfile
├── hints.ts            ← Stage 2 (no LLM): keyword-overlap scoring → HintSignals
└── classifier.ts       ← Stage 3 narrowGroups (Sonnet): profile + hints → FSG[]
                          Stage 4 matchCodes  (Sonnet): profile + narrowed + hints → MatchedCode[]
```

## Pipeline invariants

- Every LLM-calling module checks `process.env.OPENROUTER_API_KEY` and falls back
  to a deterministic stub when unset. The UI stays functional without a key.
- All stage outputs are serializable JSON → persisted per-run in SQLite so
  history/results views can replay the reasoning.
- Model IDs are constants at the top of `extract.ts` and `classifier.ts`. Override
  via env vars listed in `.env.example` if needed.
- System prompts are in `prompts.ts`. The `/method` page imports them verbatim
  via `components/method/prompts.ts` — there is no prompt duplication.
- NAICS codes are passed through on the `CompanyProfile` into the Narrow prompt
  as context. The hint stage does *not* apply a NAICS score boost; scoring is
  pure keyword overlap.

## Adding a new stage

1. Define its output type in `types.ts`.
2. Add corresponding `ClassifyEvent` variants (start + completion with `durationMs`).
3. Write a module in `lib/` that takes the prior stage's output + corpus.
4. Wire it into `app/api/classify/route.ts` between the existing stages,
   wrapping it with a `Date.now()` timer and persisting the duration to
   `timings_json`.
5. If the stage produces data worth persisting, add a column in `data/schema.sql`
   (plus an idempotent `ALTER TABLE ADD COLUMN` migration in `scripts/seed-db.ts`)
   and a new field in the run-detail API route.
