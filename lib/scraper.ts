/**
 * Website scraping with opportunistic sitemap discovery.
 *
 * Flow:
 *   1. Fetch the user-supplied URL (primary page). Always scraped.
 *   2. Try to discover a sitemap at the origin (/sitemap.xml, /sitemap_index.xml, robots.txt).
 *   3. From the sitemap, rank URLs by path relevance — prefer /products,
 *      /services, /capabilities; deprioritize /blog, /careers, /privacy.
 *   4. Fetch the top 2 relevant URLs in parallel and concatenate their text
 *      behind the primary page.
 *
 * We deliberately cap at 2 extra pages, not "everything in the sitemap":
 * some companies have hundreds of pages and we'd drown Haiku in boilerplate.
 */

import * as cheerio from "cheerio";

// Caps are intentionally generous — Haiku 4.5 has a 200K-token context,
// we're well under even when all sources are full.
const PER_PAGE_CAP = 40_000; // per-page text cap
const TOTAL_TEXT_CAP = 80_000; // combined text cap across all pages
const EXTRA_PAGES = 2; // additional pages pulled from sitemap
const FETCH_TIMEOUT_MS = 12_000;
const SITEMAP_TIMEOUT_MS = 6_000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; SalesPatriotFSC/0.1; +https://salespatriot.com)";

export type ScrapeResult = {
  url: string;
  title: string;
  text: string;
  pages: string[]; // URLs actually scraped (primary first)
};

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  const userSpecifiedScheme = url.startsWith("http");
  let normalized = userSpecifiedScheme ? url : `https://${url}`;

  // ---- primary ----
  // fetchAndExtract throws on failure so the caller surfaces the reason
  // (HTTP status, DNS, timeout) instead of silently returning an empty
  // corpus that makes every downstream stage look broken.
  //
  // For bare-domain inputs, fall back to http:// if https:// fails. Small
  // manufacturers often have expired certs or don't serve HTTPS at all, and
  // we'd rather get their homepage text than bail on a TLS handshake.
  let primary: Awaited<ReturnType<typeof fetchAndExtract>>;
  try {
    primary = await fetchAndExtract(normalized, { captureLinks: true });
  } catch (err) {
    if (userSpecifiedScheme) throw err;
    const httpUrl = normalized.replace(/^https:/, "http:");
    primary = await fetchAndExtract(httpUrl, { captureLinks: true });
    normalized = httpUrl;
  }

  // ---- discover candidate URLs ----
  // Preference order:
  //   1. Sitemap (canonical, comprehensive)
  //   2. Links on the primary page's own HTML (fallback — works when no sitemap)
  //
  // We never go past this: no recursive crawling, no JS rendering. For a few
  // companies with JS-heavy SPAs and no sitemap, we'll end up primary-only,
  // which is the same as before this module was scope-expanded.
  let extraUrls: string[] = [];
  try {
    const origin = new URL(normalized).origin;
    const sitemapUrls = await discoverSitemapUrls(origin);
    if (sitemapUrls.length) {
      extraUrls = rankAndPickRelevant(sitemapUrls, normalized, EXTRA_PAGES);
    } else if (primary.links?.length) {
      extraUrls = rankAndPickRelevant(primary.links, normalized, EXTRA_PAGES);
    }
  } catch {
    // swallow — we always have the primary page
  }

  // ---- parallel fetch extras ----
  const extrasSettled = await Promise.allSettled(
    extraUrls.map((u) => fetchAndExtract(u)),
  );
  const extras = extrasSettled
    .filter(
      (r): r is PromiseFulfilledResult<{ url: string; title: string; text: string }> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  // ---- assemble ----
  const pages = [primary.url, ...extras.map((e) => e.url)];
  const text = joinPages(primary, extras);

  return {
    url: primary.url,
    title: primary.title,
    text,
    pages,
  };
}

// ---------------------------------------------------------------------------
// Single-page fetch + text extraction
// ---------------------------------------------------------------------------

async function fetchAndExtract(
  targetUrl: string,
  opts?: { captureLinks?: boolean },
): Promise<{
  url: string;
  title: string;
  text: string;
  links?: string[];
}> {
  const res = await fetch(targetUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`${targetUrl} responded ${res.status}`);
  }
  const html = await res.text();
  const finalUrl = res.url || targetUrl;
  const $ = cheerio.load(html);

  // Capture links BEFORE removing nav/footer, since that's usually where
  // the "Products/Services/About" links live.
  let links: string[] | undefined;
  if (opts?.captureLinks) {
    links = extractSameOriginLinks($, finalUrl);
  }

  $("script, style, noscript, svg, iframe, header nav, footer").remove();
  const title = $("title").text().trim() || $("h1").first().text().trim();
  const text = $("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PER_PAGE_CAP);

  return { url: finalUrl, title, text, links };
}

function extractSameOriginLinks(
  $: cheerio.CheerioAPI,
  baseUrl: string,
): string[] {
  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return [];
  }

  const out = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("mailto:"))
      return;
    try {
      const abs = new URL(trimmed, baseUrl);
      if (abs.origin !== baseOrigin) return;
      abs.hash = "";
      out.add(abs.toString());
    } catch {
      /* skip malformed hrefs */
    }
  });
  return Array.from(out);
}

