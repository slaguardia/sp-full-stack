import { scrapeWebsite } from "@/lib/scraper";

async function main() {
  const url = process.argv[2] || "lsdp-mfg.com";
  console.log(`\n--- scraping ${url} ---`);
  const t0 = Date.now();
  const result = await scrapeWebsite(url);
  const dt = Date.now() - t0;
  console.log(`primary url: ${result.url}`);
  console.log(`title: ${result.title}`);
  console.log(`text length: ${result.text.length} chars`);
  console.log(`pages scraped (${result.pages.length}):`);
  for (const p of result.pages) console.log(`  - ${p}`);
  console.log(`elapsed: ${dt}ms`);
  console.log(`\n--- text preview (first 500 chars) ---`);
  console.log(result.text.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
