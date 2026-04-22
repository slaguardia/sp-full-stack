/**
 * Keyword-overlap hinting — fast pre-filter that finds obvious code matches
 * without calling an LLM. Runs in-process against SQLite.
 *
 * Signal: token overlap between profile phrases (products, services,
 * materials, industries, keywords) and every FSC description. The top-scored
 * codes flow into the Match stage as a recall safety net — if the Narrow
 * stage misses a relevant group, keyword hits can still surface codes from it.
 *
 * NAICS codes are NOT used here as a score boost; they're passed forward as
 * context for the LLM to reason about directly in the Narrow stage.
 */

import { getDb } from "./db";
import type { CompanyProfile, FscCode, HintSignals } from "./types";

type CodeRow = {
  code: string;
  description: string;
  groupCode: string;
  groupName: string;
};

const STOPWORDS = new Set([
  "and",
  "the",
  "for",
  "with",
  "from",
  "that",
  "this",
  "have",
  "into",
  "will",
  "your",
  "our",
  "are",
  "their",
  "they",
  "you",
  "all",
  "any",
  "not",
  "but",
  "also",
  "other",
  "which",
  "some",
  "more",
  "been",
  "being",
  "only",
  "just",
  "very",
  "such",
]);

export function computeHints(profile: CompanyProfile): HintSignals {
  const db = getDb();

  const phrases = [
    ...profile.products,
    ...profile.services,
    ...profile.materials,
    ...profile.industriesServed,
    ...profile.keywords,
  ];
  const tokens = tokenize(phrases.join(" "));

  const codes = db
    .prepare(
      `SELECT c.code, c.description, c.group_code as groupCode, g.name as groupName
       FROM fsc_codes c JOIN fsg_groups g ON g.group_code = c.group_code`,
    )
    .all() as CodeRow[];

  const scored: Array<{ row: CodeRow; score: number }> = [];
  for (const row of codes) {
    const haystack = (row.description + " " + row.groupName).toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1;
    }
    if (score > 0) scored.push({ row, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const topCodes: FscCode[] = scored.slice(0, 40).map((s) => s.row);

  // Group-level rollup for display in the UI pipeline view.
  const groupScores = new Map<string, { score: number; name: string }>();
  for (const { row, score } of scored) {
    const cur = groupScores.get(row.groupCode);
    if (cur) {
      cur.score += score;
    } else {
      groupScores.set(row.groupCode, { score, name: row.groupName });
    }
  }

  const topGroups = Array.from(groupScores.entries())
    .map(([group, v]) => ({ group, name: v.name, score: v.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    naicsGroups: [], // deprecated; NAICS codes flow through the profile, not as scored groups
    topGroups,
    topCodes,
  };
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    ),
  );
}
