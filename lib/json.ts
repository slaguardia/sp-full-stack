/**
 * Haiku and Sonnet (via OpenRouter) sometimes wrap JSON responses in
 * ```json … ``` fences despite `response_format: { type: "json_object" }`
 * being set and the system prompt explicitly asking for bare JSON. Without
 * stripping, `JSON.parse` throws, the caller's try/catch returns an empty
 * object, and downstream stages run on nothing.
 *
 * No-op on bare JSON. Strips a single leading/trailing fence pair only.
 */
export function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return m ? m[1].trim() : trimmed;
}
