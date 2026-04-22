# FSC Code Classifier

A full-stack Next.js app that takes company information and outputs relevant 4-digit Federal Supply Classification (FSC) codes describing what they sell or provide.

Built for the SalesPatriot on-site interview task.

---

## What It Does

1. User inputs company info (name, website URL, email domain, uploaded PDF)
2. API routes scrape the website and extract text from uploaded PDFs
3. A **four-stage creative pipeline** analyzes the company and matches it to FSC codes
4. Frontend streams each stage live via NDJSON, giving a visible "watching it think" view

---

> **Deep dive on the pipeline:** [ARCHITECTURE.md](ARCHITECTURE.md) — working doc with prompts, signal weights, open design questions, and stretch goals.

## The Matching Pipeline (the interesting part)

A single LLM call against all 661 FSC codes works, but it wastes tokens and dilutes accuracy. Instead, classification runs through four stages — the first two are cheap/deterministic, the last two use LLMs only where reasoning actually helps.

```
┌───────────────────────────────────────────────────────────────────────┐
│ INPUT: company name + website text + uploaded PDF text + notes        │
└──────────────────────────────────┬────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Stage 1 — EXTRACT (Haiku, cheap)                                      │
│                                                                       │
│ Produces a structured CompanyProfile JSON:                            │
│   { summary, products, services, materials, industries_served,        │
│     certifications, naics_codes, sic_codes, keywords }                │
│                                                                       │
│ Why not a prose summary? Structured fields feed downstream stages     │
│ directly — prose would throw away the NAICS codes, certifications,    │
│ and technical keywords that make matching accurate.                   │
└──────────────────────────────────┬────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Stage 2 — HINT (deterministic, no LLM)                                │
│                                                                       │
│ Keyword scoring only: token overlap between profile                   │
│ (products/services/materials/industries/keywords) and every FSC       │
│ description. Top 40 codes are kept as a recall safety net for the     │
│ matcher. NAICS codes ride along on the profile and are passed to      │
│ Narrow as context for the LLM — no curated mapping, no score boost.   │
│                                                                       │
│ Free. Fast. Also the full fallback when OPENROUTER_API_KEY is unset.  │
└──────────────────────────────────┬────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Stage 3 — NARROW (Sonnet)                                             │
│                                                                       │
│ Given profile + hint signals + the list of 78 FSGs, the LLM picks     │
│ the 6–10 most relevant groups. Cuts the candidate pool from 661       │
│ codes to ~50–100 before matching.                                     │
│                                                                       │
│ Cheaper and more accurate than one-shot over 661 codes — the          │
│ matcher isn't distracted by obviously irrelevant categories.          │
└──────────────────────────────────┬────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ Stage 4 — MATCH (Sonnet)                                              │
│                                                                       │
│ Given profile + narrowed candidate codes, the LLM picks 3–10 final    │
│ codes with confidence (high/medium/low) and specific evidence-based   │
│ reasoning from the profile.                                           │
└──────────────────────────────────┬────────────────────────────────────┘
                                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│ OUTPUT: matched FSC codes with group context, confidence, reasoning   │
│         (streamed via NDJSON; persisted to SQLite for run history)    │
└───────────────────────────────────────────────────────────────────────┘
```

**Why this design demos well:** each stage is visible in the UI as it runs. You can see the extracted profile, the keyword-ranked groups, the narrowed shortlist, and the final picks — instead of a black-box "submit and wait."

---

## Tech Stack

- **Next.js 15** (TypeScript, App Router, React 19) — frontend + API routes in one project
- **Tailwind CSS** — styling, with `next/font` loading Big Shoulders Stencil + Archivo + DM Mono
- **SQLite** (better-sqlite3) — FSC reference data + run history
- **OpenRouter** — LLM access (Haiku for extraction, Sonnet for narrow/match)
- **Cheerio** — HTML scraping
- **pdf-parse** — PDF text extraction

> No API key? The extract + match stages fall back to deterministic keyword stubs so the whole UI still works for local dev.

---

## API Endpoints

### `POST /api/classify` — streams NDJSON
Accepts `multipart/form-data`:
- `companyName` (required)
- `websiteUrl` (optional)
- `emailDomain` (optional)
- `additionalText` (optional)
- `file` (optional PDF upload)

