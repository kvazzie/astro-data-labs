#!/usr/bin/env node
import { cp, mkdir, rm } from "node:fs/promises";

const source = new URL("../site/", import.meta.url);
const output = new URL("../dist/lab-index/", import.meta.url);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

console.log("Built the static Lab index at dist/lab-index/.");
