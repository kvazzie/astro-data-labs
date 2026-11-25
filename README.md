# Astro Data Labs

Astro Data Labs is an open, community-driven Experiment index for Astro data pipelines, architecture, and infrastructure. The Lab brings independent, executable experiments into one monorepository so readers can compare approaches, inspect their trade-offs, and take an individual experiment as a starting point for their own work.

An Experiment investigates one concrete Astro data problem or opportunity. It includes code you can run, a sample or demonstration with an observable result, and an explanation of what the result shows and where the approach stops working. The Lab does not prescribe a universal architecture or promise production support or compatibility.

## Browse the Experiment index

The [public Lab index](https://kvazzie.github.io/astro-data-labs/) introduces the Lab, its experiments, and contribution routes without requiring a clone. This README remains the canonical long-form documentation.

Start with an experiment's question and status. Follow its documentation to run the sample, compare the observed result with the stated goal, and read its limitations before adapting the approach to your project. An experiment may demonstrate an application, package, pipeline, architecture, or infrastructure idea. It does not have to deploy online to belong in the index.

| Experiment | Question | Status | Documentation and runnable project |
| --- | --- | --- | --- |
| DuckDB content inspector | Can Astro's generated content store provide SQL visibility for inspecting collections, schema drift, and references during a Content-first launch? | Exploring | [Run the experiment](experiments/duckdb-content-inspector/) |
| Reversible content | Can Drizzle-derived validation preserve records between database-backed Astro collections and local files, with a SQLite export for a sibling project? | Exploring | [Run the experiment](experiments/reversible-content/) |

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
git clone https://github.com/kvazzie/astro-data-labs.git
cd astro-data-labs
devenv shell
pnpm install
```

Entering the shell restores the agent skills recorded in `skills-lock.json`.

Existing clones of `kvazzie/astro-duckdb-inspector` still work through GitHub's rename redirect. Update their remote to the canonical URL:

```sh
git remote set-url origin https://github.com/kvazzie/astro-data-labs.git
```

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

## Run the reversible content experiment

The [Reversible content Experiment](experiments/reversible-content/README.md) is **Exploring**. It compares database-backed and local JSON Content Collections through the same Drizzle-derived validation contract, converts records between the inputs, and exports validated local records to SQLite for a sibling SQL consumer.

```sh
pnpm experiment reversible-content
```

The terminal demonstration builds both routes over two authors and three posts, compares IDs and every field, performs a database-to-files-to-database round trip, and queries the SQLite export. Unattended checks also reject invalid inputs, change source records, rebuild, and detect an old export using a current source digest. See its documentation for pinned versions, manual conversion commands, observed results, and limits. The export is derived data; this Experiment does not select a permanent source of truth.

## Contributing

To propose a new experiment, open an [Experiment request](https://github.com/kvazzie/astro-data-labs/issues/new?template=experiment_request.yml). Explain the Astro data problem or opportunity, proposed response, observable result, trade-offs, and non-goals. Requests are evaluated on whether they pose a concrete question and can demonstrate evidence within the Lab's boundaries.

An Experiment request is welcome before substantial work. You may also submit an explanatory pull request directly when it describes the problem and evidence. Use the [pull request guidance](.github/pull_request_template.md) to include purpose, run instructions, a sample, observations from running it, and remaining limitations. Keep public documentation and experiment interfaces in English, keep experiment-specific code with its project, and satisfy the Experiment contract.

Use a [Feature request](https://github.com/kvazzie/astro-data-labs/issues/new?template=feature_request.yml) to change repository functionality or an existing experiment. This keeps new Experiment proposals distinct from improvements to work already in the Lab.

Use [Discussions](https://github.com/kvazzie/astro-data-labs/discussions) for early thinking, design conversations, community examples, and help:

| Category | Use it for |
| --- | --- |
| [Ideas](https://github.com/kvazzie/astro-data-labs/discussions/categories/ideas) | Explore an idea before proposing a concrete Experiment or Feature request. |
| [Architecture](https://github.com/kvazzie/astro-data-labs/discussions/categories/architecture) | Compare data pipeline, architecture, and infrastructure decisions and their trade-offs. |
| [Show and tell](https://github.com/kvazzie/astro-data-labs/discussions/categories/show-and-tell) | Share experiments, observations, and projects built from Lab work. |
| [Q&A](https://github.com/kvazzie/astro-data-labs/discussions/categories/q-a) | Ask how to run, understand, or adapt an experiment. Answers can be marked as accepted. |

The repository accepts squash merges for pull requests.

Filing a request does not select it for implementation. Requests remain ordinary GitHub Issues until maintainers select them into the GitHub Project Roadmap. The Roadmap represents selected work, not a manual list of promised experiments or releases.

The [Lab Roadmap Project](https://github.com/users/kvazzie/projects/5/views/2) plans selected Lab and Experiment work together. `Scope` distinguishes `Lab` from `Experiment`; Experiment items name the existing Experiment in the issue. `Status` tracks `Todo`, `In Progress`, and `Done`, while `Target date` provides the Roadmap's scheduling field. Leave dates unset until maintainers choose them. Add requests only after an explicit selection decision, and do not automatically add every new issue.

A large Experiment can later move its selected work into a dedicated Project. Keep the same issues and their history, link that Project from the Experiment's documentation, and remove the transferred items from the Lab Project to avoid duplicate planning. A separate Project is not required for every Experiment.

The [Reversible content Experiment](experiments/reversible-content/) implements [request #18](https://github.com/kvazzie/astro-data-labs/issues/18). Its observations compare database-backed loading, local files, and a derived SQLite export without prescribing which input should own the records.

## Build and publish the Lab index

The compact GitHub Pages entrance lives in [`site/`](site/). It is plain HTML and CSS with no documentation framework, client-side JavaScript, or application server. Experiment questions, statuses, and links are maintained by hand in `site/index.html`; update the corresponding README entry when changing them.

Build the static files from the repository root:

```sh
pnpm build:index
```

The command copies the site into `dist/lab-index/`, replacing the previous output. It needs Node.js and no installed dependencies. You can also run `node scripts/build-lab-index.mjs` directly. Open `dist/lab-index/index.html` in a browser to inspect the result. Relative asset links work both from a local file and under the `/astro-data-labs/` Pages path.

The [Lab index workflow](.github/workflows/lab-index.yml) builds and uploads the static artifact on pull requests. A push to `main` builds and deploys it to GitHub Pages. Maintainers can repeat a deployment by running the workflow manually against `main`. Other branches only build the artifact. This workflow is separate from the root Experiment build and check contract.

In the repository's **Settings → Pages**, select **GitHub Actions** as the publishing source. Deployments use the `github-pages` environment; its protection rules must allow `main`. The published entrance is <https://kvazzie.github.io/astro-data-labs/>. Experiment runtimes are run locally through their own instructions.

## License and contribution terms

The repository is licensed under the [MIT License](LICENSE), copyright 2026 Artemii Rachev. Contributions submitted for inclusion are licensed under the same MIT terms. No contributor license agreement or Developer Certificate of Origin sign-off is required. Retain the license and copyright notice when copying or distributing covered code.

## Repository guide

- [`experiments/`](experiments/) contains self-contained Experiment projects and their local documentation.
- [`scripts/`](scripts/) contains the neutral Experiment dispatcher and root build and check automation.
- [`CONTEXT.md`](CONTEXT.md) defines the shared domain vocabulary and scope.
- [`docs/agents/`](docs/agents/) records issue-tracker, triage, and domain-document conventions for coding agents.
- [`AGENTS.md`](AGENTS.md) is the canonical agent instruction file; `CLAUDE.md` is its compatibility symlink.
- [`skills-lock.json`](skills-lock.json) records the project-local agent skills restored by `devenv shell`.
