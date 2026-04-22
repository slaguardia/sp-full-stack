import { extractProfile } from "../lib/extract";
import { computeHints } from "../lib/hints";
import { narrowGroups, matchCodes } from "../lib/classifier";

async function main() {
  const corpus = `Company: Lone Star Downhole Products
Website: https://www.lsdp-mfg.com
Lone Star Downhole Products (LSDP) is a precision CNC machine shop with in-house rubber molding, welding, and fabrication. We operate multi-axis CNC mills and lathes. Certifications: ISO 9001-2008, CAGE 8JPP2. DUNS 080639866. NAICS codes: 332710, 332721, 332722, 332510.`;

  console.log("\n=== Stage 1: extract ===");
  const profile = await extractProfile(corpus);
  console.log(JSON.stringify(profile, null, 2));

  console.log("\n=== Stage 2: hint ===");
  const hints = computeHints(profile);
  console.log("NAICS groups:", hints.naicsGroups);
  console.log("Top groups:", hints.topGroups.slice(0, 8));
  console.log(
    "Top codes (keyword):",
    hints.topCodes.slice(0, 8).map((c) => `${c.code} — ${c.description}`),
  );

  console.log("\n=== Stage 3: narrow ===");
  const groups = await narrowGroups(profile, hints);
  console.log("Narrowed groups:", groups);

  console.log("\n=== Stage 4: match ===");
  const codes = await matchCodes(profile, groups, hints);
  for (const c of codes) {
    console.log(
      `  ${c.code} [${c.confidence}] — ${c.description} :: ${c.reasoning}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
