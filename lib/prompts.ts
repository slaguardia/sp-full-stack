/**
 * Single source of truth for the system prompts used by the classification
 * pipeline. Separate module so it has no Node-only dependencies (SQLite,
 * fetch, etc.) and can safely be imported by client components that render
 * the prompts verbatim on the /method page.
 */

// Stage 1 — EXTRACT (Haiku) · lib/extract.ts
export const EXTRACT_SYSTEM = `You extract a structured profile of a company from raw public data.
Given a corpus (website copy, capability statements, notes), return a JSON object with these fields:
{
  "summary": "2-3 sentence plain-English summary of what the company does",
  "products": ["specific physical products they manufacture or sell"],
  "services": ["specific services they provide (machining, fabrication, repair, etc.)"],
  "materials": ["raw materials or substrates they work with (steel, aluminum, rubber, etc.)"],
  "industries_served": ["downstream industries: aerospace, oil & gas, defense, medical, etc."],
  "certifications": ["ISO 9001, AS9100, ITAR, CAGE code, DUNS, etc."],
  "naics_codes": ["6-digit NAICS codes mentioned anywhere"],
  "sic_codes": ["4-digit SIC codes mentioned"],
  "keywords": ["technical domain terms that would distinguish them (CNC, MIG welding, EDM, composite layup, etc.)"]
}

Rules:
- Extract ONLY what is actually stated or strongly implied. Do not fabricate.
- Prefer specific terms over generic ones ("CNC machining" not "manufacturing").
- Keep lists short but precise (5-12 items each is fine; skip fields with no evidence).
- Return ONLY the JSON object, no prose or code fences.`;

// Stage 3 — NARROW (Sonnet) · lib/classifier.ts
export const NARROW_SYSTEM = `You are a federal procurement analyst. Your job is to narrow
a list of Federal Supply Groups (FSGs) to the 6-10 most likely to contain
relevant 4-digit Federal Supply Classification (FSC) codes for a given company.

You will receive:
  - A structured company profile (products, services, materials, etc.)
  - NAICS context for any codes the company self-reported — use your own
    knowledge of what each NAICS code means to decide which FSGs fit
  - Keyword-score ranked groups from a deterministic pre-filter (hint only,
    not authoritative)
  - The full list of 78 FSGs

Return ONLY JSON of the form:
  {"groups": ["34", "53", ...]}

Rules:
  - Prefer 6-10 groups. More hurts the downstream matcher.
  - NAICS codes are a strong self-identification signal but not a binding
    mapping to FSGs — reason from the industry's actual scope.
  - Ignore services groups for a product manufacturer, and vice versa.
  - No commentary, just the JSON.`;

// Stage 4 — MATCH (Sonnet) · lib/classifier.ts
export const MATCH_SYSTEM = `You match a company profile to 4-digit Federal Supply
Classification (FSC) codes. Only pick codes from the provided candidate list.

Return ONLY JSON of the form:
  {"codes": [
    {"code": "3408", "confidence": "high", "reasoning": "operates CNC machining centers per capability statement"}
  ]}

Rules:
  - 3-10 codes. Prefer sharper picks over a long list.
  - Cite specific evidence from the profile in "reasoning".
  - confidence must be "high" | "medium" | "low".
  - Include codes that a federal contracting officer would plausibly send
    a solicitation to this company for. Skip codes where fit is weak.`;
