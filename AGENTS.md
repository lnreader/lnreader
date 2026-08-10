# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

LNReader is a free, open-source light novel reader for Android, built with
React Native (Expo) and TypeScript. Content is fetched at runtime by
JavaScript "plugins" (per-source scrapers) rather than bundled with the app.
Plugin _requests_ live in a separate repo, [lnreader-plugins](https://github.com/lnreader/lnreader-plugins);
this repo is the reader app itself.

## Setup

```bash
pnpm install
```

- Node >= 22.11.0, pnpm (see `packageManager` in `package.json`, currently pnpm@11.20.0).
- This is a React Native/Expo app targeting Android; there is no web or iOS
  build target maintained here. Building/running the app requires an Android
  SDK and a device/emulator, which is generally not available in an agent
  sandbox — prefer running lint, type-check, and tests to verify changes.
- See `CONTRIBUTING.md` (and `CONTRIBUTING-NIX.md` for a Nix-based dev shell)
  for full local Android setup instructions.

## Commands

Run these from the repo root:

```bash
pnpm run lint          # eslint ./src
pnpm run lint:fix       # eslint --fix
pnpm run format:check   # prettier --check
pnpm run format         # prettier --write
pnpm run type-check     # tsc --noEmit
pnpm run check           # format:check + lint + type-check (run before finishing any change)
pnpm test                # jest (all projects)
pnpm run test:rn         # jest --selectProjects rn   (React Native/component/hook tests)
pnpm run test:db         # jest --selectProjects db   (database/query tests, node env)
pnpm run test:watch
pnpm run test:coverage
```

Always run `pnpm run check` (or at minimum lint + type-check + the relevant
test project) before considering a change complete. A pre-commit hook
(`husky` + `lint-staged`) runs prettier/eslint on staged files, and a
pre-push hook runs `type-check`, so failures here will also block commits/pushes.

## Code style

- TypeScript, functional React components, hooks-based state.
- Formatting is enforced by Prettier (`.prettierrc.js`) — don't hand-format,
  run `pnpm run format` instead.
- ESLint config is `eslint.config.js` (flat config, based on `eslint-config-expo`).
  Notable rules: `no-console` is an error (use the project's logging/toast
  utilities, not `console.*`), `prefer-const`, `no-var`, and several
  `react-hooks/*` correctness rules are enforced.
- Use the `@alias/*` path aliases defined in `tsconfig.json` (and mirrored in
  `jest.config.js`) instead of deep relative imports, e.g. `@components`,
  `@hooks`, `@database/*`, `@screens/*`, `@services/*`, `@utils/*`,
  `@api/*`, `@theme/*`, `@plugins/*`, `@navigators/*`, `@i18n/*`, `@type/*`.
- Don't add comments that just restate what the code does; only comment
  non-obvious "why" (workarounds, invariants, native/platform quirks).

## Localization (i18n)

- `src/i18n/languages/en/strings.json` is the source-of-truth string file —
  it's the only locale you should hand-edit. Every other folder under
  `src/i18n/languages/*` is a translation synced automatically from Crowdin
  (see `crowdin.yml`); don't edit or "fix" translated strings in those files.
- After adding/changing keys in `en/strings.json`, run
  `pnpm run generate:string-types` to regenerate the associated TypeScript types.

## Repository layout

- `src/api` – external API clients (drive/cloud backup providers, etc.)
- `src/components` – shared/reusable UI components
- `src/database` – SQLite (op-sqlite/Drizzle) schema, queries, and migrations
  helpers; `src/database/queries/*Queries.ts` are the main data-access layer
- `src/hooks` – shared and "persisted" (MMKV-backed) React hooks
- `src/i18n` – translated strings (see Crowdin integration in `crowdin.yml`)
- `src/navigators` – React Navigation stack/tab setup
- `src/plugins` – plugin manager and plugin type definitions (not the plugin
  source scrapers themselves, which live in the separate lnreader-plugins repo)
- `src/screens` – feature screens (library, browse, novel, reader, settings, etc.)
- `src/services` – background tasks, downloads, backups, trackers, EPUB export, updates
- `src/theme` – Material3 theming
- `src/utils` – general utilities
- `drizzle/` – generated SQL migrations (see `pnpm run generate:db-migration`)
- `modules/` – native modules (Nitro modules: epub, tts, file, zip-archive, etc.)
- `test/` – Jest global mocks and the shared `test-utils.tsx` render helpers
- `scripts/` – Node scripts for env file generation, release packaging, etc.

## Testing notes

- Don't add tests for the sake of coverage. Write tests for user-facing
  interactions (screens, components a user directly touches) and for core
  complex logic (parsing, database queries, sync/backup, chapter/novel
  matching, etc.), not for trivial passthroughs, simple type/prop plumbing,
  or generated/boilerplate code.
- Tests live in `__tests__` directories next to the code under test and use
  Jest + `@testing-library/react-native`.
- Jest is split into two projects (see `jest.config.js`):
  - `db` — pure logic/query tests under `src/database`, run in a Node environment.
  - `rn` — component/hook/integration tests under `src/`, run with the `jest-expo` preset.
- Import the shared render helpers from `@test-utils` (`render`, `renderNovel`,
  `AllTheProviders`) rather than using `@testing-library/react-native`'s
  `render` directly, so providers (theme, gesture handler, safe area, novel
  context) are set up consistently.
- Mock at module level with `jest.mock(...)`, not inside `beforeEach` — see
  `TESTING.md` for the reasoning and common pitfalls (ESM transform errors,
  `mockReturnValue` failures, test isolation).
- Global mocks for native modules and database queries live in `test/mocks/`;
  hook-specific mocks live in `src/hooks/__mocks__` and `src/hooks/__tests__/mocks.ts`.

## Database changes

- Schema lives under `src/database/schema`; the ORM is Drizzle
  (`drizzle-orm`, config in `drizzle.config.ts`).
- After changing the schema, generate a migration rather than hand-writing
  SQL: `pnpm run generate:db-migration`. Do not edit files under `drizzle/`
  by hand.

## PR / commit conventions

- Keep changes scoped and consistent with existing patterns in the touched
  directory; prefer editing existing files over introducing new abstractions.
- Match existing code style; don't reformat unrelated code.
- If you are an AI agent opening a PR or making a commit, attribute it as
  such (e.g. a "Generated with <agent/tool name>" note in the commit
  message/PR description, and a co-author trailer if your tool supports one).
