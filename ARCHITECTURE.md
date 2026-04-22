# Architecture — Matching Pipeline

Working doc. Iterate freely. This is the "how does the brain actually work"
document — the README covers what the app does, this covers why the pipeline
is shaped the way it is and where the knobs are.

---

## The problem

A U.S. federal solicitation is tagged with a 4-digit **FSC** code
(e.g. `3408 Machining Centers and Way-Type Machines`). A company wants to
see only the solicitations that match what they actually sell.

So: given `{company_name, website, email_domain, uploaded_docs}`, output a
set of FSC codes — **precise enough to be useful, broad enough not to miss
contracts**.

**Ground truth doesn't exist.** Nobody hand-labels companies with FSC codes.
We're building an opinionated classifier, not a supervised model. Evaluation
is vibes + test companies + spot-checking against what a contracting officer
would reasonably route.

---

## Why not one LLM call?

The naive approach is:

> "Here's the company's website. Here are all 661 FSC codes. Pick the good ones."

This works, but has three problems:

1. **Token waste.** Every classification ships 661 code descriptions on
   every call. Each one is a distraction from the actual reasoning.
2. **Recall drops with noise.** Models pick fewer and worse codes when the
   candidate list is long. Human raters do the same thing.
3. **No intermediate artifacts.** We get a final answer and nothing to
   show in a demo. No reasoning to inspect. No way to debug a bad match.

So we fan out the work into stages that each do one job well.

---

## The current pipeline (4 stages)

```
  CORPUS ──▶  EXTRACT  ──▶  HINT  ──▶  NARROW  ──▶  MATCH  ──▶  CODES
             (Haiku)      (no LLM)    (Sonnet)     (Sonnet)
             profile      signals     6-10 groups  3-10 codes
```

### Corpus
Everything we know about the company, concatenated plain text. Built in
`app/api/classify/route.ts`:
- `Company: <name>` + email domain
- Scraped website body text — primary page plus up to 2 relevant pages
  discovered via sitemap or fallback link-crawl (80kB combined cap —
  `lib/scraper.ts`). See "Scraping" below.
- Extracted PDF text (capped at 80kB — `lib/pdf-parser.ts`)
- Any free-form notes the user pasted
- Final assembled corpus capped at 200kB before Haiku sees it (`lib/extract.ts`)

This is deliberately dumb. We don't try to clean or chunk it. Haiku's 200K-
token context has plenty of headroom.

### Scraping (`lib/scraper.ts`)
Single-page scraping can miss half the signal on companies with big
catalogs. We do three things instead:

1. **Always scrape the primary URL.** If the form left `websiteUrl` blank
   but provided an email domain, we derive the domain (e.g.
   `john@lsdp-mfg.com` → `lsdp-mfg.com`) and scrape that.
2. **Discover a sitemap** at `/sitemap.xml`, `/sitemap_index.xml`,
   `/sitemap-index.xml`, or a `Sitemap:` directive in `robots.txt`.
   If the sitemap is an index (points to child sitemaps), we fan out to up
   to 5 children in parallel. Collected URLs are capped at 500.
3. **Rank discovered URLs** by path tokens — positive scores for
   `/products`, `/services`, `/capabilities`, `/about`, `/manufacturing`;
   negative for `/blog`, `/privacy`, `/careers`, binary files. Pick the top 2.
4. **HTML link-crawl fallback.** If no sitemap was found, extract all
   same-origin `<a href>` from the primary page's HTML and rank those
   instead. Works for small sites without sitemaps.
5. Fetch the extras in parallel with `Promise.allSettled` so one slow or
   broken page doesn't hold up the others.

**Failure surfacing.** `fetchAndExtract` throws on HTTP status, DNS, or
TLS errors rather than returning an empty result. The route's existing
try/catch around the primary fetch turns that into a `stage: "error"` NDJSON
event with the real reason (e.g. `certificate has expired`, `responded 404`),
instead of a silent zero-byte corpus that makes every downstream stage look
broken.

**HTTPS → HTTP fallback for bare-domain inputs.** When the form supplies a
bare domain (no explicit scheme) we normalize to `https://` first, but if
that fetch throws — expired cert, no HTTPS listener, TLS handshake refusal —
we retry once against `http://`. Small manufacturers routinely have broken
TLS; we'd rather get their homepage text than bail on the handshake. An
explicit `https://…` input is never silently downgraded.

### Stage 1 — EXTRACT (`lib/extract.ts`)
**Goal:** turn the corpus into a structured `CompanyProfile`.
**Model:** `anthropic/claude-haiku-4-5` (cheap; corpus is large).
**Prompt:** `lib/prompts.ts` — single source of truth for all system prompts.

