import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { scrapeWebsite } from "@/lib/scraper";
import { parsePdfBuffer } from "@/lib/pdf-parser";
import { extractProfile } from "@/lib/extract";
import { computeHints } from "@/lib/hints";
import { narrowGroups, matchCodes } from "@/lib/classifier";
import { ndjsonStream } from "@/lib/stream";
import type { MatchedCode, StageTimings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const companyName = String(form.get("companyName") ?? "").trim();
  const websiteUrlRaw = String(form.get("websiteUrl") ?? "").trim();
  const emailDomain = String(form.get("emailDomain") ?? "").trim();
  const additionalText = String(form.get("additionalText") ?? "").trim();
  const file = form.get("file");

  // If a website URL wasn't provided, derive one from the email domain
  // (e.g. "john@lsdp-mfg.com" → "lsdp-mfg.com") so the scraper still has
  // a target. The scraper prepends https:// for bare domains.
  const scrapeTarget = websiteUrlRaw || domainFromEmail(emailDomain);

  if (!companyName) {
    return new Response(JSON.stringify({ error: "companyName required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = ndjsonStream(async (rawEmit) => {
    const emit: typeof rawEmit = (event) => {
      console.log(`[classify] ${event.stage}`, JSON.stringify(event));
      rawEmit(event);
    };
    const timings: StageTimings = {};
    let scrapedPages: string[] = [];

    // ------- gather -------
    const parts: string[] = [`Company: ${companyName}`];
    if (emailDomain) parts.push(`Email domain: ${emailDomain}`);

    if (scrapeTarget) {
      emit({ stage: "scraping", url: scrapeTarget });
      const t = Date.now();
      try {
        const scraped = await scrapeWebsite(scrapeTarget);
        const durationMs = Date.now() - t;
        timings.scrape = durationMs;
        scrapedPages = scraped.pages;
        parts.push(`Website (${scraped.url}) — ${scraped.title}\n${scraped.text}`);
        emit({
          stage: "scraped",
          bytes: scraped.text.length,
          pages: scraped.pages,
          durationMs,
        });
      } catch (err) {
        timings.scrape = Date.now() - t;
        emit({
          stage: "error",
          message: `scrape failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    let uploadedFilename: string | null = null;
    if (file instanceof File && file.size > 0) {
      uploadedFilename = file.name;
      emit({ stage: "parsing_pdf", filename: file.name });
      const t = Date.now();
      try {
        const buf = Buffer.from(await file.arrayBuffer());
        const text = await parsePdfBuffer(buf);
        const durationMs = Date.now() - t;
        timings.pdf = durationMs;
        parts.push(`Document (${file.name}):\n${text}`);
        emit({ stage: "parsed_pdf", bytes: text.length, durationMs });
      } catch (err) {
        timings.pdf = Date.now() - t;
        emit({
          stage: "error",
          message: `pdf parse failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }

    if (additionalText) parts.push(`Additional notes:\n${additionalText}`);
    const corpus = parts.join("\n\n");

    // ------- stage 1: extract -------
    emit({ stage: "extracting" });
    {
      const t = Date.now();
      var profile = await extractProfile(corpus, req.signal);
      timings.extract = Date.now() - t;
      emit({ stage: "extracted", profile, durationMs: timings.extract });
    }

    // ------- stage 2: hint -------
    emit({ stage: "hinting" });
    {
      const t = Date.now();
      var hints = computeHints(profile);
      timings.hint = Date.now() - t;
      emit({ stage: "hinted", hints, durationMs: timings.hint });
    }

    // ------- stage 3: narrow -------
    emit({ stage: "narrowing" });
    {
      const t = Date.now();
      var narrowedGroups = await narrowGroups(profile, hints, req.signal);
      timings.narrow = Date.now() - t;
      emit({
        stage: "narrowed",
        groups: narrowedGroups,
        durationMs: timings.narrow,
      });
    }

    // ------- stage 4: match -------
    emit({ stage: "matching" });
    const matchStart = Date.now();
    const codes: MatchedCode[] = await matchCodes(
      profile,
      narrowedGroups,
      hints,
      req.signal,
    );
    timings.match = Date.now() - matchStart;
    for (const code of codes) emit({ stage: "match", code });

    // ------- persist -------
    const dbStart = Date.now();
    const db = getDb();
    const runId = db.transaction(() => {
      const insertRun = db.prepare(
        `INSERT INTO runs (
           company_name, website_url, email_domain, additional_text,
           uploaded_filename, company_summary,
           profile_json, hints_json, narrowed_groups_json,
           raw_corpus, scraped_pages_json, timings_json
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const info = insertRun.run(
        companyName,
        websiteUrlRaw || null,
        emailDomain || null,
        additionalText || null,
        uploadedFilename,
        profile.summary,
        JSON.stringify(profile),
        JSON.stringify(hints),
        JSON.stringify(narrowedGroups),
        corpus,
        JSON.stringify(scrapedPages),
        JSON.stringify(timings),
      );
      const rid = Number(info.lastInsertRowid);
      const insertResult = db.prepare(
        `INSERT INTO run_results (run_id, fsc_code, confidence, reasoning) VALUES (?, ?, ?, ?)`,
      );
      for (const c of codes) {
        insertResult.run(rid, c.code, c.confidence, c.reasoning);
      }
      return rid;
    })();

    emit({ stage: "saved", runId, durationMs: Date.now() - dbStart });
    emit({ stage: "done", runId, codes, timings });
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

/**
 * Extract a bare domain from an email-domain input.
 * Accepts: "lsdp-mfg.com", "@lsdp-mfg.com", "john@lsdp-mfg.com".
 * Returns "" if we can't find a plausible domain.
 */
function domainFromEmail(input: string): string {
  if (!input) return "";
  const cleaned = input.includes("@") ? (input.split("@").pop() ?? "") : input;
  const trimmed = cleaned.trim().toLowerCase();
  // Minimal sanity check: must contain a dot and no whitespace.
  if (!/^[a-z0-9.\-]+\.[a-z]{2,}$/.test(trimmed)) return "";
  return trimmed;
}
