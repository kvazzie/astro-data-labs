import { defineConfig } from "astro/config";

export default defineConfig({
  outDir: process.env.LAB_OUTPUT ?? "../dist/local/",
  cacheDir: "../.lab/astro-cache/",
  vite: { ssr: { external: ["@libsql/client", "drizzle-orm", "drizzle-zod", "zod"] } },
});
