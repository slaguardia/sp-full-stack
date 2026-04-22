"use client";

import { useDeferredValue, useEffect, useState } from "react";
import type { FscCode } from "@/lib/types";

type Group = { groupCode: string; groupName: string; codeCount: number };

export function CodeBrowser({ groups }: { groups: Group[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [codes, setCodes] = useState<FscCode[]>([]);
  const [loading, setLoading] = useState(false);

  const deferredQ = useDeferredValue(q);

  useEffect(() => {
    const params = new URLSearchParams();
    if (deferredQ) params.set("q", deferredQ);
    if (group) params.set("group", group);
    params.set("limit", "1000");

    const ac = new AbortController();
    setLoading(true);
    fetch(`/api/fsc-codes?${params.toString()}`, { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : { codes: [] }))
      .then((json: { codes: FscCode[] }) => setCodes(json.codes))
      .catch(() => {
        /* aborted */
      })
      .finally(() => setLoading(false));

    return () => ac.abort();
  }, [deferredQ, group]);

  const isStale = q !== deferredQ;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_280px]">
        <div>
          <div className="field-label">
            <span className="field-num">Q</span>
            <span>Search</span>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="landing gear, wire rope, valve…"
            className="field-input"
          />
        </div>
        <div>
          <div className="field-label">
            <span className="field-num">G</span>
            <span>Group</span>
          </div>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="field-input"
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g.groupCode} value={g.groupCode}>
                {g.groupCode} — {g.groupName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        className={`flex items-baseline justify-between border-t border-ink pt-2 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-muted transition-opacity ${
          isStale ? "opacity-60" : ""
        }`}
      >
        <span>
          {codes.length} {codes.length === 1 ? "entry" : "entries"}
        </span>
        <span>{loading ? "Updating…" : "Indexed"}</span>
      </div>

      {codes.length === 0 ? (
        <div className="flex flex-col items-start gap-2 border border-dashed border-rule bg-[color-mix(in_srgb,var(--paper)_86%,#fff_14%)] px-4 py-6">
          <span className="overline">Empty</span>
          <p className="font-display text-lg italic text-ink-muted">
            {loading ? "Consulting the index…" : "No codes match that query."}
          </p>
        </div>
      ) : (
        <ul
          className={`thin-scroll max-h-[64vh] overflow-auto border-y border-rule transition-opacity ${
            isStale ? "opacity-60" : ""
          }`}
        >
          {codes.map((c, i) => (
            <li
              key={c.code}
              className={`flex items-baseline gap-4 px-2 py-2.5 ${
                i > 0 ? "border-t border-dotted border-rule" : ""
              }`}
            >
              <span className="w-16 shrink-0 font-mono text-[15px] font-semibold text-ink">
                {c.code}
              </span>
              <span className="flex-1 font-display text-[15px] leading-snug text-ink">
                {c.description}
              </span>
              <span className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
                {c.groupCode} · {c.groupName}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
