# Reversible content

Status: **Exploring**. Implements [Experiment request #18](https://github.com/kvazzie/astro-data-labs/issues/18).

Can an Astro project switch between database-backed Content Collections and local content files, using one Drizzle-derived contract, while exporting a portable SQLite file for a sibling project?

This Experiment runs both routes, converts the actual records between representations, and compares every field. The SQLite export is derived data. Neither input is prescribed as a permanent source of truth.

## Run it

Use Node.js 22.12 or newer and pnpm 10.29.3. From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm experiment reversible-content
```

The terminal demonstration builds both routes, reports route differences and a round trip, and runs the sibling SQL consumer. It exits after printing the results. There is no web server. Expected counts are two authors and three posts, with zero record differences. Author joins return Ada, null, and Lin.

The generic Lab commands discover this Experiment without special cases:

```sh
pnpm build
pnpm check
pnpm build:index
```

For commands below, change into `experiments/reversible-content/`:

```sh
pnpm build       # seed the database fixture and build both routes
pnpm typecheck   # TypeScript and Astro diagnostics
pnpm check      # typecheck, build both routes, and run unattended behavior checks
```

## Project boundaries and files

`producer/` is the Astro project. `consumer/` is its sibling, a private workspace project with its own driver dependency and SQL command. All Experiment code, dependencies, fixtures, and outputs remain under this directory. The parent package orchestrates the demonstration. When copying this Experiment out of the Lab, install the parent and consumer dependencies or retain both workspace entries.

| Path | Meaning |
| --- | --- |
| `src/contract.ts` | Drizzle SQLite tables and their official Zod-derived select schemas |
| `fixtures/local/{authors,posts}.json` | Tracked, reviewable JSON arrays with explicit IDs |
| `.lab/source.sqlite` | Seeded database input with IDs allocated by SQLite |
| `producer/src/content.config.ts` | Selectable database/file loader, validation, and collection storage |
| `producer/src/pages/records.json.ts` | Supported `getCollection()` reads and build-time export |
| `dist/local/records.json` | Validated local-route records and digest |
| `dist/database/records.json` | Comparable database-route records and digest |
| `dist/local/content.sqlite` | Exported SQLite artifact for the sibling |
| `.lab/roundtrip/` | Converted files, returned database, returned files, and comparison report |
| `consumer/query.mjs` | SQL consumer, with no Astro imports or generated-store dependency |

Generated files are ignored. `build` and `demo` reset `.lab/source.sqlite` from the tracked fixture. Use explicit inputs and outputs below when investigating edits to a database.

## Two routes and the conversion boundary

Both loaders read a snapshot, validate row shapes and references, clear their collections, then pass every row through Astro's supported `parseData()` before `store.set()`. The collection ID is the decimal string of the numeric SQL ID. The numeric ID also remains in the record data. The local loader reads JSON files directly, including explicit nulls and numeric IDs, without filename-derived IDs or frontmatter conversions.

Both routes render `records.json` through `getCollection()`. During the local build that endpoint also writes the validated collection records to SQLite. Export does not read `.astro/data-store.json` or any other internal content-store representation. This is a build-time pipeline, with no live synchronization or file watcher.

A direct `pnpm exec astro build --root producer` defaults to the tracked local fixture and writes both `records.json` and `content.sqlite` under `dist/local/`. The exporter uses Astro's configured output directory, including explicit output overrides. The local `pnpm check` command builds its own baseline artifacts, so it also works on a clean checkout.

Run either route on a chosen input, or perform the conversions explicitly:

```sh
pnpm lab seed .lab/my-source.sqlite
pnpm lab build database .lab/my-source.sqlite dist/chosen-database
pnpm lab db-to-files .lab/my-source.sqlite .lab/converted-files
pnpm lab build local .lab/converted-files dist/chosen-local
pnpm lab files-to-db .lab/converted-files .lab/returned.sqlite
pnpm lab build database .lab/returned.sqlite dist/returned-database
pnpm lab roundtrip .lab/my-source.sqlite .lab/my-roundtrip
```

`roundtrip` reads the specified database, writes JSON, reads those files into a new database, and writes that database back to another directory of files. It compares original and returned records by collection and ID, including every field and author reference. Missing, added, or changed rows appear with their before/after values in `report.json`; differences cause a nonzero exit. No stage substitutes an independently seeded fixture. Unattended checks repeat the switch with changed titles and ID gaps, then build Astro from the converted files and returned database.

## Fixture and normalization

SQLite is the input and export dialect. The fixture has authors 1 and 2, and posts 1 through 3. Post 1 references Ada, post 2 has no author, and post 3 references Lin.

| Case | Representation and observed conversion |
| --- | --- |
| Generated IDs | Seeding omits IDs and verifies SQLite allocated the expected IDs. Conversion copies allocated IDs explicitly. File IDs are never regenerated. |
| Nulls | SQL NULL becomes JSON null. Null summary, null author, null publication date, and null rating survive. Empty summary stays distinct from null. Missing required fields fail. |
| Dates | Drizzle `timestamp_ms` maps SQL INTEGER to Date. Files require UTC ISO strings with exactly three fractional digits. The schema converts strings to Date. `2026-08-01T10:30:00.123Z` survives as `1785580200123` in SQLite. |
| Booleans | SQL INTEGER 0/1 maps to false/true; files carry JSON booleans. |
| Nested data | Drizzle JSON-mode TEXT maps to `{ tags: string[], rating: number or null }`. Array order, empty arrays, fractional ratings, and zero survive. |
| References | `authorId` is a nullable numeric foreign key. A separate cross-record check rejects missing authors and duplicate IDs. Row Zod schemas alone do not enforce relationships. |

The Drizzle tables use SQL names such as `author_id`; content uses Drizzle's `authorId` property. The exporter uses the same mapping. `src/database.ts` contains explicit SQLite DDL for this narrow fixture. It is not a migration generator. The export has `authors`, `posts`, and one `export_meta` row with `contract` and `source_digest`.

## Compatibility evidence

The lockfile and manifests pin these exact versions, exercised by building both routes and running checks:

| Dependency | Version |
| --- | --- |
| Astro | 6.4.8 |
| Drizzle ORM | 0.45.4 |
| Official `drizzle-zod` integration | 0.8.3 |
| Zod | 4.6.7 |
| SQLite driver `@libsql/client` | 0.18.0 |
| Native driver `libsql` | 0.5.29 |

Astro 6 accepts Zod 4 collection schemas. This Experiment imports Zod from `zod` so the standalone CLI can share the same contract. For Drizzle 0.45.4, the official integration is `drizzle-zod`. The newer `drizzle-orm/zod` path starts in the Drizzle 1 beta line and is not an export of this stable version.

`createSelectSchema()` supplies the record contract. Explicit overrides add positive safe-integer IDs, nonempty names/titles, a strict nested metadata object, and the Date/ISO adapter. Unknown fields are rejected to expose unsupported conversion rather than silently drop data. Date strings are deliberately narrow; arbitrary date coercion is not enabled. The build externalizes the database and validation libraries for Node execution.

Documentation used: [Astro loader validation](https://docs.astro.build/en/reference/content-loader-reference/#parsedata), [supported Content Collections queries](https://docs.astro.build/en/guides/content-collections/), and [official Drizzle Zod integration](https://orm.drizzle.team/docs/zod).

## Sibling consumption and stale exports

From this Experiment directory:

```sh
pnpm --dir consumer query ../dist/local/content.sqlite
```

The sibling executes this query against the portable file:

```sql
SELECT p.id, p.title, a.name AS author,
       p.published_at, p.summary, p.featured, p.metadata
FROM posts AS p
LEFT JOIN authors AS a ON a.id = p.author_id
ORDER BY p.id;
```

The stored digest is SHA-256 of the contract version and canonical validated records. Canonicalization sorts IDs and fixes object key order; formatting-only JSON changes do not count as data changes. Give the consumer an independently computed current source digest to detect an old artifact:

```sh
pnpm lab db-to-files .lab/source.sqlite .lab/edited
node --input-type=module -e 'import fs from "node:fs"; const p=".lab/edited/posts.json"; const rows=JSON.parse(fs.readFileSync(p)); rows[0].title="Edited after export"; fs.writeFileSync(p,JSON.stringify(rows,null,2));'
expected=$(pnpm --silent lab fingerprint .lab/edited)
pnpm --dir consumer query ../dist/local/content.sqlite "$expected"
# Fails with "Stale export: source digest differs".
pnpm lab build local .lab/edited dist/edited
pnpm --dir consumer query ../dist/edited/content.sqlite "$expected"
# Reports freshness "current" and the edited title.
```

Without an expected digest, freshness is **unknown**. An isolated file cannot tell whether its upstream source changed. This is a source-content comparison, not a timestamp, tamper check, or synchronization protocol. Contract changes require updating `contractVersion`; the hash does not automatically track code or dependency changes. Consumers must honor build failures, recompute the expected digest, and reopen the exported file after rebuilds. Exports are replaced after the SQLite connection closes.

## Measured observations and limits

The initial run produced two authors, three posts, and zero route or round-trip record differences. The baseline digest is `02dda84401dfc4b81fa7331d2126c21bd3e0b4f444c4dc4dd7fa1dd0c9a74db4`. Both routes rejected an empty title. Local inputs also rejected a malformed date, wrong nested tag type, missing author, and duplicate ID. Source edits changed the digest and the sibling's SQL result after rebuilding. A copied old artifact failed the updated digest check.

The schema adapters are one-time manual work for this fixture. No record-by-record repair was needed. JSON formatting and key order normalize. SQL constraints, indexes, allocation history, triggers, and transaction semantics are not carried in the files. Reimport reconstructs only the declared fixture DDL; it cannot preserve a database's next allocated ID after deleted rows. This is record-level reversibility, not a database backup.

The fixture omits Markdown bodies, binary values, arbitrary JSON shapes, BigInt, timezone offsets, sub-millisecond dates, database defaults beyond IDs, composite keys, cycles, and many-to-many relations. Conversion covers only the declared fields in the two tables; extra database columns and tables are outside the comparison. Raw SQL can bypass the Zod contract; driver coercion may normalize unsupported SQL representations before validation. There is no concurrent-writer snapshot guarantee. Builds require the input database to be available. The driver uses native platform binaries, so other operating systems need their own verification. No production CMS, universal migration framework, live two-way synchronization, or source-of-truth conclusion follows from these five records.

`scripts/check.mjs` follows the Lab's Node assert/check-script pattern. It tests public CLI/build and consumer behavior in a temporary directory, using changed records and IDs to catch accidental fixture reseeding. It removes the temporary data afterward and leaves tracked fixtures unchanged.
