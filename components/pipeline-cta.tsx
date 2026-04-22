"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PipelineDiagram } from "./pipeline-diagram";
import {
  ArrowRight,
  ChevronStack,
  CrateIcon,
  ForkliftIcon,
  GearIcon,
} from "./insignia";

/**
 * Dock briefing / hero CTA on the home page.
 * Click opens the full 4-stage pipeline schematic in a modal.
 */
export function PipelineCta() {
  const [open, setOpen] = useState(false);
  // Date + random serial are rendered only after mount to avoid a hydration
  // mismatch (server and client would otherwise produce different values).
  const [stamp, setStamp] = useState<string | null>(null);
  useEffect(() => {
    const date = new Date()
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, ".");
    const serial = Math.floor(Math.random() * 900 + 100);
    setStamp(`${date} · Serial №FSC-${serial}`);
  }, []);

  return (
    <>
      <section
        aria-label="Pipeline briefing"
        className="relative overflow-hidden border-[2.5px] border-steel bg-canvas-parchment"
        style={{ boxShadow: "6px 6px 0 var(--steel)" }}
      >
        {/* top caution tape */}
        <div className="hazard-stripe h-[10px]" aria-hidden />

        {/* faint blueprint grid on the background */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--steel) 1px, transparent 1px), linear-gradient(90deg, var(--steel) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-10 sm:py-8">
          <header className="flex flex-wrap items-center gap-4">
            <span className="stamp-block stamp-steel bg-hazard/70">
              <ChevronStack count={3} size={14} />
              Form FSC-001
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-steel-soft">
              Dock · Loading Bay 04 · Sector N
            </span>
            <span
              suppressHydrationWarning
              className="ml-auto min-h-[16px] font-mono text-[11px] uppercase tracking-[0.22em] text-steel-soft"
            >
              {stamp ?? " "}
            </span>
          </header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="flex flex-col gap-4">
              <h1 className="font-stencil text-[56px] font-black uppercase leading-[0.85] tracking-[-0.005em] text-steel sm:text-[72px] md:text-[84px]">
                Route the freight.
                <br />
                <span className="text-safety">Stamp the codes.</span>
              </h1>
              <p className="max-w-xl font-sans text-[15px] leading-snug text-steel-soft">
                Four stages on the line: extract a company profile, score
                candidate groups, narrow the 78-bin shortlist, then match
                four-digit FSCs with citations. Streamed live from the
                foundry floor.
              </p>
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="btn-ink"
                >
                  <GearIcon size={18} />
                  Open schematic
                  <ArrowRight size={18} />
                </button>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-steel-soft">
                  <span className="h-[7px] w-[7px] rounded-full bg-od siren-glow" />
                  Line status · operational
                </span>
              </div>
            </div>

            {/* Dockside vignette — forklift rolling a crate toward the form */}
            <div
              aria-hidden
              className="relative hidden min-w-[280px] items-end justify-end gap-3 lg:flex"
            >
              <div className="relative text-steel">
                <CrateIcon size={76} />
                <span className="absolute -right-2 -top-2 rotate-[8deg] border-2 border-classified px-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-classified">
                  Fragile
                </span>
              </div>
              <ForkliftIcon size={86} className="text-od" />
            </div>
          </div>
        </div>

        {/* bottom rivet rail */}
        <div className="border-t-[2px] border-steel" />
        <div className="rivet-row" aria-hidden />
      </section>

      <PipelineModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function PipelineModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
      aria-label="Pipeline"
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[rgba(31,28,23,0.72)] px-4 py-8 sm:py-14"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl border-[2.5px] border-steel bg-canvas-parchment"
        style={{ boxShadow: "8px 8px 0 var(--steel)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hazard-stripe h-[8px]" aria-hidden />
        <header className="flex items-center justify-between gap-4 border-b-[2px] border-steel px-6 py-4">
          <div className="flex items-center gap-3">
            <GearIcon size={26} className="text-safety" />
            <div className="flex flex-col leading-none">
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-steel-soft">
                Schematic № FSC-PL-04
              </span>
              <span className="font-stencil text-[26px] font-black uppercase leading-none text-steel">
                The Assembly Line
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="group flex h-9 w-9 items-center justify-center border-2 border-steel font-stencil text-xl font-black leading-none text-steel transition-colors hover:bg-safety hover:text-canvas-parchment"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="px-6 py-6">
          <PipelineDiagram />
        </div>
        <div className="rivet-row" aria-hidden />
      </div>
    </div>,
    document.body,
  );
}
