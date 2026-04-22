# app/

Next.js App Router pages + API routes.

```
app/
├── layout.tsx                    ← root layout, <Nav/>
├── providers.tsx                 ← next-auth SessionProvider wrapper
├── page.tsx                      ← /            — input form + live pipeline view
├── method/page.tsx               ← /method      — per-stage deep dive (prompts, i/o, safety nets)
├── results/[id]/page.tsx         ← /results/42  — saved run: profile, hints, codes, timings
├── history/page.tsx              ← /history     — past runs, newest first
├── codes/page.tsx                ← /codes       — browse all 661 FSC codes
│
└── api/
    ├── classify/route.ts         ← POST  — streams NDJSON ClassifyEvents
    ├── fsc-codes/route.ts        ← GET   — ?q=&group=&limit=
    └── runs/
        ├── route.ts              ← GET   — 100 most recent runs (list view)
        └── [id]/route.ts         ← GET   — single run + full pipeline state
```

## API quick reference

| Endpoint | Method | Query / Body | Returns |
|---|---|---|---|
| `/api/classify` | POST | multipart: `companyName`, `websiteUrl?`, `emailDomain?`, `additionalText?`, `file?` | NDJSON stream of `ClassifyEvent` |
| `/api/fsc-codes` | GET | `?q=&group=&limit=` (default limit 1000) | `{ codes: FscCode[] }` |
| `/api/runs` | GET | — | `{ runs: RunSummary[] }` (latest 100) |
| `/api/runs/[id]` | GET | — | `{ run }` with profile, hints, narrowedGroups, codes, **rawCorpus**, **scrapedPages**, **timings** |

See `lib/types.ts` for the full type shapes (`CompanyProfile`, `HintSignals`,
`MatchedCode`, `ClassifyEvent`, `StageTimings`).

## NDJSON events (summary)

Completion events carry a `durationMs`; the terminal `done` event carries the
full `timings: StageTimings` object. `scraped` carries the list of pages
actually fetched (primary + sitemap-discovered extras). `match` emits one per
matched code so the UI can render them as they arrive.

Every event is also written to the server's stdout as
`[classify] <stage> <json>` before being streamed to the client. That's the
only server-side log for a pipeline run — per-run stage payloads
(`profile`, `hints`, `narrowedGroups`, `timings`, `rawCorpus`, `scrapedPages`)
are persisted to SQLite and browsable via `GET /api/runs/[id]`.
