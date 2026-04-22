import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const group = url.searchParams.get("group")?.trim() ?? "";
  // Default returns every code (we only have 661 — cheap to ship whole list).
  // Hard cap at 2000 as a sanity bound in case someone passes a garbage value.
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 2000);

  const db = getDb();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (q) {
    where.push("(c.code LIKE ? OR c.description LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  if (group) {
    where.push("c.group_code = ?");
    args.push(group);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = db
    .prepare(
      `SELECT c.code, c.description, c.group_code as groupCode, g.name as groupName
       FROM fsc_codes c JOIN fsg_groups g ON g.group_code = c.group_code
       ${whereSql}
       ORDER BY c.code
       LIMIT ?`,
    )
    .all(...args, limit);

  return Response.json({ codes: rows });
}
