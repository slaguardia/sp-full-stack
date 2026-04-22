"use client";

import type { CompanyProfile } from "@/lib/types";
import { ShieldIcon } from "./insignia";

type Section = { label: string; values: string[] };

export function ProfilePanel({ profile }: { profile: CompanyProfile }) {
  const sections: Section[] = [
    { label: "Products", values: profile.products },
    { label: "Services", values: profile.services },
    { label: "Materials", values: profile.materials },
    { label: "Industries", values: profile.industriesServed },
    { label: "Certifications", values: profile.certifications },
    { label: "NAICS", values: profile.naicsCodes },
    { label: "SIC", values: profile.sicCodes },
    { label: "Keywords", values: profile.keywords },
  ].filter((s) => s.values.length > 0);

  if (!profile.summary && sections.length === 0) return null;

  return (
    <div className="relative border-[1.5px] border-steel bg-canvas-soft/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldIcon size={18} className="text-od" />
        <span className="overline">Subject dossier · extract stage</span>
        <span className="h-px flex-1 bg-rivet opacity-60" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-steel-soft">
          Cleared
        </span>
      </div>
      {profile.summary && (
        <p className="mb-5 border-l-[3px] border-safety pl-3 font-sans text-[15px] leading-snug text-steel">
          “{profile.summary}”
        </p>
      )}
      {sections.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {sections.map((s) => (
            <div key={s.label} className="flex flex-col gap-1.5">
              <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-steel-soft">
                {s.label}
              </dt>
              <dd className="flex flex-wrap gap-1.5">
                {s.values.slice(0, 10).map((v) => (
                  <span
                    key={v}
                    className="border-[1.5px] border-rivet bg-canvas-parchment px-1.5 py-0.5 font-mono text-[11px] text-steel"
                  >
                    {v}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
