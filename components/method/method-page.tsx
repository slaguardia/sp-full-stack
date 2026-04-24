"use client";

import { useState } from "react";
import {
  PortalKeyValues,
  PortalRule,
  PortalSection,
  PromptBlock,
  StagePortal,
} from "./stage-portal";
import {
  EXTRACT_SYSTEM_PROMPT,
  MATCH_SYSTEM_PROMPT,
  NARROW_SYSTEM_PROMPT,
} from "./prompts";

type StageKey = "extract" | "hint" | "narrow" | "match";

type Stage = {
  key: StageKey;
  num: string;
  title: string;
  kind: "LLM" | "deterministic";
  model: string;
  summary: string;
};

const STAGES: Stage[] = [
  {
    key: "extract",
    num: "01",
    title: "Extract",
    kind: "LLM",
    model: "claude-haiku-4-5",
    summary:
      "Turn the raw corpus into a structured CompanyProfile — the fields every downstream stage actually needs.",
  },
  {
    key: "hint",
    num: "02",
    title: "Hint",
    kind: "deterministic",
    model: "no LLM",
    summary:
      "Keyword scoring against all 661 codes. Free, fast, explainable — and the full fallback path when no API key is set.",
  },
  {
    key: "narrow",
    num: "03",
    title: "Narrow",
    kind: "LLM",
    model: "claude-sonnet-4-6",
    summary:
      "Cut 78 FSGs down to 6–10 groups. The single biggest accuracy lever: stop distracting the matcher with obviously wrong categories.",
  },
  {
    key: "match",
    num: "04",
    title: "Match",
    kind: "LLM",
    model: "claude-sonnet-4-6",
    summary:
      "Pick 3–10 final codes with confidence and evidence-based reasoning, drawn only from the narrowed candidate list.",
  },
];

