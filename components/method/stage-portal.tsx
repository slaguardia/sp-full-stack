"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Shared portal/modal used by the /method page for per-stage deep dives.
 *
 * Pattern lifted from `components/pipeline-cta.tsx`:
 *   - createPortal to document.body
 *   - Esc-to-close, backdrop click, body scroll lock
 *   - Paper background, ink border, hard offset shadow
 *
 * Wider than the home-page modal (max-w-4xl) to fit verbatim prompt blocks.
 */
export function StagePortal({
  open,
  onClose,
  stageNumber,
  stageTitle,
  kind,
  model,
  children,
}: {
  open: boolean;
  onClose: () => void;
  stageNumber: string;
  stageTitle: string;
  kind: "LLM" | "deterministic";
  model: string;
  children: ReactNode;
}) {
  // Mount-aware for SSR / portals
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Esc-to-close + body scroll lock while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stage ${stageNumber} — ${stageTitle}`}
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[color-mix(in_srgb,var(--ink)_55%,transparent)] px-4 py-8 sm:py-14"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl border border-ink bg-[var(--paper)] shadow-[8px_8px_0_rgba(26,23,19,0.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-ink px-6 py-4">
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[11px] tracking-[0.2em] text-ink-muted">
              {stageNumber}
            </span>
            <span className="font-display text-2xl leading-none text-ink">
              {stageTitle}
            </span>
            <span
              className={`stamp ${
                kind === "LLM" ? "stamp-red" : "stamp-green"
              }`}
            >
              {kind}
            </span>
            <span className="hidden font-mono text-[10.5px] tracking-[0.16em] text-ink-muted sm:inline">
              {model}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="group flex h-8 w-8 shrink-0 items-center justify-center border border-ink font-mono text-lg leading-none text-ink transition-colors hover:bg-ink hover:text-paper"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="flex flex-col gap-5 px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Mono-font "typewritten spec" block for prompts. Bordered, tinted, scrollable.
 */
export function PromptBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="overline">{title}</span>
        <span className="font-mono text-[10px] tracking-[0.18em] text-ink-soft">
          verbatim
        </span>
      </div>
      <pre className="thin-scroll max-h-[360px] overflow-auto border border-rule bg-[color-mix(in_srgb,var(--paper)_65%,#fff_35%)] p-4 font-mono text-[11.5px] leading-[1.55] text-ink whitespace-pre-wrap">
        {body}
      </pre>
    </section>
  );
}

/**
 * Generic labeled section within a portal. Title + optional overline tag.
 */
export function PortalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="overline">{title}</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="text-[13.5px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/**
 * Key-value pair list rendered as a monospaced definition table.
 * Used for request shapes, parse rules, etc.
 */
export function PortalKeyValues({
  rows,
}: {
  rows: Array<{ k: string; v: ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt className="font-mono text-[10px] tracking-[0.2em] text-ink-muted">
            {r.k}
          </dt>
          <dd className="text-ink">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Dotted rule separator between sub-sections inside a portal. */
export function PortalRule() {
  return <div className="rule-dotted" />;
}
