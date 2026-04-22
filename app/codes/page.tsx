import { getDb } from "@/lib/db";
import { CodeBrowser } from "@/components/code-browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupRow = {
  groupCode: string;
  groupName: string;
  codeCount: number;
};

export default async function CodesPage() {
  const db = getDb();
  const groups = db
    .prepare(
      `SELECT g.group_code as groupCode, g.name as groupName, COUNT(c.code) as codeCount
       FROM fsg_groups g
       LEFT JOIN fsc_codes c ON c.group_code = g.group_code
       GROUP BY g.group_code
       ORDER BY g.group_code`,
    )
    .all() as GroupRow[];

  const totalCodes = groups.reduce((s, g) => s + g.codeCount, 0);

  return (
    <div className="flex flex-col gap-8 pt-4">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="overline">Index · federal supply catalog</div>
          <span className="serial">
            {groups.length} groups · {totalCodes} codes
          </span>
        </div>
        <div className="rule" />
        <h1 className="font-display text-[52px] leading-[0.95] tracking-[-0.02em]">
          The full catalog,
          <br />
          <em className="italic text-stamp">indexed and searchable.</em>
        </h1>
      </header>
      <aside className="card-paper-soft flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="overline">Note · provenance</span>
          <span className="h-px flex-1 bg-rule" />
          <span className="serial">580 + 81 = {totalCodes}</span>
        </div>
        <p className="font-display text-[15px] leading-relaxed text-ink">
          The DLA handbook{" "}
          <em className="italic">
            AV_FSCClassAssignment (Part IV — FSC Assignments to DLA/GSA)
          </em>{" "}
          lists <strong>580 codes</strong> — only those FSCs for which DLA or
          GSA is the integrated materiel manager. Categories outside that
          scope (ships, food, clothing, nuclear ordnance, etc.) are omitted
          by design.
        </p>
        <p className="font-display text-[15px] leading-relaxed text-ink">
          This catalog supplements the handbook with{" "}
          <strong>81 additional codes</strong> from the NATO Supply
          Classification list, bringing the index to the full{" "}
          <strong>{totalCodes} FSCs</strong> across {groups.length} groups.
        </p>

        <div className="flex flex-col gap-3 border-t border-dashed border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="overline">Sources</span>
            <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] leading-snug">
              <li>
                <a
                  href="https://www.dla.mil/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-rule underline-offset-2 hover:text-stamp"
                >
                  DLA — Defense Logistics Agency
                </a>
              </li>
              <li aria-hidden className="text-ink-muted">
                ·
              </li>
              <li>
                <a
                  href="https://en.wikipedia.org/wiki/NATO_Supply_Classification"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-rule underline-offset-2 hover:text-stamp"
                >
                  NATO Supply Classification
                </a>
              </li>
              <li aria-hidden className="text-ink-muted">
                ·
              </li>
              <li>
                <a
                  href="https://www.asap-components.com/nsn/fscs/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-rule underline-offset-2 hover:text-stamp"
                >
                  FSG group index (ASAP)
                </a>
              </li>
            </ul>
          </div>
          <a
            href="/AV_FSCClassAssignment.pdf"
            download="AV_FSCClassAssignment.pdf"
            className="btn-ink no-underline text-center sm:self-end"
          >
            ↓ Download handbook PDF
          </a>
        </div>
      </aside>
      <div className="card-paper p-6 sm:p-7">
        <CodeBrowser groups={groups} />
      </div>
    </div>
  );
}
