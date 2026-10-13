# Astro Data Labs

Astro Data Labs is an open, community-driven Experiment index for Astro data pipelines, architecture, and infrastructure. The Lab brings independent, executable experiments into one monorepository so readers can compare approaches, inspect their trade-offs, and take an individual experiment as a starting point for their own work.

An Experiment investigates one concrete Astro data problem or opportunity. It includes code you can run, a sample or demonstration with an observable result, and an explanation of what the result shows and where the approach stops working. The Lab does not prescribe a universal architecture or promise production support or compatibility.

## Browse the Experiment index

Start with an experiment's question and status. Follow its documentation to run the sample, compare the observed result with the stated goal, and read its limitations before adapting the approach to your project. An experiment may demonstrate an application, package, pipeline, architecture, or infrastructure idea. It does not have to deploy online to belong in the index.

| Experiment | Question | Status | Documentation and runnable project |
| --- | --- | --- | --- |
| DuckDB content inspector | Can Astro's generated content store provide SQL visibility for inspecting collections, schema drift, and references during a Content-first launch? | Exploring | [Run the experiment](experiments/duckdb-content-inspector/) |

Experiment parity means that navigation, commands, and documentation treat experiments as peers. The first experiment does not define the Lab's scope, and the index does not rank experiments as preferred solutions. Each experiment must explain its own purpose and evidence.

Every experiment has one of four statuses:

| Status | How to interpret it |
| --- | --- |
| Exploring | The question and implementation are still actively changing. |
| Concluded | Observations are documented, with no currently planned investigation. |
| Graduated | The experiment has produced or inspired a standalone open-source project and retains its place in the Lab. |
| Archived | The experiment remains available for historical context and is no longer expected to run or receive development. |

A status describes the investigation's state. It is not a production-readiness or compatibility rating.

## Forkability and project boundaries

Forkability applies to individual Experiment projects. Each project keeps its dependencies, fixtures, runtime, and experiment-specific support code together under `experiments/<name>/`, so you can understand and adapt it as a starting point for an independent project or library. Read its local documentation and limitations when taking it out of the Lab.

The Lab distinguishes three kinds of code:

| Kind | Purpose and home |
| --- | --- |
| Experiment project | A self-contained, executable proof-of-concept under `experiments/`. Its workspace package is private. It must demonstrate an observable result, even when it explores a package design. |
| Shared package | Code used by multiple Lab projects whose useful scope is intentionally limited to the Lab. These private workspace packages belong under `packages/` when needed. |
| Public package | Generally reusable code extracted into its own open-source repository and published for use beyond the Lab. It has its own scope and maintenance decisions. |

Shared packages are not a staging area for public npm releases. When code becomes useful beyond the Lab, it belongs in a separate Public package rather than turning the monorepository into a package incubator.

Graduation preserves the research artifact and its provenance. A Graduated experiment stays in the Lab with its history, observations, and a link to the resulting Public package or standalone tool. The resulting project should link back to the experiment so readers can trace its origin. Graduation permits continued Lab work, including alternative approaches and new questions; it does not freeze or remove the experiment.

## Author thesis

The original author, Artemii Rachev, is exploring the position that web projects benefit from a monorepository with Astro as their web foundation. This Author thesis is an evolving position, not repository policy. The experiments provide evidence with which to examine it. Contributors and readers can disagree with it, and each team retains its own architecture decisions.

## Development and the Experiment contract

