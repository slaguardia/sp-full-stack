import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { ResultsGrid } from "@/components/results-grid";
import { ProfilePanel } from "@/components/profile-panel";
import type { CompanyProfile, HintSignals, MatchedCode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RunRow = {
  id: number;
  companyName: string;
  websiteUrl: string | null;
  emailDomain: string | null;
  additionalText: string | null;
  uploadedFilename: string | null;
  companySummary: string | null;
  profileJson: string | null;
  hintsJson: string | null;
  narrowedGroupsJson: string | null;
  createdAt: string;
};

function safeParse<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) notFound();

  const db = getDb();
  const run = db
    .prepare(
      `SELECT id, company_name as companyName, website_url as websiteUrl,
              email_domain as emailDomain, additional_text as additionalText,
              uploaded_filename as uploadedFilename, company_summary as companySummary,
              profile_json as profileJson, hints_json as hintsJson,
              narrowed_groups_json as narrowedGroupsJson,
              created_at as createdAt
       FROM runs WHERE id = ?`,
    )
    .get(runId) as RunRow | undefined;

  if (!run) notFound();

  const codes = db
    .prepare(
      `SELECT c.code, c.description, c.group_code as groupCode, g.name as groupName,
              rr.confidence, rr.reasoning
       FROM run_results rr
       JOIN fsc_codes c ON c.code = rr.fsc_code
       JOIN fsg_groups g ON g.group_code = c.group_code
       WHERE rr.run_id = ?
       ORDER BY CASE rr.confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, c.code`,
    )
    .all(runId) as MatchedCode[];

  const profile = safeParse<CompanyProfile>(run.profileJson);
  const hints = safeParse<HintSignals>(run.hintsJson);
  const narrowedGroups = safeParse<string[]>(run.narrowedGroupsJson) ?? [];

  const meta = [
    new Date(run.createdAt + "Z").toLocaleString(),
    run.websiteUrl,
    run.emailDomain,
    run.uploadedFilename,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-8 pt-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="overline">Filing №{String(run.id).padStart(3, "0")}</div>
          <span className="serial">Record of classification</span>
        </div>
        <div className="rule" />
        <h1 className="font-display text-[56px] leading-[0.95] tracking-[-0.02em]">
          {run.companyName}
        </h1>
        <p className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-muted">
          {meta}
        </p>
      </header>

      {(profile || run.companySummary) && (
        <section className="card-paper p-6 sm:p-7">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="overline">Section A</span>
              <h2 className="font-display text-2xl leading-none">Company profile</h2>
            </div>
            <span className="serial">Extract stage</span>
          </div>
          {profile ? (
            <ProfilePanel profile={profile} />
          ) : (
            <p className="font-display text-[17px] italic leading-snug text-ink">
              “{run.companySummary}”
            </p>
          )}
        </section>
      )}

      {hints && hints.topGroups.length > 0 && (
        <section className="card-paper p-6 sm:p-7">
          <div className="mb-4 flex items-baseline justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="overline">Section B</span>
              <h2 className="font-display text-2xl leading-none">
                Candidate groups
              </h2>
              <span className="text-[13px] italic text-ink-muted">
                NAICS + keyword hints · groups the narrower kept are filled in.
              </span>
            </div>
            <span className="serial">Hint + narrow stages</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hints.topGroups.map((g) => {
              const picked = narrowedGroups.includes(g.group);
              return (
                <span
                  key={g.group}
                  className={`inline-flex items-baseline gap-2 border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] ${
                    picked
                      ? "border-ink bg-ink text-paper"
                      : "border-rule text-ink-muted"
                  }`}
                >
                  <span className="font-semibold">{g.group}</span>
                  <span>{g.name}</span>
                </span>
              );
            })}
          </div>
        </section>
      )}

      <ResultsGrid codes={codes} />
    </div>
  );
}
