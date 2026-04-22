# components/

Client React components. All are `"use client"` unless noted.

```
components/
├── nav.tsx                ← top navigation — plain links, bureau-style
├── classify-form.tsx      ← home form; consumes NDJSON stream from /api/classify
│                            and drives <stream-progress>, <profile-panel>, <results-grid>
├── stream-progress.tsx    ← per-stage status pills (pending → running → done)
├── profile-panel.tsx      ← extracted CompanyProfile rendered as fields/chips
├── results-grid.tsx       ← matched FSC codes grouped by FSG
├── code-browser.tsx       ← /codes page — search + group filter (useDeferredValue)
├── pipeline-cta.tsx       ← home hero + "See the pipeline" portal modal
├── pipeline-diagram.tsx   ← shared 4-stage diagram (used by home modal)
├── insignia.tsx           ← icon + stamp SVGs for the bureau aesthetic
└── method/                ← /method page components
    ├── method-page.tsx    ←   page body — stage cards, tech stack, tradeoffs
    ├── stage-portal.tsx   ←   reusable portal modal + PromptBlock helpers
    └── prompts.ts         ←   re-exports from lib/prompts.ts (single source of truth)
```

## Data flow

```
  /api/classify  ──▶  <classify-form>
                       │        ▲
                       │        │ uses readNdjson() from lib/stream.ts
                       ▼
               <stream-progress>     ← per-stage running/done + durationMs
               <profile-panel>       ← shown after `extracted` event
               <results-grid>        ← rows appended on each `match` event
```

## Portal pattern

Both the home CTA (`pipeline-cta.tsx`) and per-stage deep dives on `/method`
(`method/stage-portal.tsx`) use a hand-rolled portal: `createPortal` to
`document.body`, Esc key + backdrop click to close, body scroll lock while
open. Matches the bureau aesthetic with no external modal dependency.
