# Database Module

This module manages all database operations for LNReader using SQLite with Drizzle ORM.

> **✅ Migration Status:** Foundation Complete - Ready for incremental migration to Drizzle ORM  
> **📖 See:** [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) for full details

## 📁 Directory Structure

```
database/
├── schema/              # Drizzle ORM table schemas
│   ├── category.ts
│   ├── chapter.ts
│   ├── novel.ts
│   ├── novelCategory.ts
│   ├── repository.ts
│   └── index.ts        # Unified schema export
├── queries/            # Query functions for data operations
│   ├── CategoryQueries.ts
│   ├── ChapterQueries.ts
│   ├── HistoryQueries.ts
│   ├── LibraryQueries.ts
│   ├── NovelQueries.ts
│   ├── RepositoryQueries.ts ✅ (Fully migrated to Drizzle)
│   └── StatsQueries.ts
├── manager/            # Advanced query catalog system
│   ├── driver/         # Database drivers (expo-sqlite, op-sqlite)
│   ├── schema.ts       # Schema definitions (mirrors /schema)
│   ├── queries.ts      # Predefined query catalog
│   ├── manager.ts      # Query manager with events & queuing
│   ├── events.ts       # Event system
│   ├── queue.ts        # Task queue
│   └── types.ts        # Type definitions
├── migrations/         # Database version migrations
│   ├── 002_add_novel_counters.ts
│   ├── index.ts
│   └── README.md
├── tables/             # 🚫 DEPRECATED: Raw SQL table definitions
│   ├── CategoryTable.ts
│   ├── ChapterTable.ts
│   ├── NovelTable.ts
│   ├── NovelCategoryTable.ts
│   └── RepositoryTable.ts
├── types/              # TypeScript type definitions
│   ├── index.ts
│   └── migration.ts
├── utils/              # Utility functions
│   ├── helpers.tsx     # Query helper wrappers
│   ├── migrationRunner.ts
│   └── convertDateToISOString.ts
├── db.ts               # Database initialization & exports
├── README.md           # This file
└── MIGRATION_GUIDE.md  # Detailed migration guide

```

## 🚀 Quick Start

### Using Drizzle ORM (Recommended)

```typescript
import { drizzleDb } from '@database/db';
import { novel, chapter } from '@database/schema';
import { eq, and } from 'drizzle-orm';

// Select with type safety
const novels = await drizzleDb
  .select()
  .from(novel)
  .where(eq(novel.inLibrary, true));

// Insert
await drizzleDb
  .insert(chapter)
  .values({
    novelId: 1,
    path: '/chapter-1',
    name: 'Chapter 1',
  });

// Update
await drizzleDb
  .update(chapter)
  .set({ unread: false })
  .where(eq(chapter.id, chapterId));

// Delete
await drizzleDb
  .delete(novel)
  .where(eq(novel.id, novelId));
```

### Using Database Manager (Advanced)

```typescript
import { dbManager } from '@database/manager';

// Execute predefined queries
const categories = await dbManager.execute('listCategories');
const novel = await dbManager.execute('upsertNovel', { 
  name: 'My Novel',
  path: '/my-novel',
  pluginId: 'plugin-id'
});

// Listen to events
const subscription = dbManager.on('createCategory', 'after', ({ result }) => {
  console.log('Category created:', result?.id);
});
```

## 📊 Database Schema

### Tables

#### **Category**
Organizes novels into collections (e.g., "Favorites", "Reading")
- `id` - Primary key
- `name` - Category name (unique)
- `sort` - Display order

#### **Novel**
Stores novel metadata
- `id` - Primary key
- `path` - Novel path (unique with pluginId)
- `pluginId` - Source plugin identifier
- `name` - Novel title
- `cover` - Cover image URL/path
- `summary` - Novel description
- `author`, `artist` - Creator information
- `status` - Publication status
- `genres` - Comma-separated genres
- `inLibrary` - Whether novel is in user's library
- `isLocal` - Whether novel is stored locally
- `totalPages` - Number of pages
- `chaptersDownloaded`, `chaptersUnread`, `totalChapters` - Statistics
- `lastReadAt`, `lastUpdatedAt` - Timestamps

#### **Chapter**
Stores chapter information
- `id` - Primary key
- `novelId` - Foreign key to Novel
- `path` - Chapter path (unique with novelId)
- `name` - Chapter title
- `releaseTime` - Publication date
- `bookmark` - Bookmarked flag
- `unread` - Unread flag
- `readTime` - Last read timestamp
- `isDownloaded` - Download status
- `updatedTime` - Last update timestamp
- `chapterNumber` - Chapter number (float for decimals)
- `page` - Page identifier
- `position` - Sort position
- `progress` - Reading progress

