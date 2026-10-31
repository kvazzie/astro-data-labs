import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = await mkdtemp(join(tmpdir(), "reversible-content-"));
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

function run(args, { fail, cwd = root, env = {} } = {}) {
  const result = spawnSync(args[0], args.slice(1), { cwd, encoding: "utf8", env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", ...env } });
  if (result.error) throw result.error;
  const output = result.stdout + result.stderr;
  if (fail) {
    assert.notEqual(result.status, 0, output);
    assert.match(output, fail);
  } else assert.equal(result.status, 0, output);
  return result.stdout;
}
const lab = (...args) => run(["pnpm", "exec", "tsx", "scripts/lab.ts", ...args]);
const rejected = (pattern, ...args) => run(["pnpm", "exec", "tsx", "scripts/lab.ts", ...args], { fail: pattern });
const consumer = (artifact, expected, fail) => run([process.execPath, "query.mjs", artifact, ...(expected ? [expected] : [])], { cwd: join(root, "consumer"), fail });

try {
  // A local check must also work before any build has been run.
  lab("build");
  // Bypass the orchestration CLI to exercise Astro's default route and outDir.
  run(["pnpm", "exec", "astro", "build", "--root", "producer"], {
    env: { LAB_ROUTE: undefined, LAB_INPUT: undefined, LAB_OUTPUT: undefined },
  });
  const expected = {
    authors: await json(join(root, "fixtures/local/authors.json")),
    posts: await json(join(root, "fixtures/local/posts.json")),
  };
  // Golden records come from the documented fixture, not from the conversion code.
  const local = await json(join(root, "dist/local/records.json"));
  const database = await json(join(root, "dist/database/records.json"));
  assert.equal(local.route, "local");
  assert.equal(database.route, "database");
  assert.deepEqual(local.records, expected);
  assert.deepEqual(database.records, expected);
  assert.equal(local.digest, database.digest);

  // Copy the artifact away from the producer. The sibling needs no Astro files.
  const oldArtifact = join(scratch, "old.sqlite");
  await cp(join(root, "dist/local/content.sqlite"), oldArtifact);
  const query = JSON.parse(consumer(oldArtifact, local.digest));
  assert.equal(query.freshness, "current");
  assert.deepEqual(query.rows.map((row) => [row.id, row.title, row.author]), [
    [1, "A portable record", "Ada"],
    [2, "A draft with no author", null],
    [3, "Following a reference", "Lin"],
  ]);
  assert.equal(query.rows[0].published_at, 1785580200123);
  assert.equal(query.rows[0].summary, null);
  assert.equal(query.rows[1].summary, "");
  assert.equal(query.rows[0].featured, 1);
  assert.equal(query.rows[1].featured, 0);
  assert.deepEqual(JSON.parse(query.rows[0].metadata), { tags: ["astro", "sqlite"], rating: 4.5 });
  assert.equal(JSON.parse(consumer(oldArtifact)).freshness, "unknown");

  const files = join(scratch, "files");
  await cp(join(root, "fixtures/local"), files, { recursive: true });
  const postsPath = join(files, "posts.json");
  for (const [change, message] of [
    [(rows) => { rows[0].title = ""; }, /title/],
    [(rows) => { rows[0].publishedAt = "yesterday"; }, /publishedAt/],
    [(rows) => { rows[0].metadata.tags = [42]; }, /tags/],
    [(rows) => { rows[0].authorId = 999; }, /missing author/],
    [(rows) => { rows[1].id = 1; }, /Duplicate ID/],
  ]) {
    const rows = structuredClone(expected.posts);
    change(rows);
    await writeFile(postsPath, JSON.stringify(rows));
    rejected(message, "build", "local", files, join(scratch, "invalid"));
  }
  await writeFile(postsPath, JSON.stringify(expected.posts));
  const source = join(scratch, "source.sqlite");
  lab("files-to-db", files, source);
  const client = createClient({ url: pathToFileURL(source).href });
  try { await client.execute("UPDATE posts SET title = '' WHERE id = 1"); }
  finally { client.close(); }
  rejected(/title/, "build", "database", source, join(scratch, "invalid-db"));
  console.log("Verified both routes, exact fixture values and SQL references, and invalid input rejection.");

  // Distinct values and non-contiguous IDs expose accidental fixture reseeding.
  const changed = structuredClone(expected);
  changed.authors[0].id = 11;
  changed.posts[0].id = 41;
  changed.posts[0].authorId = 11;
  changed.posts[0].title = "Changed source seen by sibling";
  await writeFile(join(files, "authors.json"), JSON.stringify(changed.authors));
  await writeFile(postsPath, JSON.stringify(changed.posts));
  lab("files-to-db", files, source);
  const trip = join(scratch, "roundtrip");
  lab("roundtrip", source, trip);
  const report = await json(join(trip, "report.json"));
  assert.deepEqual(report.databaseDifferences, []);
  assert.deepEqual(report.fileDifferences, []);
  const sorted = changed.posts.toSorted((a, b) => a.id - b.id);
  assert.deepEqual(await json(join(trip, "files/posts.json")), sorted);
  assert.deepEqual(await json(join(trip, "returned-files/posts.json")), sorted);
  assert.deepEqual(await json(join(trip, "returned-files/authors.json")), changed.authors.toSorted((a, b) => a.id - b.id));

  const expectedDigest = lab("fingerprint", files).trim();
  assert.notEqual(expectedDigest, local.digest);
  consumer(oldArtifact, expectedDigest, /Stale export/);
  const localOutput = join(scratch, "rebuilt-local");
  lab("build", "local", files, localOutput);
  const refreshed = JSON.parse(consumer(join(localOutput, "content.sqlite"), expectedDigest));
  assert.equal(refreshed.freshness, "current");
  assert.equal(refreshed.rows.find((row) => row.id === 41).title, "Changed source seen by sibling");
  assert.equal(refreshed.rows.find((row) => row.id === 41).author, "Ada");
  const dbOutput = join(scratch, "rebuilt-database");
  lab("build", "database", join(trip, "returned.sqlite"), dbOutput);
  const convertedLocalOutput = join(scratch, "converted-local");
  lab("build", "local", join(trip, "files"), convertedLocalOutput);
  assert.deepEqual((await json(join(localOutput, "records.json"))).records, (await json(join(dbOutput, "records.json"))).records);
  assert.deepEqual((await json(join(localOutput, "records.json"))).records, (await json(join(convertedLocalOutput, "records.json"))).records);
  console.log("Verified actual round trip with changed values and ID gaps, stale export rejection, source rebuild, and sibling-visible changes.");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