Use Git and [devenv](https://devenv.sh/) to enter the repository's configured development shell:

```sh
devenv shell
pnpm install
```

Entering the shell restores the agent skills recorded in `skills-lock.json`.

Every Experiment project implements the same commands:

| Command | Contract |
| --- | --- |
| `dev` | Run the experiment locally. |
| `build` | Create or validate its deliverable. |
| `check` | Verify its stated external behavior with an unattended check. |

From the repository root, `pnpm experiment <experiment-name>` selects an experiment by its directory name and invokes its `dev` command. Unknown names fail with the available Experiment list. The dispatcher has no experiment-specific shortcuts.

The root commands discover all Experiment projects:

```sh
pnpm build
pnpm check
```

Root `build` validates the required commands and builds each project. Root `check` also validates the contract, then builds and checks each project. A missing command or a failed build or check fails the run. [CI](.github/workflows/experiment-contract.yml) uses these same root commands without experiment-specific branches.

Native pnpm filtering remains available. Within an Experiment project, `pnpm dev`, `pnpm build`, and `pnpm check` invoke its local commands.

## Run the DuckDB experiment

The [DuckDB content inspector](experiments/duckdb-content-inspector/README.md) is **Exploring**. It demonstrates a Direct data view: a read-only projection of an Astro site's content records that bypasses the site's presentation layer.

After installing dependencies, run either command from the repository root:

```sh
pnpm experiment duckdb-content-inspector
pnpm --filter @astro-data-labs/duckdb-content-inspector dev
```

Open <http://127.0.0.1:5173/>. Select **Load Astro sample**, then **Start DuckDB**, then **Run SQL**. The bundled sample contains seven ordinary entries and shows `authors = 2`, `blog = 3`, and `docs = 2`. The English interface includes walkthroughs and queries for counts, titles, field coverage, and references.

You can also select a local `.astro/data-store.json` or normalized JSON row array. The experiment excludes meta collections, retains source paths when present, and projects ordinary entries into `astro_content`. DuckDB-Wasm runs in a Web Worker with local Worker and WASM assets. Selected content stays in tab memory without upload or write-back; closing the tab discards the database.

The experiment intentionally reads Astro's internal generated store. It does not use the supported `astro:content` application API, and changes to the store representation can break it. Experimental chunked storage also breaks its single-file assumption. These limits make it a research artifact rather than a stable Astro integration. See the [experiment documentation](experiments/duckdb-content-inspector/README.md#compatibility-boundary) for its compatibility boundary and full run instructions.

## Contributing

To propose a new experiment, open an [Experiment request](https://github.com/kvazzie/astro-duckdb-inspector/issues/new?template=experiment_request.yml). Explain the Astro data problem or opportunity, proposed response, observable result, trade-offs, and non-goals. Requests are evaluated on whether they pose a concrete question and can demonstrate evidence within the Lab's boundaries.

An Experiment request is welcome before substantial work. You may also submit an explanatory pull request directly when it describes the problem and evidence. Use the [pull request guidance](.github/pull_request_template.md) to include purpose, run instructions, a sample, observations from running it, and remaining limitations. Keep public documentation and experiment interfaces in English, keep experiment-specific code with its project, and satisfy the Experiment contract.

Use a [Feature request](https://github.com/kvazzie/astro-duckdb-inspector/issues/new?template=feature_request.yml) to change repository functionality or an existing experiment. This keeps new Experiment proposals distinct from improvements to work already in the Lab.

Filing a request does not select it for implementation. Requests remain ordinary GitHub Issues until maintainers select them into the GitHub Project Roadmap. The Roadmap represents selected work, not a manual list of promised experiments or releases.

## License and contribution terms

The repository is licensed under the [MIT License](LICENSE), copyright 2026 Artemii Rachev. Contributions submitted for inclusion are licensed under the same MIT terms. No contributor license agreement or Developer Certificate of Origin sign-off is required. Retain the license and copyright notice when copying or distributing covered code.

## Repository guide

- [`experiments/`](experiments/) contains self-contained Experiment projects and their local documentation.
- [`scripts/`](scripts/) contains the neutral Experiment dispatcher and root build and check automation.
- [`CONTEXT.md`](CONTEXT.md) defines the shared domain vocabulary and scope.
- [`docs/agents/`](docs/agents/) records issue-tracker, triage, and domain-document conventions for coding agents.
- [`AGENTS.md`](AGENTS.md) is the canonical agent instruction file; `CLAUDE.md` is its compatibility symlink.
- [`skills-lock.json`](skills-lock.json) records the project-local agent skills restored by `devenv shell`.
