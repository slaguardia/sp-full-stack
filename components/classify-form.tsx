"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readNdjson } from "@/lib/stream";
import type {
  ClassifyEvent,
  CompanyProfile,
  HintSignals,
  MatchedCode,
} from "@/lib/types";
import { StreamProgress, type StageStatus } from "./stream-progress";
import { ResultsGrid } from "./results-grid";
import { ProfilePanel } from "./profile-panel";
import { ArrowRight, BoltIcon, CrateIcon, ShieldIcon } from "./insignia";

type RunDraft = {
  companyName: string;
  websiteUrl: string;
  emailDomain: string;
  additionalText: string;
  filename: string | null;
};

const TEST_COMPANIES = [
  {
    label: "H & R Parts Co",
    companyName: "H & R Parts Co Inc",
    websiteUrl: "hrpartsco.com",
    emailDomain: "hrpartsco.com",
  },
  {
    label: "Loos & Co",
    companyName: "Loos & Co Inc",
    websiteUrl: "loosco.com",
    emailDomain: "loosco.com",
  },
  {
    label: "Lone Star Downhole",
    companyName: "Lone Star Downhole Products",
    websiteUrl: "lsdp-mfg.com",
    emailDomain: "lsdp-mfg.com",
  },
];

export function ClassifyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [stages, setStages] = useState<Record<string, StageStatus>>({});
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [hints, setHints] = useState<HintSignals | null>(null);
  const [narrowedGroups, setNarrowedGroups] = useState<string[]>([]);
  const [codes, setCodes] = useState<MatchedCode[]>([]);
  const [runId, setRunId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  function setStage(key: string, status: StageStatus) {
    setStages((prev) => ({ ...prev, [key]: status }));
  }

  function reset() {
    setStages({});
    setProfile(null);
    setHints(null);
    setNarrowedGroups([]);
    setCodes([]);
    setRunId(null);
    setErrors([]);
  }

  function applyEvent(event: ClassifyEvent, accum: MatchedCode[]) {
    switch (event.stage) {
      case "scraping":
        setStage("scraping", "running");
        break;
      case "scraped":
        setStage("scraping", "done");
        break;
      case "parsing_pdf":
        setStage("parsing_pdf", "running");
        break;
      case "parsed_pdf":
        setStage("parsing_pdf", "done");
        break;
      case "extracting":
        setStage("extracting", "running");
        break;
      case "extracted":
        setStage("extracting", "done");
        setProfile(event.profile);
        break;
      case "hinting":
        setStage("hinting", "running");
        break;
      case "hinted":
        setStage("hinting", "done");
        setHints(event.hints);
        break;
      case "narrowing":
        setStage("narrowing", "running");
        break;
      case "narrowed":
        setStage("narrowing", "done");
        setNarrowedGroups(event.groups);
        break;
      case "matching":
        setStage("matching", "running");
        break;
      case "match":
        accum.push(event.code);
        setCodes([...accum]);
        break;
      case "saved":
        setStage("matching", "done");
        setRunId(event.runId);
        break;
      case "done":
        setStage("matching", "done");
        setRunId(event.runId);
        break;
      case "error":
        setErrors((e) => [...e, event.message]);
        break;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);

    const companyName = String(data.get("companyName") ?? "").trim();
    if (!companyName) return;

    const file = data.get("file");
    const filename = file instanceof File && file.size > 0 ? file.name : null;

    reset();
    setDraft({
      companyName,
      websiteUrl: String(data.get("websiteUrl") ?? "").trim(),
      emailDomain: String(data.get("emailDomain") ?? "").trim(),
      additionalText: String(data.get("additionalText") ?? "").trim(),
      filename,
    });

    setStage("input", "done");
    if (data.get("websiteUrl")) setStage("scraping", "pending");
    if (filename) setStage("parsing_pdf", "pending");
    setStage("extracting", "pending");
    setStage("hinting", "pending");
    setStage("narrowing", "pending");
    setStage("matching", "pending");

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    startTransition(async () => {
      try {
        const res = await fetch("/api/classify", {
          method: "POST",
          body: data,
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          const text = await res.text().catch(() => res.statusText);
          setErrors((e) => [...e, `request failed: ${text}`]);
          return;
        }
        const incoming: MatchedCode[] = [];
        for await (const event of readNdjson<ClassifyEvent>(res.body)) {
          applyEvent(event, incoming);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setErrors((e) => [
            ...e,
            err instanceof Error ? err.message : String(err),
          ]);
        }
      }
    });
  }

  function applyTestCompany(t: (typeof TEST_COMPANIES)[number]) {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("companyName") as HTMLInputElement).value =
      t.companyName;
    (form.elements.namedItem("websiteUrl") as HTMLInputElement).value =
      t.websiteUrl;
    (form.elements.namedItem("emailDomain") as HTMLInputElement).value =
      t.emailDomain;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <section className="card-paper p-6 sm:p-7">
        <header className="mb-5 flex items-baseline gap-3 border-b-2 border-steel pb-3">
          <BoltIcon size={22} className="self-center text-safety" />
          <div className="flex flex-col leading-none">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-steel-soft">
              Form FSC-01 · Intake
            </span>
            <h2 className="font-stencil text-[28px] font-black uppercase leading-none text-steel">
              Subject Dossier
            </h2>
          </div>
          <span className="ml-auto stamp stamp-red">Pending</span>
        </header>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          encType="multipart/form-data"
          className="flex flex-col gap-5"
        >
          <Field num="01" label="Company name" required>
            <input
              name="companyName"
              required
              autoComplete="off"
              placeholder="Acme Industrial Co"
              className="field-input"
            />
          </Field>
          <Field num="02" label="Website">
            <input
              name="websiteUrl"
              autoComplete="off"
              placeholder="acme.com"
              className="field-input"
            />
          </Field>
          <Field num="03" label="Email domain">
            <input
              name="emailDomain"
              autoComplete="off"
              placeholder="acme.com"
              className="field-input"
            />
          </Field>
          <Field num="04" label="Additional notes">
            <textarea
              name="additionalText"
              rows={3}
              placeholder="Product catalog blurbs, NAICS codes, capability statement text…"
              className="field-input"
            />
          </Field>

          <div>
            <div className="field-label">
              <span className="field-num">05</span>
              <span>Capability PDF</span>
              <span className="ml-auto text-ink-soft">optional</span>
            </div>
            <label className="flex cursor-pointer items-center gap-3 border border-ink bg-[color-mix(in_srgb,var(--paper)_78%,#fff_22%)] px-3 py-2.5 text-sm transition-colors hover:bg-[#fbf6e6]">
              <span className="btn-ghost !px-3 !py-1.5 !text-[10.5px]">
                Select file
              </span>
              <span className="truncate text-ink-muted">
                {fileName ?? "no document attached"}
              </span>
              <input
                type="file"
                name="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={pending} className="btn-ink">
              <ShieldIcon size={18} />
              {pending ? "Dispatching…" : "Dispatch for classification"}
              <ArrowRight size={18} />
            </button>
            {pending && (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="btn-ghost"
                style={{ color: "var(--stamp)", borderColor: "var(--stamp)" }}
              >
                Cancel
              </button>
            )}
            {runId && !pending && (
              <button
                type="button"
                onClick={() => router.push(`/results/${runId}`)}
                className="btn-link"
              >
                Open manifest №{runId} →
              </button>
            )}
          </div>
        </form>

        <div className="mt-7 border-t-2 border-steel pt-4">
          <div className="mb-2 flex items-center gap-2">
            <CrateIcon size={18} className="text-od" />
            <span className="overline">Recon targets · drop-in</span>
          </div>
          <ul className="flex flex-col gap-1">
            {TEST_COMPANIES.map((t, i) => (
              <li key={t.label}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => applyTestCompany(t)}
                  className="group flex w-full cursor-pointer items-baseline gap-2 px-2 py-1.5 text-left transition-colors hover:bg-[rgba(232,93,31,0.12)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <span className="serial w-8 font-bold group-hover:text-safety">
                    №{String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-sans text-[14.5px] font-medium text-steel underline decoration-rivet decoration-dotted underline-offset-4 group-hover:text-safety group-hover:decoration-safety">
                    {t.label}
                  </span>
                  <span
                    aria-hidden
                    className="flex-1 self-center border-b border-dashed border-rivet group-hover:border-safety"
                  />
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel-soft group-hover:text-safety">
                    {t.websiteUrl}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="card-paper p-6 sm:p-7">
          <header className="mb-5 flex items-end justify-between gap-3 border-b-2 border-steel pb-3">
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-steel-soft">
                {draft ? "Live transcript · stage trace" : "Assembly line · standby"}
              </span>
              <h2 className="font-stencil text-[28px] font-black uppercase leading-none text-steel">
                {draft ? draft.companyName : "Assembly Line"}
              </h2>
            </div>
            <span
              className={`stamp ${
                draft && pending
                  ? "stamp-amber"
                  : draft && !pending
                    ? "stamp-green"
                    : "stamp-steel"
              }`}
            >
              {draft && pending ? "On line" : draft ? "Shipped" : "Idle"}
            </span>
          </header>

          <StreamProgress
            stages={stages}
            websiteUrl={draft?.websiteUrl}
            filename={draft?.filename ?? null}
          />

          {profile && (
            <div className="mt-6">
              <ProfilePanel profile={profile} />
            </div>
          )}
          {hints && hints.topGroups.length > 0 && (
            <HintsPanel hints={hints} narrowedGroups={narrowedGroups} />
          )}
          {errors.length > 0 && (
            <div className="mt-4 border-2 border-classified bg-[rgba(178,51,28,0.08)] p-3 font-mono text-[12px] text-classified">
              <div className="mb-1.5 flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.2em]">
                <span className="h-2 w-2 rounded-full bg-classified siren-glow" />
                Malfunction · halt line
              </div>
              {errors.map((e, i) => (
                <div key={i}>
                  <span className="mr-2 font-bold">ERR·{String(i + 1).padStart(2, "0")}</span>
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>

        <ResultsGrid codes={codes} pending={pending} />
      </section>
    </div>
  );
}

function Field({
  num,
  label,
  required,
  children,
}: {
  num: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="field-label">
        <span className="field-num">{num}</span>
        <span>{label}</span>
        {required && (
          <span className="ml-auto text-stamp">required</span>
        )}
      </div>
      {children}
    </div>
  );
}

function HintsPanel({
  hints,
  narrowedGroups,
}: {
  hints: HintSignals;
  narrowedGroups: string[];
}) {
  const narrowed = new Set(narrowedGroups);
  return (
    <div className="mt-5 border-[1.5px] border-steel bg-canvas-soft/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="overline">Candidate bins · hint scan</span>
        <span
          aria-hidden
          className="h-px flex-1 bg-rivet opacity-60"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel-soft">
          {hints.topGroups.length} pooled · {narrowed.size} kept
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hints.topGroups.slice(0, 10).map((g) => {
          const picked = narrowed.has(g.group);
          return (
            <span
              key={g.group}
              className={`inline-flex items-baseline gap-2 border-[1.5px] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
                picked
                  ? "border-steel bg-od text-canvas-parchment"
                  : "border-rivet bg-transparent text-steel-soft"
              }`}
            >
              <span className="font-bold">{g.group}</span>
              <span className="not-italic">{g.name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
