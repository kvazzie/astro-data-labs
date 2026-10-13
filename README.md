# Astro content under a SQL microscope

![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/kvazzie/astro-duckdb-inspector?utm_source=oss&utm_medium=github&utm_campaign=kvazzie%2Fastro-duckdb-inspector&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

An executable browser prototype that turns Astro content collection data into one DuckDB table for local SQL inspection.

The experiment tests one narrow question: is Astro's generated content store a useful seam for inspecting collections, spotting schema drift, and checking relationships between entries before a project needs a separate database?

## Development

Git and [devenv](https://devenv.sh/) must be installed on the host system.

Enter the development shell with:

```sh
devenv shell
```

Entering the shell restores the agent skills listed in `skills-lock.json`.

## What it demonstrates

- Parses an Astro-style `devalue` store or a normalized JSON row array.
- Flattens ordinary collections into one `astro_content` table.
- Runs DuckDB-Wasm in a Web Worker, entirely inside the browser tab.
- Includes queries for collection counts, field coverage, titles, and cross-collection references.
- Keeps uploaded content local. The prototype has no application server and does not send file contents elsewhere.

The interface, walkthroughs, errors, sample records, and documentation use English.

## Experiment contract

Every Experiment project under `experiments/` implements `dev`, `build`, and `check`. Root commands discover those projects without experiment-specific shortcuts.

```sh
pnpm install
pnpm experiment duckdb-content-inspector
pnpm build
pnpm check
```

`pnpm experiment <name>` starts that project's `dev` command. Unknown names fail with the available Experiment list. `pnpm build` and `pnpm check` walk every Experiment project. Root `check` fails when a project omits `dev`, `build`, or `check`, or when either `build` or `check` fails.

Native pnpm filtering still works when you want a single package without the dispatcher:

```sh
pnpm --filter @astro-data-labs/duckdb-content-inspector dev
pnpm --filter @astro-data-labs/duckdb-content-inspector build
pnpm --filter @astro-data-labs/duckdb-content-inspector check
```

## Run the DuckDB experiment

```sh
pnpm install
pnpm experiment duckdb-content-inspector
```

Open <http://127.0.0.1:5173/>. Do not open the HTML file directly because Vite supplies the JavaScript modules, Web Worker, and WASM asset.

You can use the bundled sample or select a local `.astro/data-store.json` file. The database and imported data disappear when the tab closes.

## Data model

Every non-meta entry becomes one row:

| Column | Purpose |
| --- | --- |
| `collection` | Astro collection name |
| `id` | Entry identifier |
| `file_path` | Source path when Astro provides one |
| `data_json` | Entry data encoded as JSON |
| `body` | Body content when present |
| `digest` | Astro digest when present |

Keeping collection-specific fields in `data_json` makes unlike collections queryable together without inventing a universal schema. The Experiment also derives an `astro_content_fields` table for its field-coverage, title, and relationship queries. This keeps the built workflow offline because current DuckDB-Wasm releases fetch JSON support as a runtime extension.

## Current technical boundary

Astro's supported application API is the `astro:content` module, including `getCollection()` and `getEntry()`. This prototype instead reads `.astro/data-store.json`, an internal generated artifact. That is intentional research, not a compatibility promise.

The seam can break when Astro changes its storage representation. Astro also supports experimental chunked collection storage, which replaces the assumption that all content lives in one JSON file. A production tool should prefer a supported Astro integration or an explicit export step unless the experiment proves that direct store access is worth maintaining.

Relevant upstream documentation:

- [Astro content collections](https://docs.astro.build/en/guides/content-collections/)
- [Astro content module reference](https://docs.astro.build/en/reference/modules/astro-content/)
- [DuckDB-Wasm](https://github.com/duckdb/duckdb-wasm)

## Prototype status

Status: **Exploring**.

The useful unit is the adapter and state reducer inside `experiments/duckdb-content-inspector/index.html`. The current single-file form keeps the experiment easy to run and discard. It is not a production inspector, CMS, editor, or stable Astro integration.

The prototype currently uses:

- `@duckdb/duckdb-wasm` `1.33.1-dev57.0`
- `devalue` `5.3.2`
- Vite `8.0.10`

The Experiment project has a static build and an unattended Chromium check. The check verifies the seven bundled entries, all four sample queries, local Astro and normalized row input, source paths, visible errors, and recovery. It also rejects remote runtime requests. The interface has four interactive walkthroughs: Overview, Field coverage, Wrong order, and References.

## Repository guide

- `experiments/duckdb-content-inspector/` contains the complete executable Experiment project.
- `scripts/experiment.mjs` is the neutral Experiment dispatcher. `scripts/build-experiments.mjs` and `scripts/check-experiments.mjs` enforce the root contract.
- `.github/workflows/experiment-contract.yml` runs the same root `pnpm build` and `pnpm check` commands contributors use locally.
- `CONTEXT.md` defines the project's domain vocabulary and scope.
- `docs/agents/` records issue-tracker, triage, and domain-document conventions for coding agents.
- `skills-lock.json` records the project-local agent skills restored by `devenv shell`.

## Contributing

Open a GitHub issue before proposing a substantial change. Describe the Astro data problem, the observable experiment that would test it, and what result would count as useful evidence.

This repository does not yet contain a license file. Public visibility permits inspection and discussion but does not grant reuse rights until the maintainer chooses a license.
