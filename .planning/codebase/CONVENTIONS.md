# Coding Conventions

**Analysis Date:** 2026-02-27

## Naming Patterns

**Files:**

- PascalCase for components and types: `NovelQueries.ts`, `useNovel.ts`, `Button.tsx`
- camelCase for utility files and hooks: `showToast.ts`, `error.ts`, `useBoolean.ts`
- Directory names: lowercase with camelCase for compound names: `hooks/common/`, `database/queries/`

**Functions:**

- camelCase for all functions
- Verb-prefix for action functions: `getNovelById`, `insertNovelAndChapters`, `switchNovelToLibraryQuery`
- Descriptive names that indicate action: `updateNovelInfo`, `deleteCachedNovels`, `pickCustomNovelCover`

**Variables:**

- camelCase for all variables
- Prefix with underscore for internal/mutated variables: `_setChapters`, `_setNovelSettings`
- Descriptive names: `novelId`, `chapterIds`, `isDownloaded`

**Types:**

- PascalCase for interfaces and types: `NovelInfo`, `ChapterInfo`, `UseBooleanReturnType`
- Schema types from Drizzle: `NovelInsert`, `ChapterInsert`, `CategoryInsert`

## Code Style

**Formatting:**

- Tool: Prettier 2.8.8
- Tab width: 2
- Use tabs: false (spaces)
- Single quotes for strings
- Trailing commas: all
- Arrow function parens: avoid (only when needed)
- Bracket spacing: true
- Bracket same line: false

**Linting:**

- Tool: ESLint 8.57.1
- Extends: `@react-native` preset with Jest plugin
- Key rules enforced:
  - `no-console`: error (allows in test files)
  - `curly`: error (multi-line, consistent)
  - `no-useless-return`: error
  - `block-scoped-var`: error
  - `no-var`: error
  - `prefer-const`: error
  - `no-dupe-else-if`: error
  - `no-duplicate-imports`: error
  - `@typescript-eslint/no-shadow`: warn
  - `react-hooks/exhaustive-deps`: warn

## Import Organization

**Order:**

1. External libraries (React, React Native, etc.)
2. npm packages (expo-_, react-native-_, drizzle-orm, etc.)
3. Path aliases (@components, @database, @hooks, etc.)
4. Relative imports

**Path Aliases:**

```typescript
@components     → ./src/components
@database       → ./src/database
@hooks          → ./src/hooks
@screens        → ./src/screens
@strings        → ./strings
@services       → ./src/services
@plugins        → ./src/plugins
@utils          → ./src/utils
@theme          → ./src/theme
@navigators     → ./src/navigators
@api            → ./src/api
@type           → ./src/type
@specs          → ./specs
@native         → ./src/native
```

**Example:**

```typescript
import React from 'react';
import { useState, useCallback } from 'react';
import { eq, and, sql, inArray } from 'drizzle-orm';

import { fetchNovel } from '@services/plugin/fetch';
import { insertChapters } from './ChapterQueries';
import { showToast } from '@utils/showToast';
import { getString } from '@strings/translations';
import { BackupNovel, NovelInfo } from '../types';
import { SourceNovel } from '@plugins/types';
import { NOVEL_STORAGE } from '@utils/Storages';
import { dbManager } from '@database/db';
import { novelSchema } from '@database/schema';
```

## Error Handling

**Patterns:**

- Try-catch blocks for async operations with silent fail or toast notification:

```typescript
try {
  await downloadFile(
    sourceNovel.cover,
    novelCoverPath,
    getPlugin(pluginId)?.imageRequestInit,
  );
} catch {
  // Silently fail cover download
}
```

- Throw errors with user-friendly messages:

```typescript
const sourceNovel = await fetchNovel(pluginId, novelPath).catch(() => {
  throw new Error(getString('updatesScreen.unableToGetNovel'));
});
```

- Console error with dev-only flag:

```typescript
if (__DEV__) {
  console.error('teaser', error);
}
```

**Error Utilities:**

- Located in `src/utils/error.ts`
- Simple helper: `getErrorMessage(any)` - returns `any?.message || String(any)`

## Logging

**Framework:** console (with platform-specific handling)

**Patterns:**

- Development-only logging with `__DEV__` check:

```typescript
if (__DEV__) {
  console.trace('Toast: ', message);
}
```

- Console.error for errors with dev guard:

```typescript
if (__DEV__) console.error(e);
```

- Console logging disabled in production via ESLint rule (`no-console: error`)

## Comments

**When to Comment:**

- JSDoc for exported functions explaining purpose and parameters
- Region markers for code organization: `// #region name`, `// #endregion`
- Explain complex database transactions
- Document non-obvious behavior (e.g., "Silently fail cover download")

**JSDoc/TSDoc:**

- Used for function documentation:

```typescript
/**
 * Inserts a novel and its chapters into the database using Drizzle ORM.
 * Also handles downloading the novel cover if available.
 */
export const insertNovelAndChapters = async (...)
```

## Function Design

**Size:** Functions tend to be medium-sized with clear single responsibility. Complex operations are broken into smaller helper functions.

**Parameters:**

- Explicit typing required (TypeScript)
- Use objects for multiple related parameters:

```typescript
export const updateNovelInfo = async (info: NovelInfo) => {...}
```

**Return Values:**

- Always typed with Promise for async functions
- Return `undefined` when no result: `Promise<number | undefined>`
- Return `void` for mutations: `Promise<void>`

## Module Design

**Exports:**

- Named exports preferred for query modules
- Default exports for React components
- Barrel files (index.ts) for clean public APIs

**Barrel Files:**

- Used in most directories: `components/index.ts`, `hooks/index.ts`, `database/schema/index.ts`
- Provides clean import surface

## Component Patterns

**React Components:**

- Functional components with TypeScript
- Use `React.FC` for typing
- Wrap with `React.memo` for optimization:

```typescript
const Button: React.FC<ButtonProps> = props => {
  // component implementation
};
export default React.memo(Button);
```

- Use hooks for state management
- Destructure props for readability

## Database Patterns

**ORM:** Drizzle ORM

**Patterns:**

- Use `dbManager.write()` for mutations with transaction support:

```typescript
await dbManager.write(async tx => {
  tx.insert(novelSchema).values(novelData).run();
  tx.update(novelSchema).set({...}).where(...).run();
});
```

- Use `dbManager.select()` for queries
- Sync variants for read operations: `dbManager.getSync()`
- Conflict handling: `.onConflictDoNothing()`, `.onConflictDoUpdate()`

---

_Convention analysis: 2026-02-27_
