// @ts-expect-error — pdf-parse has no types for the default import in some setups
import pdfParse from "pdf-parse/lib/pdf-parse.js";

// Capability statements are usually 1-2 pages, but some companies send
// 20-page briefs with detailed specs. 80K chars handles either.
// Haiku's 200K-token context has ample headroom.
const PDF_TEXT_CAP = 80_000;

export async function parsePdfBuffer(buf: Buffer): Promise<string> {
  const result = await pdfParse(buf);
  return (result?.text ?? "").replace(/\s+/g, " ").trim().slice(0, PDF_TEXT_CAP);
}