Emits `ClassifyEvent` lines as it progresses:
```
{"stage":"scraping","url":"https://..."}
{"stage":"scraped","bytes":18423,"pages":["https://…/","https://…/products/"],"durationMs":4112}
{"stage":"parsing_pdf","filename":"capability.pdf"}
{"stage":"parsed_pdf","bytes":2114,"durationMs":184}
{"stage":"extracting"}
{"stage":"extracted","profile":{...},"durationMs":4203}
{"stage":"hinting"}
{"stage":"hinted","hints":{...},"durationMs":3}
{"stage":"narrowing"}
{"stage":"narrowed","groups":["34","53",...],"durationMs":2110}
{"stage":"matching"}
{"stage":"match","code":{code:"3408","confidence":"high","reasoning":"..."}}
{"stage":"saved","runId":12,"durationMs":9}
{"stage":"done","runId":12,"codes":[...],"timings":{"scrape":4112,"pdf":184,"extract":4203,"hint":3,"narrow":2110,"match":3422}}
```

Client-side helper for consuming this: `readNdjson` in `lib/stream.ts`.

### `GET /api/fsc-codes`
Returns the full FSC code list with group metadata.

### `GET /api/runs`
Returns past classification runs (most recent first, max 100).

### `GET /api/runs/[id]`
Returns a single run with the full pipeline state: profile, hints, narrowed groups, matched codes, raw corpus (replay), scraped page list, and per-stage timings.

---

## Database Schema

Authoritative schema lives in [`data/schema.sql`](data/schema.sql) — edit there, then run `npm run seed` to apply.

```sql
-- Reference data
fsg_groups  (group_code PK, name)
fsc_codes   (code PK, description, group_code FK)

-- Run history with full pipeline state
runs (
  id, company_name, website_url, email_domain,
  additional_text, uploaded_filename, company_summary,
  profile_json,            -- CompanyProfile from extract stage
  hints_json,              -- HintSignals from hint stage
  narrowed_groups_json,    -- string[] from narrow stage
  raw_corpus,              -- full assembled input sent to Haiku (replay)
  scraped_pages_json,      -- JSON array of URLs actually fetched
  timings_json,            -- JSON { scrape, pdf, extract, hint, narrow, match } in ms
  created_at
)
run_results (
  id, run_id FK, fsc_code FK, confidence, reasoning
)
```

Storing the full pipeline state per run means the history view can show exactly how each classification was reached.

---

## Project Structure

```
sp-full-stack/
├── README.md
├── package.json                    ← single root project — Next.js + SQLite + scripts
├── next.config.mjs
├── tailwind.config.js
├── tsconfig.json
├── fsc.db                          ← SQLite database (generated by npm run seed)
├── .env.example                    ← copy to .env.local, set OPENROUTER_API_KEY
├── data/
│   ├── schema.sql                  ← authoritative SQLite schema (single source of truth)
│   ├── fsc_codes.json              ← 661 FSC codes with group info
│   └── fsg_groups.json             ← 78 FSG groups
├── scripts/
│   ├── seed-db.ts                  ← applies schema.sql, seeds from JSON
│   └── pipeline-smoke.ts           ← End-to-end pipeline smoke test
├── app/
│   ├── layout.tsx                  ← root layout + Nav
│   ├── providers.tsx               ← next-auth SessionProvider wrapper
│   ├── page.tsx                    ← / — input form + live pipeline view
│   ├── method/page.tsx             ← /method — per-stage deep dive
│   ├── results/[id]/page.tsx       ← saved run: profile + hints + codes
│   ├── history/page.tsx            ← past runs, newest first
│   ├── codes/page.tsx              ← browse / search all 661 FSC codes
│   └── api/
│       ├── classify/route.ts       ← Streaming pipeline driver
│       ├── fsc-codes/route.ts      ← Code list (q, group, limit)
│       └── runs/route.ts + [id]/route.ts
├── components/
│   ├── classify-form.tsx           ← form + NDJSON stream consumer
│   ├── stream-progress.tsx         ← pipeline stage list (pending → running → done)
│   ├── results-grid.tsx            ← matched codes grouped by FSG
│   ├── profile-panel.tsx           ← extracted profile fields as chips
│   ├── code-browser.tsx            ← search/filter with useDeferredValue
│   ├── pipeline-cta.tsx            ← home CTA + portal modal ("See the pipeline")
│   ├── pipeline-diagram.tsx        ← shared 4-stage diagram visual
│   ├── insignia.tsx                ← icon/stamp SVGs for the bureau aesthetic
│   ├── method/                     ← /method page components + per-stage portals
│   └── nav.tsx
├── lib/
│   ├── db.ts                       ← SQLite connection
│   ├── scraper.ts                  ← Website + sitemap scraping (cheerio)
│   ├── pdf-parser.ts               ← PDF text extraction
│   ├── prompts.ts                  ← EXTRACT_SYSTEM, NARROW_SYSTEM, MATCH_SYSTEM
│   ├── extract.ts                  ← Stage 1: structured profile (Haiku)
│   ├── hints.ts                    ← Stage 2: keyword-score hint signals
│   ├── classifier.ts               ← Stages 3 & 4: narrow + match (Sonnet)
│   ├── stream.ts                   ← NDJSON emit/read helpers
│   ├── cn.ts                       ← tailwind class merge
│   └── types.ts                    ← Shared TypeScript types
└── SalesPatriot_interview_task_fsc/
    └── (reference PDFs)
```

