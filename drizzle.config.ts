import { defineConfig } from "drizzle-kit";

// drizzle-kit owns migrations; wrangler picks up the .sql files from
// migrations/ and applies them via `wrangler d1 migrations apply`. The
// migrations/meta/ folder (snapshots + journal) is committed so future
// `drizzle-kit generate` calls can diff correctly.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
