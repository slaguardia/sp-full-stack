"use client";

import { GearIcon } from "./insignia";

export type StageStatus = "pending" | "running" | "done";

type Props = {
  stages: Record<string, StageStatus>;
  websiteUrl?: string;
  filename?: string | null;
};

type StageMeta = {
  key: string;
  num: string;
  label: (ctx: Props) => string;
  visibleWhen: (ctx: Props) => boolean;
};

const STAGE_ORDER: StageMeta[] = [
  {
    key: "input",
    num: "00",
    label: () => "Intake · manifest received",
    visibleWhen: ({ stages }) => Object.keys(stages).length > 0,
  },
  {
    key: "scraping",
    num: "01a",
    label: ({ websiteUrl }) =>
      websiteUrl ? `Scout · ${websiteUrl}` : "Scout · website",
    visibleWhen: ({ stages }) => "scraping" in stages,
  },
  {
    key: "parsing_pdf",
    num: "01b",
    label: ({ filename }) =>
      filename ? `Unpack · ${filename}` : "Unpack · PDF",
    visibleWhen: ({ stages }) => "parsing_pdf" in stages,
  },
  {
    key: "extracting",
    num: "01",
    label: () => "Extract · subject profile (Haiku)",
    visibleWhen: ({ stages }) => "extracting" in stages,
  },
  {
    key: "hinting",
    num: "02",
    label: () => "Triage · NAICS + keyword scoring",
    visibleWhen: ({ stages }) => "hinting" in stages,
  },
  {
    key: "narrowing",
    num: "03",
    label: () => "Narrow · shortlist FSG bins (Sonnet)",
    visibleWhen: ({ stages }) => "narrowing" in stages,
  },
  {
    key: "matching",
    num: "04",
    label: () => "Stamp · final 4-digit codes (Sonnet)",
    visibleWhen: ({ stages }) => "matching" in stages,
  },
];

export function StreamProgress(props: Props) {
  const visible = STAGE_ORDER.filter((s) => s.visibleWhen(props));
  if (visible.length === 0) {
    return (
      <div className="relative flex flex-col items-start gap-3 border-2 border-dashed border-rivet bg-canvas-soft/60 px-5 py-6">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full bg-hazard"
            style={{ boxShadow: "0 0 0 3px rgba(240, 196, 28, 0.25)" }}
          />
          <span className="overline">Line idle · standing by</span>
        </div>
        <p className="font-stencil text-[22px] font-extrabold uppercase leading-none tracking-[0.02em] text-steel-soft">
          Dispatch a subject to start the line.
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col divide-y divide-dashed divide-rivet/60">
      {visible.map((s) => {
        const status = props.stages[s.key] ?? "pending";
        return (
          <li
            key={s.key}
            className="flex items-center gap-3 py-2 font-mono text-[11.5px] uppercase tracking-[0.12em]"
          >
            <span
              className={`w-10 shrink-0 font-mono text-[12px] font-medium tracking-[0.1em] ${
                status === "pending"
                  ? "text-rivet"
                  : status === "running"
                    ? "text-safety"
                    : "text-steel"
              }`}
            >
              {s.num}
            </span>
            <StatusGlyph status={status} />
            <span
              className={`shrink-0 ${
                status === "done"
                  ? "text-steel-soft"
                  : status === "running"
                    ? "text-steel"
                    : "text-rivet"
              }`}
            >
              {s.label(props)}
              {status === "running" && <span className="caret ml-1.5" />}
            </span>
            <span
              aria-hidden
              className="h-0 flex-1 translate-y-[-3px] border-b border-dotted border-rivet"
            />
            <StageStamp status={status} />
          </li>
        );
      })}
    </ol>
  );
}

function StatusGlyph({ status }: { status: StageStatus }) {
  if (status === "running") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center text-safety">
        <GearIcon size={18} className="spin-cog" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span
        aria-hidden
        className="flex h-5 w-5 shrink-0 items-center justify-center border-[1.5px] border-od bg-od text-canvas-parchment"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <polyline
            points="3,9 7,12 13,4"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="h-5 w-5 shrink-0 border-[1.5px] border-dashed border-rivet"
    />
  );
}

function StageStamp({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-od">
        <span className="inline-block h-2 w-2 rotate-45 bg-od" />
        Cleared
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-safety">
        <span className="inline-block h-2 w-2 rounded-full bg-safety siren-glow" />
        On line
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.18em] text-rivet">
      <span className="inline-block h-2 w-2 bg-rivet opacity-60" />
      Queued
    </span>
  );
}
