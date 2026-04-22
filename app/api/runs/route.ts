import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
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
    .all();
  return Response.json({ runs: rows });
}
