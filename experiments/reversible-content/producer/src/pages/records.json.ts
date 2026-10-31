import { getCollection } from "astro:content";
import { join } from "node:path";
import { canonical, digest } from "../../../src/records";
import { validateRecords } from "../../../src/contract";
import { writeDatabase } from "../../../src/database";

export async function GET() {
  const records = validateRecords({
    authors: (await getCollection("authors")).map((entry) => entry.data),
    posts: (await getCollection("posts")).map((entry) => entry.data),
  });
  // Build-time endpoint obtains only the supported collection API's output.
  // No .astro data-store paths are read by the exporter or consumer.
  if (process.env.LAB_ROUTE === "local") {
    const output = process.env.LAB_OUTPUT;
    if (!output) throw new Error("LAB_OUTPUT is required for export");
    await writeDatabase(join(output, "content.sqlite"), records);
  }
  return new Response(JSON.stringify({ route: process.env.LAB_ROUTE, digest: digest(records), records: JSON.parse(canonical(records)) }));
}
