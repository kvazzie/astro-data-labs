import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readDatabase, writeDatabase } from "../src/database.js";
import { differences, digest, readLocal, writeLocal } from "../src/records.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = join(root, "fixtures/local");
const source = join(root, ".lab/source.sqlite");

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing ${name}`);
  return resolve(value);
}

async function build(route: string, input: string, output: string) {
  if (route !== "local" && route !== "database") throw new Error(`Unknown input route: ${route}`);
  // Read first so unavailable/invalid inputs never look like a successful build.
  if (route === "local") await readLocal(input);
  else await readDatabase(input);
  const result = spawnSync("pnpm", ["exec", "astro", "build", "--root", "producer"], {
    cwd: root,
    env: { ...process.env, LAB_ROUTE: route, LAB_INPUT: input, LAB_OUTPUT: output, ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Astro ${route} build failed`);
  return JSON.parse(await readFile(join(output, "records.json"), "utf8"));
}

async function roundtrip(database: string, output: string) {
  const original = await readDatabase(database);
  const files = join(output, "files");
  const returnedDb = join(output, "returned.sqlite");
  const returnedFiles = join(output, "returned-files");
  await writeLocal(files, original);
  await writeDatabase(returnedDb, await readLocal(files));
  const returned = await readDatabase(returnedDb);
  await writeLocal(returnedFiles, returned);
  const report = {
    sequence: "database -> JSON files -> database -> JSON files",
    counts: { authors: original.authors.length, posts: original.posts.length },
    databaseDifferences: differences(original, returned),
    fileDifferences: differences(await readLocal(files), await readLocal(returnedFiles)),
    conversions: ["SQLite INTEGER milliseconds <-> Date <-> UTC ISO milliseconds", "SQLite INTEGER 0/1 <-> boolean", "SQLite TEXT <-> structured JSON", "allocated IDs copied explicitly"],
    loss: ["SQL constraints and allocation sequence are not represented by JSON files", "JSON whitespace and key order are normalized"],
  };
  await mkdir(output, { recursive: true });
  await writeFile(join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.databaseDifferences.length || report.fileDifferences.length) throw new Error("Round-trip record differences found");
}

async function buildBoth() {
  await writeDatabase(source, await readLocal(fixture), true);
  const local = await build("local", fixture, join(root, "dist/local"));
  const database = await build("database", source, join(root, "dist/database"));
  const changes = differences(local.records, database.records);
  console.log(JSON.stringify({ routeDifferences: changes, digest: local.digest }, null, 2));
  if (changes.length) throw new Error("Input routes disagree");
}

const [command = "demo", ...args] = process.argv.slice(2);
switch (command) {
  case "seed":
    await writeDatabase(args[0] ? resolve(args[0]) : source, await readLocal(fixture), true);
    break;
  case "build":
    if (!args.length) await buildBoth();
    else await build(args[0], required(args[1], "input"), required(args[2], "output directory"));
    break;
  case "db-to-files":
    await writeLocal(required(args[1], "output directory"), await readDatabase(required(args[0], "database")));
    break;
  case "files-to-db":
    await writeDatabase(required(args[1], "database"), await readLocal(required(args[0], "input directory")));
    break;
  case "fingerprint":
    console.log(digest(await readLocal(required(args[0], "input directory"))));
    break;
  case "roundtrip":
    await roundtrip(required(args[0], "database"), required(args[1], "output directory"));
    break;
  case "demo": {
    console.log("Reversible content | Exploring | derived SQLite export");
    await buildBoth();
    await roundtrip(source, join(root, ".lab/roundtrip"));
    const result = spawnSync(process.execPath, ["query.mjs", join(root, "dist/local/content.sqlite"), digest(await readLocal(fixture))], { cwd: join(root, "consumer"), stdio: "inherit" });
    if (result.error || result.status !== 0) throw new Error("Sibling consumer failed");
    console.log("Run pnpm check for invalid inputs, source changes, and stale-export detection.");
    break;
  }
  default:
    throw new Error(`Unknown command ${command}. Use demo, build, seed, db-to-files, files-to-db, fingerprint, or roundtrip.`);
}
