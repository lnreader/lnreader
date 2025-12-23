# Database Manager (Drizzle + Queued SQLite)

The Database Manager is an advanced layer built on top of Drizzle ORM that provides a type-safe query catalog, event system, and task queuing for reliable database operations.

## Overview

The manager system is part of the migration from pure `expo-sqlite` to `expo-sqlite` + Drizzle ORM. It provides:

- **Query Catalog**: Predefined, named queries with full type inference
- **Event System**: Listen to query lifecycle events (before, after, error)
- **Task Queue**: Prevents `SQLITE_BUSY` errors with single-flight queuing
- **Retry Logic**: Automatic retries with exponential backoff
- **Driver Abstraction**: Support for both `expo-sqlite` and `op-sqlite`

## Quick Start

```ts
import { dbManager } from '@database/manager';

// Execute a predefined query
await dbManager.execute('createCategory', { name: 'Favorites' });

// Listen to query lifecycle events
const sub = dbManager.on('createCategory', 'after', ({ params, result }) => {
  console.log('category created', params.name, result?.id);
});

// Fetch chapters
const chapters = await dbManager.execute('chaptersByNovel', { novelId: 1 });

// Stop listening
sub.off();
```

## Available Queries

Current queries in the catalog (`queries.ts`):

- `createCategory` - Insert a new category
- `listCategories` - List categories with novel counts
- `upsertNovel` - Insert or update a novel
- `insertChapters` - Batch insert chapters
- `chaptersByNovel` - Fetch chapters for a novel
- `markChapterProgress` - Update chapter progress
- `attachNovelToCategories` - Link novel to categories
- `novelsByIds` - Fetch novels by IDs
- `registerRepository` - Register a plugin repository

## Why This Design?

### Type Safety
Only queries defined in `queryCatalog` can run. TypeScript infers params and results from the Drizzle schema automatically.

```ts
// ✅ Type-safe - TypeScript knows the shape
const novel = await dbManager.execute('upsertNovel', {
  name: 'My Novel',
  path: '/novel',
  pluginId: 'plugin-id'
});

// ❌ Type error - unknown query
await dbManager.execute('unknownQuery', {});

// ❌ Type error - invalid params
await dbManager.execute('createCategory', { invalidParam: true });
```

### Queue for Sync SQLite
Single-flight queue with retries avoids `database is locked` errors on mobile. All queries go through the queue to prevent concurrent access issues.

### Pluggable Driver
Default driver targets `expo-sqlite`. An `op-sqlite` adapter can be plugged via `createOpSqliteDriver` for better performance.

### Event Listeners
Subscribe to `before`, `after`, and `error` events per query ID. Useful for logging, analytics, and side effects.

```ts
// Log all category creations
dbManager.on('createCategory', 'after', ({ result }) => {
  console.log('New category ID:', result?.id);
});

// Handle errors
dbManager.on('upsertNovel', 'error', ({ error }) => {
  console.error('Failed to save novel:', error);
});
```

## Adding New Queries

Add new entries to `queryCatalog` in `queries.ts` using the `defineQuery` helper:

```ts
import { defineQuery } from './types';
import { novel } from './schema';
import { eq } from 'drizzle-orm';

export const queryCatalog = {
  // ... existing queries

  deleteNovel: defineQuery<{ id: number }, { deleted: boolean }>({
    id: 'deleteNovel',
    kind: 'write',
    description: 'Delete a novel by ID',
    run: async ({ db }, { id }) => {
      await db.delete(novel).where(eq(novel.id, id));
      return { deleted: true };
    },
  }),
};
```

**Important:** Keep query IDs stable to preserve listener contracts across app updates.

## Architecture

```
┌─────────────────┐
│   Your Code     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   DbManager     │ ← Query catalog, event bus
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Task Queue    │ ← Single-flight concurrency
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Drizzle ORM    │ ← Type-safe query builder
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  expo-sqlite    │ ← Raw SQLite database
└─────────────────┘
```

## Migration Context

The manager is part of a broader migration strategy:

1. **Legacy Layer** (`/queries/*.ts`) - Raw SQL queries being phased out
2. **Drizzle Layer** (`drizzleDb`) - Direct Drizzle ORM usage (recommended for most cases)
3. **Manager Layer** (`dbManager`) - High-level catalog for complex operations

Choose the right layer:
- Use **Manager** for: Reusable operations, event-driven logic, complex transactions
- Use **Drizzle** for: Simple CRUD, one-off queries, straightforward operations
- Avoid **Legacy** for: New code (use only during migration)

See [../MIGRATION_GUIDE.md](../MIGRATION_GUIDE.md) for detailed migration instructions.

## Examples

### Basic CRUD

```ts
// Create
const category = await dbManager.execute('createCategory', { 
  name: 'Reading' 
});

// Read
const categories = await dbManager.execute('listCategories');

// Update (via upsert)
const novel = await dbManager.execute('upsertNovel', {
  path: '/novel',
  pluginId: 'plugin-id',
  name: 'Updated Title'
});
```

### Batch Operations

```ts
// Insert multiple chapters at once
await dbManager.execute('insertChapters', {
  novelId: 1,
  chapters: [
    { path: '/ch1', name: 'Chapter 1', position: 0 },
    { path: '/ch2', name: 'Chapter 2', position: 1 },
    { path: '/ch3', name: 'Chapter 3', position: 2 },
  ]
});
```

### Event-Driven Logic

```ts
// Sync categories to cloud after creation
dbManager.on('createCategory', 'after', async ({ result }) => {
  await syncToCloud('category', result);
});

// Analytics
dbManager.on('upsertNovel', 'after', ({ params }) => {
  analytics.track('novel_saved', { pluginId: params.pluginId });
});
```

## Configuration

```ts
import { createDatabaseManager } from '@database/manager';

const dbManager = createDatabaseManager({
  queue: {
    concurrency: 1, // Keep at 1 for sync SQLite
    retry: {
      maxRetries: 3,
      backoffMs: 100,
      retryOnMessageIncludes: ['SQLITE_BUSY', 'database is locked'],
    },
  },
  expo: {
    dbName: 'lnreader.db',
    applyPragmas: true, // Enable WAL, foreign keys, etc.
  },
});
```

## Best Practices

1. **Keep queries focused** - One query should do one thing well
2. **Use transactions** - For multi-step operations
3. **Batch when possible** - Insert many rows at once
4. **Handle errors** - Use error event listeners
5. **Document queries** - Add description to each query
6. **Test thoroughly** - Especially for complex queries

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team)
- [expo-sqlite Docs](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Migration Guide](../MIGRATION_GUIDE.md)
- [Database README](../README.md)

