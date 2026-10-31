import { createClient } from "@libsql/client";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [artifact, expectedDigest] = process.argv.slice(2);
if (!artifact) throw new Error("Usage: node query.mjs <content.sqlite> [expected-source-digest]");
await access(artifact);
const client = createClient({ url: pathToFileURL(resolve(artifact)).href });
try {
  const { rows: [meta] } = await client.execute("SELECT contract, source_digest FROM export_meta");
  if (meta?.contract !== "reversible-content-v1") throw new Error("Unsupported export contract");
  if (expectedDigest && meta.source_digest !== expectedDigest) throw new Error("Stale export: source digest differs");
  const { rows } = await client.execute(`
    SELECT p.id, p.title, a.name AS author, p.published_at, p.summary, p.featured, p.metadata
    FROM posts AS p LEFT JOIN authors AS a ON a.id = p.author_id ORDER BY p.id
  `);
  console.log(JSON.stringify({ freshness: expectedDigest ? "current" : "unknown", digest: meta.source_digest, rows }, null, 2));
} finally {
  client.close();
}
