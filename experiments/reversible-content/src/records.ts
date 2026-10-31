import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateRecords, type Records } from "./contract.js";

/**
 * Read authors.json and posts.json as arrays, then validate row shapes, IDs, and
 * references. Missing files, malformed JSON, and invalid records reject the read.
 */
export async function readLocal(directory: string): Promise<Records> {
  const read = async (name: string) => JSON.parse(await readFile(join(directory, `${name}.json`), "utf8"));
  return validateRecords({ authors: await read("authors"), posts: await read("posts") });
}

/**
 * Serialize validated records with fixed field order and sorted IDs so SQL row
 * order and JSON key order do not affect comparisons. Dates become UTC ISO strings
 * with millisecond precision; nested array order remains significant.
 */
export function canonical(records: Records): string {
  return JSON.stringify({
    authors: [...records.authors].sort((a, b) => a.id - b.id).map((a) => ({ id: a.id, name: a.name, bio: a.bio })),
    posts: [...records.posts].sort((a, b) => a.id - b.id).map((p) => ({
      id: p.id, title: p.title, authorId: p.authorId, publishedAt: p.publishedAt,
      summary: p.summary, featured: p.featured,
      metadata: { tags: p.metadata.tags, rating: p.metadata.rating },
    })),
  });
}

export const contractVersion = "reversible-content-v1";

/**
 * Hash the contract version and canonical records for source-content comparison.
 * Formatting changes do not affect the digest; schema changes require a version bump.
 */
export function digest(records: Records): string {
  return createHash("sha256").update(`${contractVersion}\n${canonical(records)}`).digest("hex");
}

/**
 * Write validated records to authors.json and posts.json, creating the directory
 * if needed and replacing those files with canonical IDs, fields, and date strings.
 */
export async function writeLocal(directory: string, records: Records) {
  await mkdir(directory, { recursive: true });
  const data = JSON.parse(canonical(records));
  for (const name of ["authors", "posts"] as const) {
    await writeFile(join(directory, `${name}.json`), `${JSON.stringify(data[name], null, 2)}\n`);
  }
}

/**
 * Compare canonical records by collection and numeric ID. Return whole before/after
 * records for each change, using null for a missing side of an added or removed row.
 */
export function differences(before: Records, after: Records) {
  const left = JSON.parse(canonical(before));
  const right = JSON.parse(canonical(after));
  const changes: { collection: string; id: number; before: unknown; after: unknown }[] = [];
  for (const name of ["authors", "posts"] as const) {
    const ids = new Set<number>([...left[name], ...right[name]].map((row) => row.id));
    for (const id of ids) {
      const a = left[name].find((row: { id: number }) => row.id === id) ?? null;
      const b = right[name].find((row: { id: number }) => row.id === id) ?? null;
      if (JSON.stringify(a) !== JSON.stringify(b)) changes.push({ collection: name, id, before: a, after: b });
    }
  }
  return changes;
}