Output (see `lib/types.ts`):
```ts
{
  summary: "2-3 sentences",
  products: ["precision machined components", ...],
  services: ["CNC machining", "rubber molding", ...],
  materials: ["steel", "aluminum", ...],
  industriesServed: ["oil & gas", "downhole"],
  certifications: ["ISO 9001-2008", "CAGE 8JPP2"],
  naicsCodes: ["332710", "332721", ...],  // 6-digit, strict
  sicCodes: ["3728", ...],                  // 4-digit, strict
  keywords: ["CNC", "rubber molding", ...]
}
```

**Why structured, not prose?** The downstream stages need specific fields.
A prose summary throws away the NAICS codes and certifications, which are
the strongest signals we have.

**Failure mode:** Haiku can hallucinate fields. We mitigate by:
- `temperature: 0.1`
- `response_format: json_object`
- Strict post-parse filtering: NAICS must be 6 digits, SIC must be 4
  (`lib/extract.ts` `normalizeProfile`)
- System prompt says "Do not fabricate."
- **Code-fence stripping before parse.** Haiku *and* Sonnet (via OpenRouter)
  intermittently wrap their output in ```` ```json … ``` ```` despite
  `response_format: { type: "json_object" }` being set and the system prompt
  asking for bare JSON. Without stripping, `JSON.parse` throws, the caller's
  try/catch returns an empty object, and downstream stages run on nothing —
  silently. `stripCodeFences` (in `lib/json.ts`) is a no-op on bare JSON and
  defuses the wrapped case. Applied at all three LLM-response parse sites:
  `extract.normalizeProfile`, `classifier.narrowGroups`, and
  `classifier.hydrateMatches`.

### Stage 2 — HINT (`lib/hints.ts`)
**Goal:** produce high-confidence candidate codes without an LLM.
**Model:** none. Pure logic + SQLite lookups.

**Keyword overlap scoring**

For each of the 661 codes, count token overlap between
`{products, services, materials, industries, keywords}` and
`{description, groupName}`.

Result:
```ts
{
  topGroups:   [{group, name, score}], // FSG rollup, ranked 1..12
  topCodes:    [FscCode x 40]          // top 40 codes — recall safety net
}
```

**NAICS handling.** NAICS codes that the Extract stage pulled off the
company profile are **not** used here for scoring. They're carried forward
on the profile and passed to the Narrow stage as context for the LLM.

**Why no LLM here?** Deterministic, fast, free, explainable. This stage
also *is* the fallback when `OPENROUTER_API_KEY` is unset — the whole app
works without a key, just less accurately.

### Stage 3 — NARROW (`lib/classifier.ts` → `narrowGroups`)
**Goal:** pick 6-10 FSG groups from the 78 that matter for this company.
**Model:** `anthropic/claude-sonnet-4-6`.

Input: profile + hint signals + list of all 78 FSGs.
Output: `string[]` of group codes.

Why this stage exists: it cuts the candidate pool from 661 → ~50-100 codes
before the matcher runs. This is the single biggest accuracy lever — the
matcher stops making dumb "close but unrelated" picks because they're
simply not on the candidate list.

The user message includes a **NAICS context block** listing any NAICS codes
the company self-reported, with an explanation that NAICS is the Census
Bureau's industry classification and that the model should reason from what
those codes mean. No curated FSG mapping is provided.

**Failure mode:** Sonnet over- or under-narrows. System prompt caps at 6-10
groups and we post-filter to valid group codes only.

### Stage 4 — MATCH (`lib/classifier.ts` → `matchCodes`)
**Goal:** pick the final 3-10 FSC codes with confidence + reasoning.
**Model:** `anthropic/claude-sonnet-4-6`.

Candidate pool = (every code in narrowed groups) ∪ (hint `topCodes`).
The union is key: it lets the matcher override the narrowing step if the
keyword hints surfaced a code in a group the narrower missed.

Output per code:
```ts
{ code, description, groupCode, groupName, confidence: "high"|"medium"|"low", reasoning }
```

**System prompt is opinionated:**
- 3-10 codes, "prefer sharper picks over a long shotgun list"
- Cite specific evidence from the profile in `reasoning`
- Only from the provided candidate list

Post-processing (`hydrateMatches`): enforces code is valid, confidence is
one of three values, reasoning is a string.

---

## Data flow diagram

