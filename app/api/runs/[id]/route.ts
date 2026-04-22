import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, company_name as companyName, website_url as websiteUrl,
              email_domain as emailDomain, additional_text as additionalText,
              uploaded_filename as uploadedFilename, company_summary as companySummary,
              profile_json as profileJson, hints_json as hintsJson,
              narrowed_groups_json as narrowedGroupsJson,
              raw_corpus as rawCorpus,
              scraped_pages_json as scrapedPagesJson,
              timings_json as timingsJson,
              created_at as createdAt
       FROM runs WHERE id = ?`,
    )
    .get(runId) as
    | {
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
        rawCorpus: string | null;
        scrapedPagesJson: string | null;
        timingsJson: string | null;
        createdAt: string;
      }
    | undefined;

  if (!row) return Response.json({ error: "not found" }, { status: 404 });

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
    .all(runId);

  const safeParse = (s: string | null) => {
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  return Response.json({
    run: {
      id: row.id,
      companyName: row.companyName,
      websiteUrl: row.websiteUrl,
      emailDomain: row.emailDomain,
      additionalText: row.additionalText,
      uploadedFilename: row.uploadedFilename,
      companySummary: row.companySummary,
      profile: safeParse(row.profileJson),
      hints: safeParse(row.hintsJson),
      narrowedGroups: safeParse(row.narrowedGroupsJson) ?? [],
      rawCorpus: row.rawCorpus,
      scrapedPages: safeParse(row.scrapedPagesJson) ?? [],
      timings: safeParse(row.timingsJson) ?? {},
      createdAt: row.createdAt,
      codes,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const runId = Number(id);
  if (!Number.isFinite(runId)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }

  const db = getDb();
  const result = db.prepare("DELETE FROM runs WHERE id = ?").run(runId);
  if (result.changes === 0) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ ok: true, deletedId: runId });
}
