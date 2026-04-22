/**
 * Visual representation of the 4-stage classification pipeline.
 * Used in the "schematic" modal on the home page.
 */

import { ArrowDown, CrateIcon, GearIcon } from "./insignia";

type Stage = {
  num: string;
  title: string;
  kind: "LLM" | "deterministic";
  model: string;
  input: string;
  output: string;
  why: string;
};

const STAGES: Stage[] = [
  {
    num: "01",
    title: "Extract",
    kind: "LLM",
    model: "claude-haiku-4-5",
    input: "Raw corpus (website + PDF + notes)",
    output:
      "CompanyProfile { summary, products, services, materials, industries, certs, NAICS, SIC, keywords }",
    why: "Structured fields feed every downstream stage. A prose summary would throw away NAICS + certifications — the strongest signals we have.",
  },
  {
    num: "02",
    title: "Triage",
    kind: "deterministic",
    model: "no LLM",
    input: "CompanyProfile",
    output: "HintSignals { naicsGroups, topGroups, topCodes }",
    why: "Keyword scoring against all 661 FSC descriptions. Free, fast, explainable. Also the full fallback when no API key is set.",
  },
  {
    num: "03",
    title: "Narrow",
    kind: "LLM",
    model: "claude-sonnet-4-6",
    input: "Profile + hint signals + list of all 78 FSGs",
    output: "6–10 FSG group codes",
    why: "Cuts the candidate pool from 661 → ~50-100 codes before matching. Matcher isn't distracted by irrelevant categories.",
  },
  {
    num: "04",
    title: "Stamp",
    kind: "LLM",
    model: "claude-sonnet-4-6",
    input: "Profile + codes from narrowed groups ∪ hint topCodes",
    output:
      "3–10 MatchedCode { code, confidence high|med|low, reasoning citing evidence }",
    why: "Opinionated: sharper picks over a shotgun list. Cites specific profile evidence per match.",
  },
];

export function PipelineDiagram() {
  return (
    <div className="flex flex-col gap-4">
      {/* Corpus intro */}
      <div className="card-paper-soft flex items-center gap-3 p-4">
        <CrateIcon size={28} className="text-steel" />
        <div className="flex flex-col gap-1">
          <div className="overline">Raw stock · intake</div>
          <p className="font-sans text-[14px] leading-snug text-steel">
            Everything we know about the subject, crated into one string:
            scraped website text incl. sitemap-discovered product/service
            pages (80kB cap) · extracted PDF text (80kB cap) · pasted notes.
          </p>
        </div>
      </div>

      {STAGES.map((s, i) => (
        <div key={s.num} className="flex flex-col gap-2">
          <Conveyor />
          <article className="card-paper flex flex-col gap-3 p-4">
            <header className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[12px] font-medium tracking-[0.18em] text-safety">
                  № {s.num}
                </span>
                <span className="font-stencil text-[28px] font-black uppercase leading-none tracking-[0.01em] text-steel">
                  {s.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`stamp ${
                    s.kind === "LLM" ? "stamp-red" : "stamp-green"
                  }`}
                >
                  {s.kind}
                </span>
                <span className="font-mono text-[10.5px] tracking-[0.16em] text-steel-soft">
                  {s.model}
                </span>
              </div>
            </header>

            <div className="rule-dotted" />

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13.5px]">
              <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-safety">
                IN
              </dt>
              <dd className="text-steel">{s.input}</dd>
              <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-safety">
                OUT
              </dt>
              <dd className="text-steel">{s.output}</dd>
              <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-safety">
                WHY
              </dt>
              <dd className="italic text-steel-soft">{s.why}</dd>
            </dl>
          </article>

          {i === STAGES.length - 1 && (
            <>
              <Conveyor />
              <div className="card-paper-soft flex items-center gap-3 p-4">
                <GearIcon size={24} className="spin-cog text-od" />
                <div className="flex w-full items-baseline justify-between gap-3">
                  <div className="overline">Shipped</div>
                  <p className="font-sans text-[13.5px] text-steel">
                    Streamed to the UI as events · persisted to SQLite for the
                    register.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Conveyor() {
  return (
    <div className="flex items-center gap-2 px-10">
      <span className="h-px flex-1 bg-rivet" />
      <ArrowDown size={18} className="text-safety" />
      <span className="h-px flex-1 bg-rivet" />
    </div>
  );
}