---

## Setup

```bash
npm install

# Seed the database (run once; re-run after schema.sql changes)
npm run seed                                # creates ./fsc.db

# Set your OpenRouter API key
cp .env.example .env.local                  # then edit .env.local
# …or export inline:
export OPENROUTER_API_KEY="sk-or-..."
# Without a key, extract + match fall back to deterministic keyword stubs.

# Auth (single-operator credentials sign-in via NextAuth v5)
export AUTH_BASIC_CREDENTIALS="$(printf 'operator:depot2026' | base64)"
export AUTH_SECRET="$(openssl rand -base64 32)"
# All routes redirect to /signin until you authenticate.

# Start dev server
npm run dev
# → http://localhost:3000
```

Scripts:
- `npm run dev` — Next dev server
- `npm run build` / `npm run start` — production build + run
- `npm run typecheck` — `tsc --noEmit`
- `npm run seed` — (re)create and seed `./fsc.db`
- `npm run smoke` — run the full 4-stage pipeline against a hard-coded LSDP-style corpus, printing each stage's output. Works with or without an API key.

---

## Test Companies

| # | Company | Website | Notes |
|---|---------|---------|-------|
| 1 | H & R Parts Co Inc | hrpartsco.com | Aircraft parts (SIC 3728 / NAICS 336411). **Domain offline** as of testing; capability-statement PDF can still be used as the sole input. |
| 2 | Loos & Co Inc | loosco.com | Wire and cable manufacturer. Sitemap discovery works; expect ~3 pages scraped. |
| 3 | Lone Star Downhole Products | lsdp-mfg.com | CNC machining, rubber molding, fabrication. **Domain offline** currently; use the capability PDF under `SalesPatriot_interview_task_fsc/` as the input. |
| 4 | TBD | — | Surprise company during demo |

---

## Design Tradeoffs

- **Haiku for extract, Sonnet for narrow+match.** Extraction handles a big corpus but is mostly transcription — Haiku is plenty. Narrow and match involve real reasoning over procurement semantics; Sonnet is worth the spend there.
- **Deterministic hint stage.** A pure-logic stage is free, fast, explainable, and doubles as the fallback when no API key is set — the app always works.
- **NAICS as context, not a rule.** Self-reported NAICS codes flow into the Narrow stage as context for the LLM. No hand-made NAICS → FSG mapping; the model reasons from what each code means.
- **Stream everything.** NDJSON per stage makes the UI feel alive and gives the interview demo a clear narrative arc.
- **Persist full pipeline state.** Each run stores the profile, hints, narrowed groups, raw corpus, scraped page list, and per-stage timings — so the `/results` view can replay exactly how a classification was reached.

---

## Stretch Goals

- **Vector similarity as second opinion.** Embed all 661 FSC descriptions, embed the summary, cosine-rank. Surface any high-similarity codes the LLM skipped.
- **Self-critique pass.** After Stage 4, ask the LLM "would a contracting officer actually route these to this company?" and downgrade weak picks.
- **SAM.gov live solicitation test.** Pull a handful of recent solicitations for the matched codes and show "you'd see ~N relevant contracts today" — closes the demo loop with real money.
