import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { createFetchMock } from "miniflare";
import { defineConfig } from "vitest/config";

const fetchMock = createFetchMock();
fetchMock.disableNetConnect();

fetchMock
  .get("https://api.telegram.org")
  .intercept({ path: /.*/, method: "POST" })
  .reply(200, { ok: true, result: { message_id: 1, chat: { id: 1 }, date: 0, text: "" } })
  .persist();

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/user-do.test.ts"],
        },
      },
      {
        extends: true,
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.toml" },
            miniflare: {
              fetchMock,
              bindings: {
                MESSAGE_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
                BOT_TOKEN: "X:Y",
              },
            },
          }),
        ],
        test: {
          name: "workers",
          include: ["tests/user-do.test.ts"],
        },
      },
    ],
  },
});
