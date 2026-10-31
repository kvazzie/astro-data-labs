import { getCollection } from "astro:content";
import { outDir } from "astro:config/server";
import { fileURLToPath } from "node:url";
import { canonical, digest } from "../../../src/records";
import { validateRecords } from "../../../src/contract";
import { writeDatabase } from "../../../src/database";

/**
 * Return comparable records from Astro's supported collection API. For the local
 * route, also export SQLite into the configured build directory before returning
 * the response. An unset LAB_ROUTE follows the loader's local default.
 */
export async function GET() {
  const route = process.env.LAB_ROUTE ?? "local";
  const records = validateRecords({
    authors: (await getCollection("authors")).map((entry) => entry.data),
    posts: (await getCollection("posts")).map((entry) => entry.data),
  });
  // Build-time endpoint obtains only the supported collection API's output.
  // No .astro data-store paths are read by the exporter or consumer.
  if (route === "local") {
    await writeDatabase(fileURLToPath(new URL("content.sqlite", outDir)), records);
  }
  return new Response(JSON.stringify({ route, digest: digest(records), records: JSON.parse(canonical(records)) }));
}