export function MethodPage() {
  const [openStage, setOpenStage] = useState<StageKey | null>(null);

  return (
    <div className="flex flex-col gap-12 pt-4">
      {/* Masthead */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="overline">Dossier · pipeline internals</div>
          <span className="serial">FOUR STAGES · TWO MODELS · ONE CORPUS</span>
        </div>
        <div className="rule" />
        <h1 className="font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
          Method,
          <br />
          <em className="italic text-stamp">
            the pipeline in full.
          </em>
        </h1>
        <p className="max-w-3xl font-display text-[17px] italic leading-relaxed text-ink-muted">
          The home page shows the 30-second version. This page is the deep
          dive: every prompt sent to the model, every rule used when no model
          runs, and the design tradeoffs behind the shape of it.
        </p>
      </header>

      {/* Section I — The Pipeline */}
      <section className="flex flex-col gap-5">
        <SectionHeader numeral="I" title="The Pipeline" />
        <p className="max-w-3xl text-[14.5px] leading-relaxed text-ink">
          Four stages run top-to-bottom per classification. Stage 1 transcribes
          the corpus into structure. Stage 2 applies domain knowledge without
          an LLM. Stages 3 and 4 are where the model reasons over procurement
          semantics. Click any stage for the full spec.
        </p>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {STAGES.map((s) => (
            <StageCard
              key={s.key}
              stage={s}
              onOpen={() => setOpenStage(s.key)}
            />
          ))}
        </div>
      </section>

      {/* Section II — Tech Stack */}
      <section className="flex flex-col gap-5">
        <SectionHeader numeral="II" title="Tech Stack" />
        <div className="card-paper-soft grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:p-6 md:grid-cols-2 lg:grid-cols-3">
          {TECH_STACK.map((group) => (
            <div key={group.label} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <span className="overline">{group.label}</span>
                <span className="h-px flex-1 bg-rule" />
              </div>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((it) => (
                  <li
                    key={it.name}
                    className="flex items-baseline gap-2 text-[13px] leading-snug text-ink"
                  >
                    <span className="font-mono text-[11px] text-ink">
                      {it.name}
                    </span>
                    <span className="text-ink-muted">— {it.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Section III — Design Tradeoffs */}
      <section className="flex flex-col gap-5">
        <SectionHeader numeral="III" title="Design Tradeoffs" />
        <ol className="flex flex-col gap-4">
          {TRADEOFFS.map((t, i) => (
            <li key={t.title} className="card-paper flex gap-5 p-5">
              <span className="font-display text-[40px] leading-none text-stamp">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="font-display text-[20px] italic leading-tight text-ink">
                  {t.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  {t.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Per-stage portals */}
      <ExtractPortal
        open={openStage === "extract"}
        onClose={() => setOpenStage(null)}
      />
      <HintPortal
        open={openStage === "hint"}
        onClose={() => setOpenStage(null)}
      />
      <NarrowPortal
        open={openStage === "narrow"}
        onClose={() => setOpenStage(null)}
      />
      <MatchPortal
        open={openStage === "match"}
        onClose={() => setOpenStage(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage card
// ---------------------------------------------------------------------------

function StageCard({ stage, onOpen }: { stage: Stage; onOpen: () => void }) {
  return (
    <article className="card-paper flex flex-col gap-3 p-5">
      <header className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[11px] tracking-[0.2em] text-ink-muted">
            {stage.num}
          </span>
          <span className="font-display text-[26px] italic leading-none text-ink">
            {stage.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`stamp ${
              stage.kind === "LLM" ? "stamp-red" : "stamp-green"
            }`}
          >
            {stage.kind}
          </span>
        </div>
      </header>
      <div className="rule-dotted" />
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-ink-muted">
          MODEL
        </span>
        <span className="font-mono text-[11px] text-ink">{stage.model}</span>
      </div>
      <p className="text-[13.5px] leading-snug text-ink">{stage.summary}</p>
      <div className="mt-auto flex justify-end pt-1">
        <button type="button" className="btn-ink" onClick={onOpen}>
          Read the full spec →
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({
  numeral,
  title,
}: {
  numeral: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] tracking-[0.22em] text-ink-muted">
          SECTION {numeral}
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <h2 className="font-display text-[32px] leading-[1] tracking-tight text-ink">
        {title}
      </h2>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tech stack + tradeoffs data
// ---------------------------------------------------------------------------

const TECH_STACK: Array<{
  label: string;
  items: Array<{ name: string; note: string }>;
}> = [
  {
    label: "Framework",
    items: [
      { name: "Next.js 15", note: "App Router, React 19, server components" },
      { name: "TypeScript", note: "strict mode" },
    ],
  },
  {
    label: "UI",
    items: [
      { name: "Tailwind CSS", note: "paper-and-ink design tokens" },
      { name: "Big Shoulders Stencil + Archivo + DM Mono", note: "display + sans + mono, via next/font" },
    ],
  },
  {
    label: "Data",
    items: [
      { name: "SQLite", note: "via better-sqlite3" },
      { name: "fsg_groups / fsc_codes", note: "78 groups · 661 codes" },
      { name: "runs / run_results", note: "full pipeline state per run" },
    ],
  },
  {
    label: "Ingest",
    items: [
      { name: "cheerio", note: "website HTML scraping + sitemap fan-out (80kB cap)" },
      { name: "pdf-parse", note: "uploaded PDF text (80kB cap)" },
    ],
  },
  {
    label: "LLM",
    items: [
      { name: "OpenRouter", note: "single API for both models" },
      { name: "Haiku 4.5", note: "extraction — cheap, large corpus" },
      { name: "Sonnet 4.6", note: "narrow + match — reasoning" },
    ],
  },
  {
    label: "Transport",
    items: [
      { name: "NDJSON", note: "one JSON event per line, streamed" },
      { name: "ReadableStream", note: "per-stage events to the client" },
    ],
  },
];

const TRADEOFFS: Array<{ title: string; body: string }> = [
  {
    title: "Haiku for extract, Sonnet for narrow + match.",
    body: "Extraction is mostly transcription over a large corpus — Haiku is plenty. Narrow and match involve real reasoning over procurement semantics, and that is worth the spend on Sonnet.",
  },
  {
    title: "Deterministic hint stage.",
    body: "A pure-logic middle stage is free, fast, and explainable. It also doubles as the whole-pipeline fallback when no API key is set, so the app keeps working locally and in demos.",
  },
  {
    title: "NAICS as context, not a rule.",
    body: "Companies' self-reported NAICS codes flow into the Narrow stage as context for the LLM to reason about.",
  },
  {
    title: "Stream every stage.",
    body: "NDJSON events per stage turn the pipeline into a visible artifact. You watch the extracted profile, the hint groups, the narrowed shortlist, then the final picks — not a black-box “submit and wait.”",
  },
  {
    title: "Persist full pipeline state.",
    body: "Each run stores the extracted profile, hint signals, and narrowed groups as JSON alongside the final codes. History pages can replay exactly how a classification was reached — not just what it was.",
  },
];

// ---------------------------------------------------------------------------
// Per-stage portals
// ---------------------------------------------------------------------------

function ExtractPortal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <StagePortal
      open={open}
      onClose={onClose}
      stageNumber="01"
      stageTitle="Extract"
      kind="LLM"
      model="anthropic/claude-haiku-4-5"
    >
      <PortalSection title="Purpose">
        Transcribe the raw corpus (website + PDF + notes) into a structured
        <code className="mx-1 font-mono text-[12px]">CompanyProfile</code>.
        Prose summaries throw away the signals we actually need — NAICS codes,
        certifications, and technical keywords. We want fields, not paragraphs.
      </PortalSection>

      <PortalRule />

      <PromptBlock title="EXTRACT_SYSTEM · lib/extract.ts" body={EXTRACT_SYSTEM_PROMPT} />

      <PortalRule />

      <PortalSection title="User Message">
        The raw corpus, concatenated into a single string and capped at{" "}
        <span className="font-mono text-[12px]">200,000</span> characters (
        <span className="font-mono text-[11px]">corpus.slice(0, 200_000)</span>).
        Corpus includes the primary page + up to 2 sitemap-discovered pages
        (website), plus PDF text and notes. Haiku's 200K-token context has
        plenty of headroom; we keep the message flat instead of chunking.
      </PortalSection>

      <PortalRule />

      <PortalSection title="Request Shape">
        <PortalKeyValues
          rows={[
            {
              k: "MODEL",
              v: (
                <span className="font-mono text-[12px]">
                  anthropic/claude-haiku-4-5
                </span>
              ),
            },
            {
              k: "TEMP",
              v: <span className="font-mono text-[12px]">0.1</span>,
            },
            {
              k: "FORMAT",
              v: (
                <span className="font-mono text-[12px]">
                  response_format: {`{ type: "json_object" }`}
                </span>
              ),
            },
            {
              k: "ENDPOINT",
              v: (
                <span className="font-mono text-[12px]">
                  openrouter.ai/api/v1/chat/completions
                </span>
              ),
            },
          ]}
        />
      </PortalSection>

      <PortalRule />

      <PortalSection title="What We Parse Out">
        The model returns a JSON object. We coerce it into{" "}
        <code className="font-mono text-[12px]">CompanyProfile</code> with these
        fields:
        <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {[
            ["summary", "2–3 sentence plain-English summary"],
            ["products", "specific physical goods"],
            ["services", "what they do (machining, fab, repair)"],
            ["materials", "substrates (steel, aluminum, rubber)"],
            ["industriesServed", "aerospace, oil & gas, defense, medical"],
            ["certifications", "ISO, AS, ITAR, CAGE, DUNS"],
            ["naicsCodes", "6-digit, strict"],
            ["sicCodes", "4-digit, strict"],
            ["keywords", "distinguishing technical terms"],
          ].map(([k, v]) => (
            <li key={k} className="flex items-baseline gap-2 text-[12.5px]">
              <span className="font-mono text-[11px] text-ink">{k}</span>
              <span className="text-ink-muted">— {v}</span>
            </li>
          ))}
        </ul>
      </PortalSection>

      <PortalRule />

      <PortalSection title="Safety Net">
        <code className="font-mono text-[12px]">normalizeProfile()</code> in{" "}
        <code className="font-mono text-[12px]">lib/extract.ts</code> is the
        guard against model hallucination:
        <ul className="mt-2 ml-4 list-disc space-y-1 text-[13px]">
          <li>
            Every field is coerced to the right type (arrays become arrays of
            trimmed non-empty strings).
          </li>
          <li>
            NAICS codes are stripped to digits and dropped unless they are
            exactly 6 digits long.
          </li>
          <li>
            SIC codes are stripped to digits and dropped unless they are
            exactly 4 digits long.
          </li>
          <li>
            Missing fields default to empty — the downstream stages never see
            null.
          </li>
        </ul>
      </PortalSection>
    </StagePortal>
  );
}

function HintPortal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <StagePortal
      open={open}
      onClose={onClose}
      stageNumber="02"
      stageTitle="Hint"
      kind="deterministic"
      model="no LLM — pure logic"
    >
      <PortalSection title="Purpose">
        Produce high-confidence candidate codes <em>before</em> any model
        runs. Free, fast, and explainable. Also the full fallback when{" "}
        <code className="font-mono text-[12px]">OPENROUTER_API_KEY</code> is
        unset — the whole app still works, just less accurately.
      </PortalSection>

      <PortalRule />

      <PortalSection title="Keyword Scoring">
        <p>
          Tokenize every profile field (products, services, materials,
          industries, keywords), stop-word filter, lowercase. For each of the
          661 FSC codes, count how many tokens appear in
          <span className="font-mono text-[12px]"> description + groupName</span>.
          Codes with non-zero overlap are ranked and the top 40 are carried
          forward as a recall safety net for the Match stage.
        </p>
      </PortalSection>

      <PortalRule />

      <PortalSection title="NAICS Handling">
        <p>
          Any NAICS codes the company self-reported are preserved on the
          profile and passed into the Narrow stage as context for the LLM
          (e.g.{" "}
          <span className="font-mono text-[12px]">
            “company self-identifies with NAICS 332710”
          </span>
          ). The deterministic stage here stays narrowly scoped: keyword
          overlap only.
        </p>
      </PortalSection>

      <PortalRule />

      <PortalSection title="Output">
        <PortalKeyValues
          rows={[
            {
              k: "topGroups",
              v: "up to 12 FSG groups ranked by combined keyword score, with name and score",
            },
            {
              k: "topCodes",
              v: "top 40 FSC codes by keyword score — passed into the Match stage as a recall safety net",
            },
          ]}
        />
      </PortalSection>
    </StagePortal>
  );
}

function NarrowPortal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <StagePortal
      open={open}
      onClose={onClose}
      stageNumber="03"
      stageTitle="Narrow"
      kind="LLM"
      model="anthropic/claude-sonnet-4-6"
    >
      <PortalSection title="Purpose">
        Pick 6–10 Federal Supply Groups from the 78 that matter for this
        company. This is the biggest accuracy lever in the whole pipeline:
        cutting the candidate pool from{" "}
        <span className="font-mono text-[12px]">661 → ~50–100</span> codes
        before the matcher runs stops it from making "close but unrelated"
        picks simply because they are not on the candidate list.
      </PortalSection>

      <PortalRule />

      <PromptBlock title="NARROW_SYSTEM · lib/classifier.ts" body={NARROW_SYSTEM_PROMPT} />

      <PortalRule />

      <PortalSection title="User Message">
        <p className="mb-2">Assembled in-process as a multi-line string:</p>
        <pre className="border border-rule bg-[color-mix(in_srgb,var(--paper)_65%,#fff_35%)] p-3 font-mono text-[11.5px] leading-[1.55] text-ink whitespace-pre-wrap">
{`Company profile:
Summary: …
Products: …
Services: …
Materials: …
Industries served: …
Certifications: …
NAICS codes: …
SIC codes: …
Keywords: …

Hint signals:
NAICS-implied groups: 34, 53
Keyword-ranked groups:
  34 (Metalworking Machinery) — score 18
  53 (Hardware and Abrasives) — score 11
  …

All 78 FSGs:
10 — Weapons
11 — Nuclear Ordnance
…
99 — Miscellaneous

Return {"groups": [...]} with 6-10 best group codes.`}
        </pre>
      </PortalSection>

      <PortalRule />

      <PortalSection title="Request Shape">
        <PortalKeyValues
          rows={[
            {
              k: "MODEL",
              v: (
                <span className="font-mono text-[12px]">
                  anthropic/claude-sonnet-4-6
                </span>
              ),
            },
            {
              k: "TEMP",
              v: <span className="font-mono text-[12px]">0.1</span>,
            },
            {
              k: "FORMAT",
              v: (
                <span className="font-mono text-[12px]">
                  response_format: {`{ type: "json_object" }`}
                </span>
              ),
            },
          ]}
        />
      </PortalSection>

      <PortalRule />

      <PortalSection title="Post-filter">
        The raw JSON response shape is{" "}
        <span className="font-mono text-[12px]">{`{ "groups": ["34", "53", …] }`}</span>.
        We:
        <ul className="mt-2 ml-4 list-disc space-y-1 text-[13px]">
          <li>
            Load every valid FSG code from the SQLite{" "}
            <span className="font-mono text-[12px]">fsg_groups</span> table.
          </li>
          <li>
            Drop any group the model emits that is not in that set (typo or
            hallucination).
          </li>
          <li>
            Cap the final list at <span className="font-mono text-[12px]">12</span>{" "}
            groups, even if the model over-suggests.
          </li>
        </ul>
      </PortalSection>
    </StagePortal>
  );
}

function MatchPortal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <StagePortal
      open={open}
      onClose={onClose}
      stageNumber="04"
      stageTitle="Match"
      kind="LLM"
      model="anthropic/claude-sonnet-4-6"
    >
      <PortalSection title="Purpose">
        Pick the final 3–10 FSC codes with confidence
        (<span className="font-mono text-[12px]">high</span> /
        <span className="font-mono text-[12px]"> medium</span> /
        <span className="font-mono text-[12px]"> low</span>) and reasoning that
        cites specific evidence from the profile. The opinionated part: prefer
        sharper picks over a shotgun list.
      </PortalSection>

      <PortalRule />

      <PromptBlock title="MATCH_SYSTEM · lib/classifier.ts" body={MATCH_SYSTEM_PROMPT} />

      <PortalRule />

      <PortalSection title="User Message">
        <p className="mb-2">
          The candidate pool is the{" "}
          <strong>union of codes in narrowed groups and hint topCodes</strong>
          {" "}— typically 50 to 100 codes. The union lets the matcher override
          the narrower when keyword hints surface a strong code in a group the
          narrower missed.
        </p>
        <pre className="border border-rule bg-[color-mix(in_srgb,var(--paper)_65%,#fff_35%)] p-3 font-mono text-[11.5px] leading-[1.55] text-ink whitespace-pre-wrap">
{`Company profile:
Summary: …
Products: …
Services: …
…

Candidate FSC codes (78):
3408 [34 Metalworking Machinery] — Machining Centers and Way-Type Machines
3411 [34 Metalworking Machinery] — Boring Machines
5305 [53 Hardware and Abrasives] — Screws
…`}
        </pre>
      </PortalSection>

      <PortalRule />

      <PortalSection title="Request Shape">
        <PortalKeyValues
          rows={[
            {
              k: "MODEL",
              v: (
                <span className="font-mono text-[12px]">
                  anthropic/claude-sonnet-4-6
                </span>
              ),
            },
            {
              k: "TEMP",
              v: <span className="font-mono text-[12px]">0.1</span>,
            },
            {
              k: "FORMAT",
              v: (
                <span className="font-mono text-[12px]">
                  forced tool call: record_matches
                </span>
              ),
            },
          ]}
        />
      </PortalSection>

      <PortalRule />

      <PortalSection title="Tool Schema">
        <p className="mb-2">
          The model is forced to call{" "}
          <code className="font-mono text-[12px]">record_matches</code>. The
          tool's JSON Schema is built per-request from the candidate pool, so
          the model's output is constrained at token-generation time — not
          post-hoc validated:
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-[13px]">
          <li>
            <span className="font-mono text-[12px]">code</span> is an{" "}
            <span className="font-mono text-[12px]">enum</span> of the exact
            candidate codes for this request — the model cannot return a code
            that isn't in the pool.
          </li>
          <li>
            <span className="font-mono text-[12px]">confidence</span> is an{" "}
            <span className="font-mono text-[12px]">enum</span> of{" "}
            <span className="font-mono text-[12px]">"high"</span>,{" "}
            <span className="font-mono text-[12px]">"medium"</span>,{" "}
            <span className="font-mono text-[12px]">"low"</span> — guaranteed,
            not defaulted.
          </li>
          <li>
            <span className="font-mono text-[12px]">reasoning</span> is a free
            string — shape, not quality, is enforced.
          </li>
          <li>
            <span className="font-mono text-[12px]">matches</span> is bounded{" "}
            <span className="font-mono text-[12px]">minItems: 1</span>,{" "}
            <span className="font-mono text-[12px]">maxItems: 10</span>.
          </li>
          <li>
            Group code and group name are re-attached from the database on the
            way out, not trusted from the model.
          </li>
        </ul>
      </PortalSection>
    </StagePortal>
  );
}