```
┌─ corpus (string) ──────────────────────────────────────────────────────┐
│                                                                        │
│  extract.ts:extractProfile(corpus)                                     │
│    ↓                                                                   │
│  CompanyProfile { summary, products, services, materials,              │
│                   industries, certifications, naics, sic, keywords }   │
│    ↓                                                                   │
│  hints.ts:computeHints(profile)                                        │
│    └─ keyword scoring    → topGroups, topCodes                         │
│    ↓                                                                   │
│  HintSignals { topGroups, topCodes }                                   │
│    ↓                                                                   │
│  classifier.ts:narrowGroups(profile, hints)        ──▶ string[]        │
│    ↓                                                                   │
│  classifier.ts:matchCodes(profile, groups, hints)  ──▶ MatchedCode[]   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

Every stage is observable via NDJSON events (see `lib/types.ts`
`ClassifyEvent`). The UI subscribes and renders each stage as it arrives.

---

## Open design questions

These are the dials I want to talk about:

### 1. Extract prompt coverage
Right now we ask for `products, services, materials, industries, certs,
naics, sic, keywords`. Are we missing anything that would help downstream?
Candidates:
- **Capabilities** (distinct from services, e.g. "7-axis machining")
- **Customers / past performance** (companies or agencies they mention)
- **Geography** (state/country — sometimes feeds set-aside codes)
- **Size / differentiators** (small business, HUBZone, etc.)

### 2. Hint scoring weights
`hints.ts` scores every code by raw token-overlap count (1 point per
matching token). Options if we want to tune it:
- **IDF-style weighting** — rare tokens like "downhole" count more than
  generic tokens like "equipment" or "industrial"
- **Penalize single-hit codes** — require at least 2 token overlaps to
  make the top-40 list, to suppress one-off keyword coincidences
- **Prefer phrase matches** — bigrams/trigrams from profile products
  outscore single-token hits

### 3. Narrow size
Currently 6-10 groups. Sweet spot?
- Fewer (4-6): faster matcher, risk missing edge cases
- More (10-15): higher recall, matcher gets distracted again

### 4. Match confidence
Currently "high/medium/low" string. Should it be numeric? Calibrated?
A demo-worthy option: compute a vector-similarity score per code as an
independent signal and show `llm_confidence × vector_score` as a
"joint confidence."

### 5. Failure behavior
Right now, if Haiku returns garbage JSON, we get an empty profile → hints
run against nothing → the whole pipeline is useless. Should extract have
a retry or a fallback to a second model?

### 6. NAICS context framing in the Narrow prompt
Right now the Narrow user message includes a "NAICS context" block
explaining that the model should reason from what each NAICS code means.
Options:
- Include the canonical NAICS description text for each code the company
  self-reported (Census Bureau has these)
- Surface top-N FSG groups statistically associated with each NAICS from
  FPDS data, as a hint only (not constraint)
- Leave it as-is — the model already knows common NAICS codes

---

## Possible improvements (stretch goals)

Ordered by estimated effort vs. demo impact.

### A. Vector similarity as second opinion (⭐⭐⭐ demo impact)
Embed all 661 FSC descriptions once, embed the company summary at runtime,
cosine-rank. Show top-20 vector matches alongside the LLM picks:
- Highlight codes both methods agree on (high confidence)
- Flag codes the LLM picked but vector missed (maybe wrong?)
- Flag codes vector ranked highly but LLM skipped (worth a second look?)

Embedding 661 strings once is cheap; caching them in `data/fsc_embeddings.json`
means runtime cost is a single embedding call per classification.

### B. Self-critique pass (⭐⭐)
After MATCH, send the picks back to Sonnet with: "Would a federal
contracting officer actually route this solicitation to this company?
Downgrade or drop anything weak." One more LLM call, often catches over-
eager matches.

### C. SAM.gov live solicitation lookup (⭐⭐⭐ demo impact)
Given the final codes, query SAM.gov for recent open solicitations under
those codes. Show "you'd see ~N relevant contracts right now worth $X."
Closes the loop from classification → actual business value. This is what
SalesPatriot's product *does* — showing it at demo time is the kill shot.

### D. History-aware matching (⭐)
If the user has run this company before, show a diff against the last run.
Useful for "we updated our capability statement, did the match change?"

### E. Per-code uncertainty explanations (⭐)
For each matched code, show the top 3 phrases from the profile that drove
it. Makes reasoning visible in a structured, non-prose way. Great for
"can I trust this?" moments in the demo.

---

## What I'd do next

If I had one more hour on the pipeline itself (not UI), I'd do **(A) vector
similarity** — it's the single biggest win for demo quality because it
shows "here's a second, independent technique agreeing with the LLM" and
it gives us a calibratable confidence signal without another LLM call.

Second-priority would be **(E) per-code evidence traces** — cheap (~20 min)
and makes the results page much more auditable: for each pick, show the
exact phrases from the profile that justified it.
