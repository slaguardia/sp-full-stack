"use client";

import type { Confidence, MatchedCode } from "@/lib/types";
import { CrateIcon } from "./insignia";

const STAMP_CLASS: Record<Confidence, string> = {
  high: "stamp stamp-green stamp-drop",
  medium: "stamp stamp-amber stamp-drop",
  low: "stamp stamp-red stamp-drop",
};

const STAMP_LABEL: Record<Confidence, string> = {
  high: "Approved",
  medium: "Re-verify",
  low: "Hold",
};

export function ResultsGrid({
  codes,
  pending,
}: {
  codes: MatchedCode[];
  pending?: boolean;
}) {
  const grouped = new Map<string, { groupName: string; items: MatchedCode[] }>();
  for (const c of codes) {
    const entry = grouped.get(c.groupCode);
    if (entry) entry.items.push(c);
    else grouped.set(c.groupCode, { groupName: c.groupName, items: [c] });
  }

  if (codes.length === 0) {
    return (
      <div className="card-paper p-6 sm:p-7">
        <Header count={0} pending={pending} />
        {pending ? (
          <SkeletonCodes />
        ) : (
          <div className="flex flex-col items-start gap-3 border-2 border-dashed border-rivet bg-canvas-soft/60 px-5 py-6">
            <div className="flex items-center gap-2">
              <CrateIcon size={20} className="text-steel-soft" />
              <span className="overline">Loading dock · empty</span>
            </div>
            <p className="font-stencil text-[22px] font-extrabold uppercase leading-none tracking-[0.02em] text-steel-soft">
              Codes crate up here once the matcher ships them.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card-paper p-6 sm:p-7">
      <Header count={codes.length} pending={pending} />

      <div className="flex flex-col gap-7">
        {[...grouped.entries()].map(([group, { groupName, items }]) => (
          <section key={group} className="flex flex-col">
            <header className="mb-2 flex items-center gap-3 border-b-[1.5px] border-dashed border-rivet pb-1.5">
              <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-steel-soft">
                <CrateIcon size={14} />
                Bin
              </span>
              <span className="font-mono text-[15px] font-bold text-steel">
                {group}
              </span>
              <span className="font-sans text-[16px] font-bold uppercase leading-none tracking-[0.04em] text-steel">
                {groupName}
              </span>
              <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.18em] text-steel-soft">
                {items.length} × {items.length === 1 ? "unit" : "units"}
              </span>
            </header>
            <ul className="flex flex-col">
              {items.map((c, i) => (
                <CodeRow key={c.code} code={c} index={i} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Header({ count, pending }: { count: number; pending?: boolean }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-3 border-b-2 border-steel pb-3">
      <div className="flex flex-col leading-none">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-steel-soft">
          Shipping manifest · Form FSC-04
        </span>
        <h2 className="font-stencil text-[28px] font-black uppercase leading-none text-steel">
          Outbound Codes
        </h2>
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-steel-soft">
        {count} {count === 1 ? "code" : "codes"}
        {pending ? " · streaming" : ""}
      </span>
    </header>
  );
}

function CodeRow({ code, index }: { code: MatchedCode; index: number }) {
  return (
    <li
      className="ticker-in flex items-start gap-5 border-b border-dotted border-rivet py-4 last:border-b-0"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex w-[116px] shrink-0 flex-col items-end gap-1.5">
        <div className="font-stencil text-[32px] font-black leading-none tracking-[0.01em] text-steel">
          {code.code}
        </div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-steel-soft">
          № FSC-{code.code}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-sans text-[16px] font-bold leading-snug tracking-[0.005em] text-steel">
          {code.description}
        </div>
        {code.reasoning && (
          <p className="mt-1.5 border-l-2 border-safety pl-3 font-sans text-[13.5px] italic leading-relaxed text-steel-soft">
            “{code.reasoning}”
          </p>
        )}
      </div>
      <div className="shrink-0 pt-1">
        <span className={STAMP_CLASS[code.confidence]}>
          {STAMP_LABEL[code.confidence]}
        </span>
      </div>
    </li>
  );
}

function SkeletonCodes() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div
            className="h-7 w-24 animate-pulse bg-canvas-deep"
            style={{ animationDelay: `${i * 120}ms` }}
          />
          <div
            className="h-4 flex-1 animate-pulse bg-canvas-soft"
            style={{ animationDelay: `${i * 120 + 60}ms` }}
          />
          <div
            className="h-5 w-20 animate-pulse bg-canvas-deep"
            style={{ animationDelay: `${i * 120 + 120}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
