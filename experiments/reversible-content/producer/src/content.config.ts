import { defineCollection } from "astro:content";
import type { Loader } from "astro/loaders";
import { fileURLToPath } from "node:url";
import { authorSchema, postSchema } from "../../src/contract";
import { readDatabase } from "../../src/database";
import { readLocal } from "../../src/records";

const route = process.env.LAB_ROUTE ?? "local";
if (route !== "local" && route !== "database") throw new Error(`Unknown input route: ${route}`);
const input = process.env.LAB_INPUT ?? fileURLToPath(new URL("../../fixtures/local", import.meta.url));

// One snapshot shared by both collections, including duplicate/reference checks.
const snapshot = route === "local" ? readLocal(input) : readDatabase(input);
function loader(collection: "authors" | "posts"): Loader {
  return {
    name: `${route}-${collection}`,
    load: async ({ store, parseData }) => {
      const rows = (await snapshot)[collection];
      store.clear();
      for (const row of rows) {
        const id = String(row.id);
        const data = await parseData({ id, data: row });
        store.set({ id, data });
      }
    },
  };
}

export const collections = {
  authors: defineCollection({ loader: loader("authors"), schema: authorSchema }),
  posts: defineCollection({ loader: loader("posts"), schema: postSchema }),
};