#### **NovelCategory**
Junction table linking novels to categories
- `id` - Primary key
- `novelId` - Foreign key to Novel
- `categoryId` - Foreign key to Category

#### **Repository**
Plugin repository URLs
- `id` - Primary key
- `url` - Repository URL (unique)

## 🔄 Migration Status

> **📊 Overall Progress: 30% Complete (Foundation)**

### ✅ Phase 1: Foundation (100% Complete)
- ✅ Full Drizzle schema definitions for all tables
- ✅ Drizzle ORM integration in `db.ts`
- ✅ Database manager with query catalog (9 queries)
- ✅ Migration system (version-based upgrades)
- ✅ Example migrations (RepositoryQueries 100%, CategoryQueries 50%)
- ✅ Comprehensive documentation (4 new docs)
- ✅ All TypeScript errors resolved

### ⏳ Phase 2: Query Migration (12% Complete)
- ✅ **RepositoryQueries.ts** - 100% Complete
- 🔄 **CategoryQueries.ts** - 50% Complete (4/9 functions)
- ⏳ **NovelQueries.ts** - Not Started (14 functions)
- ⏳ **ChapterQueries.ts** - Not Started (34 functions)
- ⏳ **LibraryQueries.ts** - Not Started (2 functions)
- ⏳ **HistoryQueries.ts** - Not Started (4 functions)
- ⏳ **StatsQueries.ts** - Not Started (7 functions)

**Total:** 9 of 75 functions migrated

### 📋 Phase 3: Cleanup (Future)
- [ ] Remove `/tables` directory after full migration
- [ ] Consolidate schema definitions (remove duplication with `/manager/schema.ts`)
- [ ] Update all imports to use Drizzle functions
- [ ] Remove deprecated functions
- [ ] Add comprehensive tests for migrated queries

### 📖 Detailed Status
See [MIGRATION_STATUS.md](./MIGRATION_STATUS.md) for detailed tracking and [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md) for what's been accomplished.

## 🎯 Best Practices

### For New Code
1. **Always use Drizzle ORM** - Import `drizzleDb` from `@database/db`
2. **Use schema types** - Import types from `@database/schema`
3. **Leverage TypeScript** - Let the compiler catch errors
4. **Use transactions** - For multi-step operations
5. **Add to query catalog** - If query is reusable across app

### For Existing Code
1. **Don't break functionality** - Test thoroughly before migrating
2. **Migrate incrementally** - One function at a time
3. **Keep deprecated functions** - Mark with `@deprecated` JSDoc
4. **Create Drizzle alternatives** - Add new functions with `Drizzle` suffix
5. **Update consumers gradually** - Let both versions coexist

## 📚 Documentation

### Core Documentation
- **[README.md](./README.md)** - This file - Overview and quick start
- **[MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)** - Complete migration guide with examples
- **[MIGRATION_STATUS.md](./MIGRATION_STATUS.md)** - Detailed progress tracker
- **[MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)** - What's been accomplished

### System Documentation
- **[manager/README.md](./manager/README.md)** - Using the database manager system
- **[migrations/README.md](./migrations/README.md)** - How to add database migrations

## 🔗 External Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle SQLite Guide](https://orm.drizzle.team/docs/get-started-sqlite)
- [expo-sqlite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)

## 🤝 Contributing

When adding new features:

1. Define schema in `/schema` (or use existing)
2. Write queries using Drizzle ORM
3. Consider adding to manager query catalog for reusability
4. Add JSDoc comments
5. Include TypeScript types
6. Test edge cases

When migrating existing code:

1. Read [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
2. Create Drizzle version alongside legacy version
3. Mark legacy version as `@deprecated`
4. Update imports in consuming code
5. Test for behavior parity
6. Remove legacy version after full migration

## 💡 Examples

See these files for migration examples:
- `queries/RepositoryQueries.ts` - Fully migrated ✅
- `queries/CategoryQueries.ts` - Partial migration with both approaches
- `manager/queries.ts` - Query catalog examples

## ⚠️ Important Notes

- **Do NOT** write new raw SQL queries - use Drizzle
- **Keep both systems working** during migration period
- **Test thoroughly** - SQL behavior can be subtle
- **The `/tables` directory is deprecated** - don't add to it
- **Use transactions** for operations that modify multiple tables
- **Foreign key constraints are enabled** - respect referential integrity