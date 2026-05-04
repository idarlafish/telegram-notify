// ESLint flat config. Single architectural rule for now: forbid direct
// imports of the per-user DO stub from outside the service layer.
// See src/services/{user,notifications}.ts for the only allowed callers.
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "migrations/**",
      "web/**",
    ],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/scheduler/user-do/stub"],
              message:
                "Direct DO stub imports are forbidden outside src/services/. Use a service module (src/services/user.ts, src/services/notifications.ts) instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // Carve-out: services own the stub, and the DO module itself defines it.
    files: ["src/services/**/*.ts", "src/scheduler/**/*.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
