export type ClassifyInput = {
  companyName: string;
  websiteUrl?: string;
  emailDomain?: string;
  additionalText?: string;
  uploadedFile?: { name: string; buffer: Buffer };
};

export type Confidence = "high" | "medium" | "low";

export type MatchedCode = {
  code: string;
  description: string;
  groupCode: string;
  groupName: string;
  confidence: Confidence;
  reasoning: string;
};

export type FscCode = {
  code: string;
  description: string;
  groupCode: string;
  groupName: string;
};

/**
 * Structured output of the extraction stage. Replaces the simple prose
 * summary with fields that downstream stages can consume directly.
 */
export type CompanyProfile = {
  summary: string;
  products: string[];
  services: string[];
  materials: string[];
  industriesServed: string[];
  certifications: string[];
  naicsCodes: string[];
  sicCodes: string[];
  keywords: string[];
};

export type RankedGroup = {
  group: string;
  name: string;
  score: number;
};

/**
 * Output of the hinting stage. These are non-LLM signals that boot-strap the
 * narrowing stage with high-probability candidates.
 */
export type HintSignals = {
  naicsGroups: string[]; // deprecated; always [] — kept for historical run compat
  topGroups: RankedGroup[]; // Groups ranked by combined NAICS + keyword score
  topCodes: FscCode[]; // Top keyword-matched codes (recall boost for matcher)
};

export type RunSummary = {
  id: number;
  companyName: string;
  websiteUrl: string | null;
  emailDomain: string | null;
  createdAt: string;
  codeCount: number;
};

export type RunDetail = RunSummary & {
  additionalText: string | null;
  uploadedFilename: string | null;
  companySummary: string | null;
  codes: MatchedCode[];
};

/**
 * Server-sent events streamed to the frontend during classification. Each
 * stage emits a start event and a completion event, allowing the UI to show
 * a live pipeline view.
 */
export type StageTimings = Partial<
  Record<"scrape" | "pdf" | "extract" | "hint" | "narrow" | "match", number>
>;

export type ClassifyEvent =
  | { stage: "scraping"; url: string }
  | { stage: "scraped"; bytes: number; pages: string[]; durationMs: number }
  | { stage: "parsing_pdf"; filename: string }
  | { stage: "parsed_pdf"; bytes: number; durationMs: number }
  | { stage: "extracting" }
  | { stage: "extracted"; profile: CompanyProfile; durationMs: number }
  | { stage: "hinting" }
  | { stage: "hinted"; hints: HintSignals; durationMs: number }
  | { stage: "narrowing" }
  | { stage: "narrowed"; groups: string[]; durationMs: number }
  | { stage: "matching" }
  | { stage: "match"; code: MatchedCode }
  | { stage: "saved"; runId: number; durationMs: number }
  | { stage: "error"; message: string }
  | {
      stage: "done";
      runId: number;
      codes: MatchedCode[];
      timings: StageTimings;
    };
