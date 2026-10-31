import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const authors = sqliteTable("authors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  bio: text("bio"),
});

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  authorId: integer("author_id").references(() => authors.id),
  publishedAt: integer("published_at", { mode: "timestamp_ms" }),
  summary: text("summary"),
  featured: integer("featured", { mode: "boolean" }).notNull(),
  metadata: text("metadata", { mode: "json" }).$type<{
    tags: string[];
    rating: number | null;
  }>().notNull(),
});

export const authorSchema = createSelectSchema(authors, {
  id: z.number().int().positive().safe(),
  name: (schema) => schema.min(1),
}).strict();

// Drizzle's date column expects Date; JSON files carry an explicit UTC string.
// Accept both representations and normalize to Date before Astro stores a row.
export const postSchema = createSelectSchema(posts, {
  id: z.number().int().positive().safe(),
  title: (schema) => schema.min(1),
  authorId: z.number().int().positive().safe().nullable(),
  publishedAt: z.union([
    z.date(),
    z.iso.datetime({ precision: 3 }).transform((value) => new Date(value)),
  ]).nullable(),
  metadata: z.object({
    tags: z.array(z.string()),
    rating: z.number().finite().nullable(),
  }).strict(),
}).strict();

export type Author = z.infer<typeof authorSchema>;
export type Post = z.infer<typeof postSchema>;
export type Records = { authors: Author[]; posts: Post[] };

// Row validation cannot enforce cross-record SQL constraints.
export function validateRecords(input: { authors: unknown[]; posts: unknown[] }): Records {
  const records = {
    authors: input.authors.map((row) => authorSchema.parse(row)),
    posts: input.posts.map((row) => postSchema.parse(row)),
  };
  for (const [name, rows] of Object.entries(records)) {
    const ids = rows.map((row) => row.id);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ID in ${name}`);
  }
  const authorIds = new Set(records.authors.map((row) => row.id));
  for (const post of records.posts) {
    if (post.authorId !== null && !authorIds.has(post.authorId)) {
      throw new Error(`Post ${post.id} references missing author ${post.authorId}`);
    }
  }
  records.authors.sort((a, b) => a.id - b.id);
  records.posts.sort((a, b) => a.id - b.id);
  return records;
}
