"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type HistoryRow = {
  id: number;
  companyName: string;
  websiteUrl: string | null;
  emailDomain: string | null;
  createdAt: string;
  codeCount: number;
};

function formatFiled(createdAt: string): string {
  return new Date(createdAt + "Z")
    .toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

export function HistoryList({ initialRows }: { initialRows: HistoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: number) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      setConfirmId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setPendingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="card-paper flex flex-col items-start gap-2 p-8">
        <span className="overline">Empty</span>
        <p className="font-display text-xl italic">
          No filings on record yet. Classify a company to open the register.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="card-paper-soft flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-stamp">
            Delete failed · {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="card-paper overflow-hidden">
        <div className="grid grid-cols-[72px_1fr_160px_100px_64px] gap-4 border-b border-ink px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-muted">
          <span>№</span>
          <span>Company · source</span>
          <span>Filed</span>
          <span className="text-right">Codes</span>
          <span className="text-right" aria-hidden />
        </div>
        <ul>
          {rows.map((r, i) => {
            const isConfirming = confirmId === r.id;
            const isPending = pendingId === r.id;
            return (
              <li
                key={r.id}
                className={`group relative ${
                  i > 0 ? "border-t border-dotted border-rule" : ""
                } ${isPending ? "opacity-50" : ""}`}
              >
                <div className="grid grid-cols-[72px_1fr_160px_100px_64px] items-baseline gap-4">
                  <Link
                    href={`/results/${r.id}`}
                    prefetch
                    className="col-span-4 grid grid-cols-[72px_1fr_160px_100px] items-baseline gap-4 px-5 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--paper)_70%,_#fff_30%)]"
                  >
                    <span className="font-mono text-[13px] font-semibold text-ink">
                      №{String(r.id).padStart(3, "0")}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-display text-[18px] leading-tight text-ink">
                        {r.companyName}
                      </span>
                      {(r.websiteUrl || r.emailDomain) && (
                        <span className="truncate font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted">
                          {r.websiteUrl ?? r.emailDomain}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-ink-muted">
                      {formatFiled(r.createdAt)}
                    </span>
                    <span className="text-right font-mono text-[13px] font-semibold text-ink">
                      {r.codeCount}
                      <span className="ml-1 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">
                        {r.codeCount === 1 ? "code" : "codes"}
                      </span>
                    </span>
                  </Link>
                  <div className="flex items-center justify-end pr-4">
                    {!isConfirming && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setConfirmId(r.id);
                        }}
                        className="font-mono text-[14px] leading-none text-ink-muted opacity-0 transition-opacity hover:text-stamp focus:opacity-100 group-hover:opacity-100"
                        aria-label={`Delete run ${r.id} (${r.companyName})`}
                        title="Delete filing"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                {isConfirming && (
                  <div className="absolute inset-y-0 right-0 z-10 flex items-center gap-1.5 bg-[var(--parchment)] pl-6 pr-5">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={isPending}
                      className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-stamp hover:underline disabled:opacity-50"
                      aria-label={`Confirm delete run ${r.id}`}
                    >
                      {isPending ? "…" : "Confirm"}
                    </button>
                    <span className="text-ink-muted">·</span>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      disabled={isPending}
                      className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
