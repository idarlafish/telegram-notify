import { defineConfig } from "vitest/config";

// Pure unit tests of pure functions (computeNextFireAt, verifyInitData via Web
// Crypto). No Worker runtime needed — node env is fastest and has crypto.subtle
// since Node 19.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
