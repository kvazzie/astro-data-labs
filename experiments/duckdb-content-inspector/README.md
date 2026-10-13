# DuckDB content inspector

Status: **Exploring**.

This Experiment project turns Astro content collection data into one DuckDB table for local SQL inspection. It reads an Astro-style `devalue` store or a normalized JSON row array. DuckDB-Wasm runs in a Web Worker inside the browser, and selected files never leave the tab.

## Run it

From this directory:

```sh
pnpm dev
```

From the repository root:

```sh
pnpm experiment duckdb-content-inspector
pnpm --filter @astro-data-labs/duckdb-content-inspector dev
```

Either command starts the local Vite development server. The first is the Lab Experiment dispatcher. The second is native pnpm filtering.

Open <http://127.0.0.1:5173/>. Use the bundled sample or select a local `.astro/data-store.json` file.

Select **Load Astro sample**, then **Start DuckDB**, then **Run SQL**. The Collections query shows `authors = 2`, `blog = 3`, and `docs = 2`. All seven ordinary entries have source paths. The sample's `meta:blog` collection is excluded.

The query toolbar also provides All titles, Field coverage, and Blog references. The References walkthrough exposes the sample's missing author, while Field coverage shows optional fields that only some blog entries contain. Wrong order demonstrates the visible query-before-source error and recovery. Each of the four walkthroughs has three steps.

## Local input

**Select local store** accepts an Astro `devalue` store whose root and collections are Maps. It also accepts normalized JSON rows:

```json
[
  {
    "collection": "notes",
    "id": "hello",
    "file_path": "src/content/notes/hello.md",
    "data": { "title": "Local note" },
    "body": "Example content"
  }
]
```

Normalized rows can use `filePath` instead of `file_path`, and a JSON object encoded in `data_json` instead of `data`. Source paths, body, and digest are retained when present. Both input formats exclude collections whose names start with `meta:` and project ordinary entries into `astro_content`. The derived `astro_content_fields` table supports the sample queries without fetching a DuckDB JSON extension.

Unsupported input and stores without ordinary entries show an English error. A query before source loading asks you to load a content store. SQL errors also appear in the interface, and a subsequent valid query can run.

The Experiment reads selected files and keeps its SQL projection in tab memory. It never uploads or writes back to the content store. SQL runs against that disposable projection, and closing the tab discards it.

## Build and check

```sh
pnpm build
pnpm check
```

The build writes a static deliverable to `dist/` with local JavaScript, Worker, and WASM assets. The unattended check serves that directory and drives the visible Chromium workflow. It verifies the English interface, four walkthrough tabs with three visible step buttons, the bundled counts and queries, both local input formats, meta exclusion, retained source paths, unsupported input, query-before-source and SQL errors, and recovery. It fails on remote runtime requests, failed requests, or uncaught page errors.

## Compatibility boundary

Astro supports content access through the `astro:content` module. This Experiment instead reads `.astro/data-store.json`, an internal generated artifact. Astro can change that representation, and experimental chunked collection storage does not use one shared JSON file.