function joinPages(
  primary: { url: string; title: string; text: string },
  extras: Array<{ url: string; title: string; text: string }>,
): string {
  const chunks: string[] = [];
  let remaining = TOTAL_TEXT_CAP;

  // Primary gets what it wants up to its per-page cap.
  chunks.push(`[Page: ${primary.url}]\n${primary.text}`);
  remaining -= primary.text.length;

  // Extras share the remainder; each capped at their own slice.
  for (const e of extras) {
    if (remaining <= 0) break;
    const slice = e.text.slice(0, remaining);
    chunks.push(`[Page: ${e.url}]\n${slice}`);
    remaining -= slice.length;
  }
  return chunks.join("\n\n---\n\n");
}

// ---------------------------------------------------------------------------
// Sitemap discovery
// ---------------------------------------------------------------------------

async function discoverSitemapUrls(origin: string): Promise<string[]> {
  const candidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-index.xml`,
  ];

  for (const url of candidates) {
    const urls = await fetchSitemap(url);
    if (urls.length) return urls;
  }

  // Last-resort: robots.txt can point at a non-standard sitemap location.
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (res.ok) {
      const txt = await res.text();
      const m = txt.match(/Sitemap:\s*(\S+)/i);
      if (m) return fetchSitemap(m[1]);
    }
  } catch {
    /* ignore */
  }
  return [];
}

/**
 * Parses either a urlset sitemap (list of URLs) or a sitemapindex (list of
 * child sitemaps). For indexes we fetch up to MAX_CHILD_SITEMAPS children in
 * parallel — companies like Loos have separate sitemaps for pages, posts, and
 * categories; the "pages" one is where product/service URLs live, and it
 * might not be the first entry. Total URLs are capped so huge e-commerce
 * sitemaps don't balloon our ranking step.
 */
const MAX_CHILD_SITEMAPS = 5;
const MAX_URLS = 500;

async function fetchSitemap(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS),
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const xml = await res.text();

    // Sitemap index → follow up to N children in parallel.
    if (/<sitemapindex/i.test(xml)) {
      const children = Array.from(
        xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi),
      )
        .map((m) => m[1].trim())
        .slice(0, MAX_CHILD_SITEMAPS);
      if (!children.length) return [];
      const settled = await Promise.allSettled(children.map(fetchSitemap));
      const urls = settled
        .filter(
          (s): s is PromiseFulfilledResult<string[]> => s.status === "fulfilled",
        )
        .flatMap((s) => s.value);
      return urls.slice(0, MAX_URLS);
    }

    // Regular sitemap — collect <loc> entries.
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)).map(
      (m) => m[1].trim(),
    );
    return locs.slice(0, MAX_URLS);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Relevance ranking
// ---------------------------------------------------------------------------

// Path tokens that signal "this page probably describes what the company
// actually does/sells." Higher score = more relevant.
const POSITIVE_TOKENS: Array<{ re: RegExp; score: number }> = [
  { re: /\/products?(\/|$)/i, score: 8 },
  { re: /\/services?(\/|$)/i, score: 8 },
  { re: /\/capabilit/i, score: 9 },
  { re: /\/what[-_]?we[-_]?do/i, score: 8 },
  { re: /\/solutions?(\/|$)/i, score: 7 },
  { re: /\/industries?(\/|$)/i, score: 5 },
  { re: /\/markets?(\/|$)/i, score: 5 },
  { re: /\/expertise/i, score: 6 },
  { re: /\/about(\/|$)/i, score: 4 },
  { re: /\/company(\/|$)/i, score: 3 },
  { re: /\/manufacturing/i, score: 6 },
  { re: /\/equipment/i, score: 5 },
];

const NEGATIVE_TOKENS: Array<{ re: RegExp; score: number }> = [
  { re: /\/blog(\/|$)/i, score: -6 },
  { re: /\/news(\/|$)/i, score: -5 },
  { re: /\/press(\/|$)/i, score: -5 },
  { re: /\/careers?(\/|$)/i, score: -6 },
  { re: /\/jobs?(\/|$)/i, score: -6 },
  { re: /\/contact(\/|$)/i, score: -4 },
  { re: /\/privacy/i, score: -8 },
  { re: /\/terms/i, score: -8 },
  { re: /\/legal/i, score: -6 },
  { re: /\/sitemap/i, score: -8 },
  { re: /\/login/i, score: -8 },
  { re: /\/cart/i, score: -8 },
  { re: /\/account/i, score: -6 },
  { re: /\.(jpg|jpeg|png|gif|pdf|zip)(\?|$)/i, score: -10 },
];

function rankAndPickRelevant(
  urls: string[],
  primary: string,
  n: number,
): string[] {
  const primaryNormalized = stripTrailingSlash(primary);

  const scored = urls
    .map((u) => ({ url: u, score: scoreUrl(u) }))
    .filter((x) => x.score > 0)
    .filter((x) => stripTrailingSlash(x.url) !== primaryNormalized)
    // Dedupe by normalized URL
    .filter(
      (x, i, arr) =>
        arr.findIndex(
          (y) => stripTrailingSlash(y.url) === stripTrailingSlash(x.url),
        ) === i,
    );

  // Shallower paths tend to be category overview pages (better than deep leaves).
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return depth(a.url) - depth(b.url);
  });

  return scored.slice(0, n).map((x) => x.url);
}

function scoreUrl(url: string): number {
  let score = 0;
  for (const { re, score: s } of POSITIVE_TOKENS) if (re.test(url)) score += s;
  for (const { re, score: s } of NEGATIVE_TOKENS) if (re.test(url)) score += s;
  return score;
}

function depth(url: string): number {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, "");
    return p.split("/").filter(Boolean).length;
  } catch {
    return 99;
  }
}

function stripTrailingSlash(u: string): string {
  return u.replace(/\/+$/, "");
}
