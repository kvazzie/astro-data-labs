import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const experimentRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = resolve(experimentRoot, "dist");
const fixturePath = resolve(experimentRoot, "fixtures", "local-data-store.json");

await access(resolve(distDirectory, "index.html")).catch(() => {
  throw new Error("Built experiment is missing. Run `pnpm build` before `pnpm check`.");
});
await access(fixturePath);

const { chromium } = await import("playwright");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".wasm", "application/wasm"],
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = resolve(distDirectory, requestedFile);
    const localPath = relative(distDirectory, filePath);

    if (localPath.startsWith("..") || isAbsolute(localPath)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveListening, rejectListening) => {
  server.once("error", rejectListening);
  server.listen(0, "127.0.0.1", resolveListening);
});

const address = server.address();
assert(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? "failed"}`));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if ((url.protocol === "http:" || url.protocol === "https:") && url.origin !== origin) {
      externalRequests.push(request.url());
    }
  });

  const resultRows = () => page.locator("#results tbody tr").evaluateAll((rows) =>
    rows.map((row) => [...row.querySelectorAll("td")].map((cell) => cell.textContent?.trim())),
  );
  async function runQuery() {
    await page.getByRole("button", { name: "Run SQL", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("#notice")?.textContent === "Query completed.", null, { timeout: 60_000 });
    return resultRows();
  }

  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab").first().waitFor();

  assert.equal(await page.locator("#launch-warning").isHidden(), true, "expected the interactive module to load");
  assert.equal(await page.getByRole("tab").count(), 4, "expected four walkthrough tabs");
  assert.equal(await page.locator("[data-step]:visible").count(), 3, "expected three visible walkthrough step buttons");
  assert.equal(await page.locator("html").getAttribute("lang"), "en", "expected an English interface");
  assert.deepEqual(await page.getByRole("tab").allTextContents(), ["Overview", "Field coverage", "Wrong order", "References"]);
  for (const title of ["Field coverage", "Wrong order", "References", "Overview"]) {
    await page.getByRole("tab", { name: title, exact: true }).click();
    assert.equal(await page.locator("[data-step]:visible").count(), 3, `expected three visible steps in ${title}`);
    assert.doesNotMatch(await page.locator("#scenario").innerText(), /[\u0400-\u04ff]/, "expected an English walkthrough");
  }

  await page.getByRole("button", { name: "Run SQL", exact: true }).click();
  assert.equal(await page.locator("#notice.error").isVisible(), true, "expected a visible query-before-source error");
  assert.match(await page.locator("#notice").innerText(), /Load a content store before running SQL/);

  await page.getByRole("button", { name: "Load Astro sample", exact: true }).click();
  await page.getByRole("button", { name: "Start DuckDB", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#status-grid .status-card:nth-child(3) small")?.textContent === "ready", null, { timeout: 60_000 });
  assert.deepEqual(await runQuery(), [
    ["authors", "2", "2"],
    ["blog", "3", "3"],
    ["docs", "2", "2"],
  ]);

  await page.getByRole("button", { name: "All titles", exact: true }).click();
  assert.deepEqual(await runQuery(), [
    ["blog", "content-audit", "Content audit", "2026-08-08"],
    ["blog", "duckdb-in-astro", "DuckDB inside Astro", "2026-08-01"],
    ["blog", "orphan", "Post without an author", "∅"],
    ["docs", "getting-started", "Getting started", "∅"],
    ["docs", "sql-recipes", "SQL recipes", "∅"],
  ]);
  await page.locator("[data-query='schema']").click();
  const fieldCoverage = await runQuery();
  assert(fieldCoverage.some((row) => row.join("|") === "blog|title|3"), "expected titles in every blog entry");
  assert(fieldCoverage.some((row) => row.join("|") === "blog|tags|1"), "expected tags in one blog entry");
  await page.getByRole("button", { name: "Blog references", exact: true }).click();
  assert.deepEqual(await runQuery(), [
    ["content-audit", "Content audit", "Lin"],
    ["duckdb-in-astro", "DuckDB inside Astro", "Ada"],
    ["orphan", "Post without an author", "∅"],
  ]);

  await page.locator("#sql").fill("SELECT missing_column FROM astro_content;");
  await page.getByRole("button", { name: "Run SQL", exact: true }).click();
  await page.locator("#notice.error").waitFor();
  assert.match(await page.locator("#notice").innerText(), /SQL query failed:/);
  await page.getByRole("button", { name: "Collections", exact: true }).click();

  await page.locator("#file-input").setInputFiles(fixturePath);
  await page.waitForFunction(() => document.querySelector("#status-grid .status-card:first-child strong")?.textContent === "local-data-store.json");
  assert.equal(await page.locator("#collection-list li").count(), 1, "expected the selected local store to replace the bundled sample");
  assert.deepEqual(await runQuery(), [["notes", "1", "1"]], "expected the local Astro store to replace sample rows in SQL");
  await page.locator("#sql").fill("SELECT id, file_path, body, digest FROM astro_content ORDER BY id;");
  assert.deepEqual(await runQuery(), [["hello", "src/content/notes/hello.md", "∅", "fixture-1"]]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab").first().waitFor();
  await page.locator("#file-input").setInputFiles({
    name: "normalized-rows.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([
      { collection: "notes", id: "first", file_path: "src/content/notes/first.md", data_json: '{"title":"First note"}' },
      { collection: "notes", id: "second", filePath: "src/content/notes/second.md", data: { title: "Second note" } },
      { collection: "meta:notes", id: "sync-token", data: {} },
    ])),
  });
  await page.waitForFunction(() => document.querySelector("#status-grid .status-card:first-child strong")?.textContent === "normalized-rows.json");
  await page.locator("#start-duckdb").click();
  await page.waitForFunction(() => document.querySelector("#status-grid .status-card:nth-child(3) small")?.textContent === "ready", null, { timeout: 60_000 });
  assert.deepEqual(await runQuery(), [["notes", "2", "2"]], "expected normalized ordinary rows and both source paths in SQL");
  await page.locator("#sql").fill("SELECT id, file_path FROM astro_content ORDER BY id;");
  assert.deepEqual(await runQuery(), [
    ["first", "src/content/notes/first.md"],
    ["second", "src/content/notes/second.md"],
  ]);

  for (const input of ["[42]", "{}", "not JSON", JSON.stringify([{ collection: "notes", id: "invalid", data_json: "{" }]), '[["Map",1,2],"notes",{}]']) {
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.locator("#file-input").setInputFiles({
      name: "unsupported-store.json",
      mimeType: "application/json",
      buffer: Buffer.from(input),
    });
    await page.locator("#notice.error").waitFor();
    assert.match(await page.locator("#notice").innerText(), /Unsupported content store.*Astro\/devalue.*normalized JSON row array/, "expected supported input formats in the visible error");
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.locator("#file-input").setInputFiles({ name: "meta-only.json", mimeType: "application/json", buffer: Buffer.from('[{"collection":"meta:notes","id":"sync-token"}]') });
  await page.locator("#notice.error").waitFor();
  assert.match(await page.locator("#notice").innerText(), /No ordinary collection entries/);

  await page.getByRole("tab", { name: "Wrong order", exact: true }).click();
  await page.locator('[data-step="0"]').click();
  await page.locator('[data-step="1"]').click();
  assert.equal(await page.locator("#notice.error").isVisible(), true);
  assert.match(await page.locator("#notice").innerText(), /Load a content store before running SQL/);
  await page.locator('[data-step="2"]').click();
  await page.waitForFunction(() => document.querySelector("#notice")?.textContent === "Query completed.", null, { timeout: 60_000 });
  assert.deepEqual(await resultRows(), [["authors", "2", "2"], ["blog", "3", "3"], ["docs", "2", "2"]], "expected recovery through the visible walkthrough");
  assert.doesNotMatch(await page.locator("body").innerText(), /[\u0400-\u04ff]/, "expected English interface and sample results");
  assert.deepEqual(externalRequests, [], "built experiment requested a remote runtime asset");
  assert.deepEqual(failedRequests, [], "built experiment had failed requests");
  assert.deepEqual(pageErrors, [], "built experiment raised page errors");

  console.log("Verified English walkthroughs, sample queries, local Astro and normalized stores, visible errors, recovery, and local runtime assets.");
} finally {
  await browser?.close();
  await new Promise((resolveClosed, rejectClosed) => {
    server.close((error) => error ? rejectClosed(error) : resolveClosed());
  });
}
