import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { authors, posts, validateRecords, type Records } from "./contract.js";
import { contractVersion, digest } from "./records.js";

// Explicit SQLite DDL accompanies the Drizzle schema; no migrations are claimed.
const ddl = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE authors (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, bio TEXT);
  CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
    author_id INTEGER REFERENCES authors(id), published_at INTEGER, summary TEXT,
    featured INTEGER NOT NULL CHECK(featured IN (0, 1)), metadata TEXT NOT NULL
  );
  CREATE TABLE export_meta (contract TEXT NOT NULL, source_digest TEXT NOT NULL);
`;

export async function readDatabase(path: string): Promise<Records> {
  await access(path);
  const client = createClient({ url: pathToFileURL(path).href });
  try {
    const db = drizzle(client);
    return validateRecords({ authors: await db.select().from(authors), posts: await db.select().from(posts) });
  } finally {
    client.close();
  }
}

export async function writeDatabase(path: string, input: Records, generatedIds = false) {
  const records = validateRecords(input);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await rm(temporary, { force: true });
  const client = createClient({ url: pathToFileURL(temporary).href });
  try {
    await client.executeMultiple(ddl);
    const db = drizzle(client);
    await db.transaction(async (tx) => {
      for (const row of records.authors) {
        // Seeding deliberately exercises SQLite allocation. Conversions preserve IDs.
        const { id, ...values } = row;
        const [inserted] = await tx.insert(authors).values(generatedIds ? values : row).returning();
        if (inserted.id !== id) throw new Error("Generated fixture ID changed");
      }
      for (const row of records.posts) {
        const { id, ...values } = row;
        const [inserted] = await tx.insert(posts).values(generatedIds ? values : row).returning();
        if (inserted.id !== id) throw new Error("Generated fixture ID changed");
      }
    });
    await client.execute({ sql: "INSERT INTO export_meta VALUES (?, ?)", args: [contractVersion, digest(records)] });
  } finally {
    client.close();
  }
  await rename(temporary, path);
}
