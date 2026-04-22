/**
 * Multi-stage FSC classification pipeline.
 *
 * Rather than a single LLM call against all 661 codes, we break classification
 * into cheap + accurate stages:
 *
 *   1. EXTRACT (Haiku)   — structured profile from raw corpus
 *   2. HINT (no LLM)     — keyword-overlap scoring against all 661 codes;
 *                          NAICS codes passed forward as context (no boost)
 *   3. NARROW (Sonnet)   — choose 6-10 FSG groups (78 → ~8) from the full list
 *                          PLUS hint signals, producing a shortlist
 *   4. MATCH (Sonnet)    — pick final 3-10 codes from the narrowed candidate
 *                          set (~50-100 codes) with confidence + reasoning
 *
 * Why this shape:
 *   - Dumping 661 codes on Sonnet works but wastes tokens and dilutes accuracy.
 *     Narrowing first gives the matcher a focused candidate list.
 *   - Hints run without an LLM, so they're free and deterministic — great
 *     baseline for demo and fallback when the API key is missing.
 *   - Structured extraction feeds every downstream stage. Prose summaries
 *     throw away the useful signals (NAICS, certifications, keywords).
 */

import type {
  CompanyProfile,
  Confidence,
  FscCode,
  HintSignals,
  MatchedCode,
} from "./types";
import { getDb } from "./db";
import { NARROW_SYSTEM, MATCH_SYSTEM } from "./prompts";
import { stripCodeFences } from "./json";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const NARROW_MODEL = "anthropic/claude-sonnet-4-6";
const MATCH_MODEL = "anthropic/claude-sonnet-4-6";

// Keep re-exporting extract for ergonomics; the API route imports this file.
export { extractProfile } from "./extract";
export { computeHints } from "./hints";

