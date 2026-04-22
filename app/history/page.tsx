import { getDb } from "@/lib/db";
import { HistoryList, type HistoryRow } from "@/components/history-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.id, r.company_name as companyName, r.website_url as websiteUrl,
              r.email_domain as emailDomain, r.created_at as createdAt,
              COUNT(rr.id) as codeCount
       FROM runs r
       LEFT JOIN run_results rr ON rr.run_id = r.id
       GROUP BY r.id
       ORDER BY r.id DESC
       LIMIT 100`,
    )
    .all() as HistoryRow[];

  return (
    <div className="flex flex-col gap-8 pt-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="overline">Register · past filings</div>
          <span className="serial">
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        <div className="rule" />
        <h1 className="font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
          Every company we've&nbsp;
          <em className="italic text-stamp">filed on record.</em>
        </h1>
      </header>

      <HistoryList initialRows={rows} />
    </div>
  );
}
