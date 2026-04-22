/**
 * Re-exports the runtime system prompts so the /method page can display the
 * exact text the pipeline actually uses. Single source of truth: lib/prompts.ts.
 */

export {
  EXTRACT_SYSTEM as EXTRACT_SYSTEM_PROMPT,
  NARROW_SYSTEM as NARROW_SYSTEM_PROMPT,
  MATCH_SYSTEM as MATCH_SYSTEM_PROMPT,
} from "@/lib/prompts";
