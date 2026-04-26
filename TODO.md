# TODO

Backlog of "should do, not now". Gets pruned as items land or stop being
relevant. Items are roughly ordered by priority within each section.

## Engineering

- **GitHub Actions CI** — `typecheck + test` on every push and PR for both
  the backend and `web/`. Today, regressions ship straight to prod. Worth
  one workflow file before any contributor (or a tired me) breaks the build.
  Reference `tools/.github/workflows/deploy-tools-infra.yaml` for the secrets
  pattern; the actual job is `bun install` → `bun run typecheck` →
  `bun run test` → `bun run test:web`. No deploy on push — keep deploys
  manual via `bun run deploy`.
- **Frontend test: optimistic delete rollback path.**
  `web/src/api/hooks.ts:useDeleteNotification` does the
  cancel→snapshot→filter→fire→onError-rollback dance. The rollback branch is
  invisible until it breaks. With a `QueryClientProvider` test wrapper +
  mocked fetch that returns 500 once, assert the cache reverts to the
  pre-mutation state.
- **Backend test: `nextRecurring` DST regression.** Pick a date in
  `Europe/London` or `Asia/Nicosia` straddling a DST transition and assert
  the returned UTC ms shifts by exactly the offset change. Today the only
  proof DST works is "the user hasn't complained twice a year".
- **Mini-App link to `/privacy`.** Footer of `ListPage` (small text) or
  below the Save button on `FormPage`. The route exists but is undiscoverable
  without the BotFather link.

## Operations

- **`scripts/rotate-message-key.ts`.** See `docs/encryption.md` "Key
  rotation" section for the shape. Without it, rotating `MESSAGE_KEY` is a
  debugging session, not a procedure.
- **Cron health alerting.** No signal today if the cron stops firing. Two
  practical shapes:
  - **Heartbeat endpoint.** Cron writes `last_tick_at` to D1 (or KV);
    expose a `/health/cron` route that returns 200 if `now - last_tick_at <
    2 min`, 503 otherwise. Point an external uptime monitor (cron-job.org,
    UptimeRobot) at it. ~20 lines of code.
  - **Cloudflare Workers Logpush** to an external log destination + an
    alert rule on the absence of `cron tick` log lines. More setup, more
    powerful.
