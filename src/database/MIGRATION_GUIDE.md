# Drizzle ORM Migration Guide

This guide documents the migration from pure `expo-sqlite` to `expo-sqlite` with Drizzle ORM.

## Current Status

✅ **Completed:**
- Full Drizzle schema definitions in `/schema`
- Database manager system with query catalog in `/manager`
- Drizzle database instance available as `drizzleDb`
- Migration system supports both approaches

⏳ **In Progress:**
- Gradual migration of query functions to use Drizzle
- Both old and new systems work side-by-side

## Architecture Overview

### Three Layers

1. **Raw SQLite Layer** (`db`)
   - Legacy direct SQLite queries
   - Being phased out
   - Still used by existing query functions

2. **Drizzle ORM Layer** (`drizzleDb`)
   - Type-safe query builder
   - Use for all new code
   - Provides better TypeScript integration

3. **Manager Layer** (`dbManager`)
   - High-level query catalog
   - Built on Drizzle
   - Includes queuing and event system
   - Optional but recommended for complex operations

## Usage Examples

### Old Way (Raw SQL - Deprecated)

```typescript
import { db } from '@database/db';

// Raw SQL query
const novels = db.getAllSync('SELECT * FROM Novel WHERE inLibrary = 1');
```

### New Way (Drizzle ORM - Preferred)

```typescript
import { drizzleDb } from '@database/db';
import { novel } from '@database/schema';
import { eq } from 'drizzle-orm';

// Type-safe query
const novels = await drizzleDb
  .select()
  .from(novel)
  .where(eq(novel.inLibrary, true));
```

### Manager Way (Advanced - Optional)

```typescript
import { dbManager } from '@database/manager';

// Predefined query with events
const novels = await dbManager.execute('novelsByIds', { ids: [1, 2, 3] });

// Listen to events
const sub = dbManager.on('upsertNovel', 'after', ({ params, result }) => {
  console.log('Novel saved:', result?.id);
});
```

## Schema Location

All table schemas are defined in two places:

1. **Primary Location:** `/src/database/schema/`
   - `category.ts` - Category table
   - `novel.ts` - Novel table
   - `chapter.ts` - Chapter table
   - `novelCategory.ts` - Novel-Category junction table
   - `repository.ts` - Repository table
   - `index.ts` - Exports unified schema

2. **Manager Schema:** `/src/database/manager/schema.ts`
   - Identical to primary schema
   - Used by manager system
   - Consider consolidating in future

## Migration Checklist for Query Files

When migrating a query file:

- [ ] Import `drizzleDb` instead of `db`
- [ ] Import table schemas from `@database/schema`
- [ ] Import Drizzle operators (`eq`, `and`, `or`, `like`, etc.)
- [ ] Replace raw SQL strings with Drizzle query builder
- [ ] Update type annotations to use schema types
- [ ] Test thoroughly (especially edge cases)
- [ ] Consider adding to manager query catalog if reusable

## Common Patterns

### SELECT Queries

```typescript
// Old
db.getAllSync('SELECT * FROM Novel WHERE pluginId = ?', [pluginId]);

// New
await drizzleDb
  .select()
  .from(novel)
  .where(eq(novel.pluginId, pluginId));
```

### INSERT Queries

```typescript
// Old
db.runSync('INSERT INTO Category (name) VALUES (?)', [name]);

// New
await drizzleDb
  .insert(category)
  .values({ name });
```

### UPDATE Queries

```typescript
// Old
db.runSync('UPDATE Chapter SET unread = 0 WHERE id = ?', [chapterId]);

// New
await drizzleDb
  .update(chapter)
  .set({ unread: false })
  .where(eq(chapter.id, chapterId));
```

### DELETE Queries

```typescript
// Old
db.runSync('DELETE FROM Category WHERE id = ?', [categoryId]);

// New
await drizzleDb
  .delete(category)
  .where(eq(category.id, categoryId));
```

### Complex Queries with JOINs

```typescript
// Old
db.getAllSync(`
  SELECT Chapter.*, Novel.name as novelName 
  FROM Chapter 
  JOIN Novel ON Chapter.novelId = Novel.id
  WHERE Chapter.unread = 1
`);

// New
await drizzleDb
  .select({
    ...chapter,
    novelName: novel.name,
  })
  .from(chapter)
  .innerJoin(novel, eq(chapter.novelId, novel.id))
  .where(eq(chapter.unread, true));
```

## Migration Priority

Migrate in this order:

1. **High Priority** - Frequently used queries:
   - [ ] CategoryQueries.ts
   - [ ] NovelQueries.ts
   - [ ] ChapterQueries.ts

2. **Medium Priority** - Moderately used:
   - [ ] LibraryQueries.ts
   - [ ] HistoryQueries.ts

3. **Low Priority** - Rarely used:
   - [ ] RepositoryQueries.ts
   - [ ] StatsQueries.ts

## Database Manager

The manager system (`/database/manager/`) provides:

- **Query Catalog**: Predefined, named queries
- **Type Safety**: Full TypeScript inference
- **Event System**: Listen to query lifecycle
- **Queuing**: Prevents SQLITE_BUSY errors
- **Retry Logic**: Automatic retry on failure

### Adding Queries to Catalog

Edit `/database/manager/queries.ts`:

```typescript
export const queryCatalog = {
  // ... existing queries

  myNewQuery: defineQuery<{ novelId: number }, NovelRow>({
    id: 'myNewQuery',
    kind: 'read',
    description: 'Fetch novel by id',
    run: async ({ db }, { novelId }) => {
      return db
        .select()
        .from(novel)
        .where(eq(novel.id, novelId));
    },
  }),
};
```

## Database Initialization

The initialization in `db.ts` handles:

1. **PRAGMA settings** - Performance optimizations
2. **Schema creation** - For fresh installs (using raw SQL still)
3. **Migrations** - Version-based upgrades
4. **Drizzle setup** - ORM layer on top

Both `db` (raw) and `drizzleDb` (Drizzle) are available during transition.

## Best Practices

1. **Use Drizzle for new code** - Don't write new raw SQL
2. **Migrate incrementally** - Don't break existing functionality
3. **Add tests** - Especially for complex queries
4. **Use transactions** - For multi-step operations
5. **Leverage types** - Let TypeScript catch errors

## Transactions

```typescript
// Drizzle transactions
await drizzleDb.transaction(async (tx) => {
  await tx.insert(novel).values(novelData);
  await tx.insert(chapter).values(chapterData);
});
```

## Resources

- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)
- [Drizzle SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Drizzle Queries](https://orm.drizzle.team/docs/select)
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## Future Improvements

- [ ] Consolidate schema definitions (remove duplication)
- [ ] Migrate all query files to Drizzle
- [ ] Remove legacy raw SQL queries
- [ ] Use Drizzle migrations instead of custom system
- [ ] Consider removing `/tables` folder entirely
- [ ] Add Drizzle Studio for database inspection

## Questions?

If you're unsure how to migrate a specific query:
1. Check existing Drizzle queries in `/manager/queries.ts`
2. Refer to [Drizzle documentation](https://orm.drizzle.team)
3. Test with both approaches to ensure identical results