/**
 * Stage 1 of the classification pipeline: structured extraction.
 *
 * Instead of a prose summary, we ask Haiku to pull specific fields from the
 * raw corpus (website text + PDF text + notes). Structured output gives the
 * downstream stages much richer signals than prose:
 *   - `naics_codes` is passed to the Narrow stage as LLM context
 *   - `keywords` feeds the keyword-hint scorer
 *   - `products` / `services` feed the LLM matcher
 *
 * Using Haiku keeps this step cheap since the corpus can be large.
 */

import type { CompanyProfile } from "./types";
import { EXTRACT_SYSTEM } from "./prompts";
import { stripCodeFences } from "./json";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const EXTRACT_MODEL = "anthropic/claude-haiku-4-5";

export async function extractProfile(
  corpus: string,
  signal?: AbortSignal,
): Promise<CompanyProfile> {
  if (!OPENROUTER_KEY) {
    return stubExtract(corpus);
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_KEY}`,
    },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        // 200K corpus cap. Haiku 4.5 handles 200K tokens; 200K chars is
        // ~50K tokens, leaving plenty of headroom for the system prompt and
        // response generation. Raised from 40K to capture deeper catalogs.
        { role: "user", content: corpus.slice(0, 200_000) },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`extract failed: ${res.status} ${await res.text()}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  return normalizeProfile(raw);
}

function normalizeProfile(raw: string): CompanyProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFences(raw));
  } catch {
    parsed = {};
  }
  const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<
    string,
    unknown
  >;

  const stringArray = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter((s) => s.length > 0)
      : [];

  return {
    summary: String(obj.summary ?? "").trim(),
    products: stringArray(obj.products),
    services: stringArray(obj.services),
    materials: stringArray(obj.materials),
    industriesServed: stringArray(obj.industries_served ?? obj.industriesServed),
    certifications: stringArray(obj.certifications),
    naicsCodes: stringArray(obj.naics_codes ?? obj.naicsCodes).map((s) =>
      s.replace(/\D/g, "").slice(0, 6),
    ).filter((s) => s.length === 6),
    sicCodes: stringArray(obj.sic_codes ?? obj.sicCodes).map((s) =>
      s.replace(/\D/g, "").slice(0, 4),
    ).filter((s) => s.length === 4),
    keywords: stringArray(obj.keywords),
  };
}

/**
 * Fallback when no API key is set — basic regex + keyword extraction so the
 * rest of the pipeline can still run for local dev and testing.
 */
function stubExtract(corpus: string): CompanyProfile {
  const text = corpus.slice(0, 20_000);
  const naics = Array.from(text.matchAll(/\b(NAICS[:\s]*)?(\d{6})\b/gi))
    .map((m) => m[2])
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .slice(0, 10);
  const sic = Array.from(text.matchAll(/\bSIC[:\s]*(\d{4})\b/gi))
    .map((m) => m[1])
    .filter((c, i, arr) => arr.indexOf(c) === i);

  const certPatterns = [
    /ISO\s*\d{4,5}(?:[-:\s]\d{4})?/gi,
    /AS\s*\d{4}[A-Z]?/gi,
    /ITAR/gi,
    /CAGE[:\s]+[A-Z0-9]+/gi,
    /DUNS[:\s]+\d+/gi,
    /JCP/gi,
  ];
  const certifications = certPatterns
    .flatMap((r) => Array.from(text.matchAll(r)).map((m) => m[0]))
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .slice(0, 10);

  const keywordHints = [
    "CNC",
    "machining",
    "milling",
    "turning",
    "welding",
    "fabrication",
    "rubber",
    "molding",
    "casting",
    "forging",
    "sheet metal",
    "laser",
    "EDM",
    "composite",
    "precision",
    "aerospace",
    "defense",
    "aircraft",
    "landing gear",
    "hydraulic",
    "electrical",
    "valve",
    "pump",
    "bearing",
    "fastener",
    "wire",
    "cable",
  ];
  const lower = text.toLowerCase();
  const keywords = keywordHints
    .filter((k) => lower.includes(k.toLowerCase()))
    .slice(0, 12);

  return {
    summary: `[stub extraction — set OPENROUTER_API_KEY for real LLM] ${text
      .replace(/\s+/g, " ")
      .slice(0, 300)}…`,
    products: [],
    services: [],
    materials: [],
    industriesServed: [],
    certifications,
    naicsCodes: naics,
    sicCodes: sic,
    keywords,
  };
}
