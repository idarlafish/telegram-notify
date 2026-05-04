# Contributing

## Local setup

See [README → Setup](./README.md#setup). Once your `.env` is filled in:

```bash
bun install
bun run dev:web    # frontend on :5173
bun run dev        # backend on :8787 (separate terminal)
```

## Pre-flight checks

Before opening a PR, all of these must pass — CI runs the same set:

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run test:web
```

A pre-commit hook runs `lint-staged` (eslint + prettier on staged files) automatically. If you ever need to bypass it for an emergency, `git commit --no-verify` works — but please don't make a habit of it.

## Code style

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`)
- TypeScript strict mode — no `any` without a justification
- Prettier owns formatting; eslint owns import boundaries (see `eslint.config.js`)
- Default to **no comments**. Only add one when the **why** is non-obvious — a hidden constraint, a workaround, an invariant. Don't restate what the code says.
- Don't add backwards-compat shims for unused code paths. This codebase prefers forward migrations.

## Testing

- Backend: vitest + `@cloudflare/vitest-pool-workers` — tests run in a real Workers runtime. See `tests/` and `src/**/*.test.ts`.
- Frontend: vitest + jsdom + Testing Library — see `web/tests/`.
- Add a test for any new behavior. Bug fixes get a regression test.

## Architecture rules enforced by lint

`src/services/` is the only seam allowed to import the per-user DO stub directly. Other callers go through services. The `no-restricted-imports` ESLint rule enforces this — a build failure means you crossed the boundary.

## Documentation

- `AGENTS.md` is the entry point for AI agents working on the codebase.
- `docs/` holds topical guides: database, encryption, telegram-bot ops.
- Update the relevant doc when you change behavior the doc describes.