export async function narrowGroups(
  profile: CompanyProfile,
  hints: HintSignals,
  signal?: AbortSignal,
): Promise<string[]> {
  const db = getDb();
  const allGroups = db
    .prepare(`SELECT group_code as code, name FROM fsg_groups ORDER BY group_code`)
    .all() as Array<{ code: string; name: string }>;

  if (!OPENROUTER_KEY) {
    // Fallback: use hint groups directly, padded to 8
    const fromHints = hints.topGroups.slice(0, 8).map((g) => g.group);
    if (fromHints.length >= 4) return fromHints;
    // If we have too few, take top-scoring groups from hints anyway
    return hints.topGroups.map((g) => g.group).slice(0, 8);
  }

  const groupList = allGroups
    .map((g) => `${g.code} — ${g.name}`)
    .join("\n");

  const keywordHints = hints.topGroups.length
    ? hints.topGroups
        .map((g) => `  ${g.group} (${g.name}) — score ${g.score}`)
        .join("\n")
    : "(none)";

  const naicsContext = profile.naicsCodes.length
    ? `The company self-identifies with NAICS code(s): ${profile.naicsCodes.join(", ")}. NAICS is the Census Bureau's industry classification; use your knowledge of what these codes mean to inform which FSGs are most relevant. There is no formal NAICS↔FSG mapping — reason from the industry description.`
    : "No NAICS codes provided.";

  const userMsg = `Company profile:
${profileToString(profile)}

NAICS context:
${naicsContext}

Keyword-score ranked groups (from deterministic pre-filter):
${keywordHints}

All 78 FSGs:
${groupList}

Return {"groups": [...]} with 6-10 best group codes.`;

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: NARROW_MODEL,
      messages: [
        { role: "system", content: NARROW_SYSTEM },
        { role: "user", content: userMsg },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`narrow failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    parsed = {};
  }
  const groups = Array.isArray((parsed as { groups?: unknown }).groups)
    ? ((parsed as { groups: unknown[] }).groups as unknown[])
    : [];
  const validGroupSet = new Set(allGroups.map((g) => g.code));
  return groups
    .map((g) => String(g).trim())
    .filter((g) => validGroupSet.has(g))
    .slice(0, 12);
}

// ---------------------------------------------------------------------------
// Stage 4: MATCH — pick final codes from the narrowed candidate set
// ---------------------------------------------------------------------------

export async function matchCodes(
  profile: CompanyProfile,
  candidateGroups: string[],
  hints: HintSignals,
  signal?: AbortSignal,
): Promise<MatchedCode[]> {
  const db = getDb();

  // Build candidate pool: all codes in narrowed groups + top hinted codes
  const groupPlaceholders = candidateGroups.length
    ? candidateGroups.map(() => "?").join(",")
    : "''";
  const groupCodes = candidateGroups.length
    ? (db
        .prepare(
          `SELECT c.code, c.description, c.group_code as groupCode, g.name as groupName
           FROM fsc_codes c JOIN fsg_groups g ON g.group_code = c.group_code
           WHERE c.group_code IN (${groupPlaceholders})
           ORDER BY c.code`,
        )
        .all(...candidateGroups) as FscCode[])
    : [];

  const byCode = new Map<string, FscCode>();
  for (const c of groupCodes) byCode.set(c.code, c);
  for (const c of hints.topCodes) if (!byCode.has(c.code)) byCode.set(c.code, c);

  const candidates = Array.from(byCode.values());

  if (!OPENROUTER_KEY) {
    return stubMatch(profile, candidates);
  }

  const catalog = candidates
    .map((c) => `${c.code} [${c.groupCode} ${c.groupName}] — ${c.description}`)
    .join("\n");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: MATCH_MODEL,
      messages: [
        { role: "system", content: MATCH_SYSTEM },
        {
          role: "user",
          content: `Company profile:\n${profileToString(profile)}\n\nCandidate FSC codes (${candidates.length}):\n${catalog}\n\nReturn JSON only.`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`match failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  return hydrateMatches(raw, byCode);
}

// ---------------------------------------------------------------------------
// Back-compat wrappers (the old API route signature still works if needed).
// The new API route should call each stage individually to stream events.
// ---------------------------------------------------------------------------

export async function runPipeline(
  corpus: string,
  signal?: AbortSignal,
): Promise<{
  profile: CompanyProfile;
  hints: HintSignals;
  narrowedGroups: string[];
  codes: MatchedCode[];
}> {
  const { extractProfile } = await import("./extract");
  const { computeHints } = await import("./hints");
  const profile = await extractProfile(corpus, signal);
  const hints = computeHints(profile);
  const narrowedGroups = await narrowGroups(profile, hints, signal);
  const codes = await matchCodes(profile, narrowedGroups, hints, signal);
  return { profile, hints, narrowedGroups, codes };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function profileToString(p: CompanyProfile): string {
  const lines: string[] = [];
  if (p.summary) lines.push(`Summary: ${p.summary}`);
  if (p.products.length) lines.push(`Products: ${p.products.join(", ")}`);
  if (p.services.length) lines.push(`Services: ${p.services.join(", ")}`);
  if (p.materials.length) lines.push(`Materials: ${p.materials.join(", ")}`);
  if (p.industriesServed.length)
    lines.push(`Industries served: ${p.industriesServed.join(", ")}`);
  if (p.certifications.length)
    lines.push(`Certifications: ${p.certifications.join(", ")}`);
  if (p.naicsCodes.length) lines.push(`NAICS codes: ${p.naicsCodes.join(", ")}`);
  if (p.sicCodes.length) lines.push(`SIC codes: ${p.sicCodes.join(", ")}`);
  if (p.keywords.length) lines.push(`Keywords: ${p.keywords.join(", ")}`);
  return lines.join("\n");
}

function hydrateMatches(
  raw: string,
  byCode: Map<string, FscCode>,
): MatchedCode[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    return [];
  }
  const arr = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { codes?: unknown }).codes)
      ? ((parsed as { codes: unknown[] }).codes as unknown[])
      : Array.isArray((parsed as { matches?: unknown }).matches)
        ? ((parsed as { matches: unknown[] }).matches as unknown[])
        : [];

  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((x) => {
      const code = String(x.code ?? "").trim();
      const meta = byCode.get(code);
      if (!meta) return null;
      const confRaw = String(x.confidence ?? "medium").toLowerCase();
      const confidence: Confidence = (
        ["high", "medium", "low"].includes(confRaw) ? confRaw : "medium"
      ) as Confidence;
      return {
        ...meta,
        confidence,
        reasoning: String(x.reasoning ?? ""),
      } satisfies MatchedCode;
    })
    .filter((x): x is MatchedCode => x !== null);
}

function stubMatch(profile: CompanyProfile, candidates: FscCode[]): MatchedCode[] {
  const words = [
    ...profile.products,
    ...profile.services,
    ...profile.materials,
    ...profile.keywords,
    profile.summary,
  ]
    .join(" ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

  const scored = candidates
    .map((c) => {
      const desc = (c.description + " " + c.groupName).toLowerCase();
      const score = words.reduce((s, w) => (desc.includes(w) ? s + 1 : s), 0);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return scored.map(({ c, score }) => ({
    ...c,
    confidence: (score >= 3 ? "high" : score === 2 ? "medium" : "low") as Confidence,
    reasoning: `[stub] keyword overlap score ${score}`,
  }));
}
