# Drizzle ORM Migration Summary

This document tracks the migration from raw SQLite queries to Drizzle ORM.

## ✅ Completed Migrations

### CategoryQueries.ts
All functions have been migrated to use Drizzle ORM:
- ✅ `getCategoriesFromDb()` - Uses GROUP_CONCAT with LEFT JOIN
- ✅ `getCategoriesWithCount()` - Uses subquery for counting
- ✅ `createCategory()` - Uses insert with returning
- ✅ `deleteCategoryById()` - Uses transaction with proper novel reassignment
- ✅ `updateCategory()` - Uses update with where clause
- ✅ `isCategoryNameDuplicate()` - Uses select with where clause
- ✅ `updateCategoryOrderInDb()` - Uses transaction for batch updates
- ✅ `getAllNovelCategories()` - Uses select all
- ✅ `_restoreCategory()` - Uses transaction for backup restoration

## 🔄 Pending Migrations

### ChapterQueries.ts
**Priority: HIGH** - Many CRUD operations still using raw SQL

Functions using `db.runAsync()`:
- `markChapterRead()` - Line 73
- `markChapterUnread()` - Line 78
- `markAllChaptersRead()` - Line 93
- `markAllChaptersUnread()` - Line 96
- `deleteChapter()` - Line 118
- `updateChapterProgress()` - Line 167
- `updateChapterProgressByIds()` - Line 172
- `bookmarkChapter()` - Line 178
- `markPreviuschaptersRead()` - Line 184
- `markPreviousChaptersUnread()` - Line 190

Functions using `db.execAsync()`:
- `markChaptersRead()` - Line 78 (uses string interpolation for IN clause)
- `markChaptersUnread()` - Line 86 (uses string interpolation for IN clause)
- `deleteChapters()` - Line 138 (uses string interpolation for IN clause)
- `deleteDownloads()` - Line 149 (updates all chapters)
- `deleteReadChaptersFromDb()` - Line 160 (uses string interpolation for IN clause)
- `clearUpdates()` - Line 205 (updates all chapters)

Functions using `db.getAllSync()`:
- `getCustomPages()` - Line 211

Functions using `db.getAllAsync()`:
- `getNovelChapters()` - Line 217
- `getUnreadNovelChapters()` - Line 223
- `getAllUndownloadedChapters()` - Line 229
- `getAllUndownloadedAndUnreadChapters()` - Line 235
- `getPageChapters()` - Line 267
- `getPrevChapter()` - Line 296
- `getNextChapter()` - Line 315
- `getReadDownloadedChapters()` - Line 334
- `getDownloadedChapters()` - Line 341
- `getNovelDownloadedChapters()` - Line 357
- `getUpdatedOverviewFromDb()` - Line 372
- `getDetailedUpdatesFromDb()` - Line 399

Functions using `db.getFirstAsync()`:
- `getChapter()` - Line 241

Functions using `db.getFirstSync()`:
- `getChapterCount()` - Line 275

Functions using `db.getAllSync()`:
- `getPageChaptersBatched()` - Line 288

Functions using `db.withExclusiveTransactionAsync()`:
- `insertChapters()` - Line 25 (complex transaction with conditional inserts/updates)

Functions using `isChapterDownloaded()`:
- `isChapterDownloaded()` - Line 423 (uses getFirstSync)

### NovelQueries.ts
**Priority: HIGH** - Core novel management functions

Functions using `db.runSync()`:
- `insertNovelAndChapters()` - Line 27 (also calls runSync via helpers)

Functions using helpers (wrapping raw SQL):
- `getAllNovels()` - Uses `getAllAsync()` helper
- `getNovelById()` - Uses `getFirstAsync()` helper
- `getNovelByPath()` - Uses `getFirstSync()` helper - Line 81
- `switchNovelToLibraryQuery()` - Uses `runAsync()` helper
- `removeNovelsFromLibrary()` - Uses `runSync()` helper - Line 146
- `updateNovelCategories()` - Uses `runSync()` helper - Line 300

### LibraryQueries.ts
**Priority: MEDIUM** - Select queries for library view

Functions using helpers:
- `getLibraryNovelsFromDb()` - Uses `getAllSync()` helper with complex WHERE clause
- `getLibraryWithCategory()` - Uses `getAllSync()` helper with subquery

### HistoryQueries.ts
**Priority: MEDIUM** - History tracking

Functions using `db.getAllAsync()`:
- `getHistoryFromDb()` - Line 7 (complex JOIN with GROUP BY and HAVING)

Functions using `db.execAsync()`:
- `deleteAllHistory()` - Line 28

### db.ts
**Priority: LOW** - Database initialization (some functions should remain as raw SQL)

Functions using raw SQL (consider keeping for initialization):
- `setPragmas()` - Line 45 (uses `db.execSync()` for PRAGMA commands)
- `populateDatabase()` - Line 57 (uses `db.runSync()`)
- `recreateDatabaseIndexes()` - Line 81 (uses `db.execSync()` and transaction)

### downloadChapter.ts (src/services/download/)
**Priority: LOW** - Single query

Functions using `db.runSync()`:
- `downloadChapter()` - Line 87

### LibraryUpdateQueries.ts (src/services/updates/)
**Priority: LOW** - Update metadata

Functions using `db.runSync()`:
- `updateNovelMetadata()` - Line 26
- `updateNovelTotalPages()` - Line 48

### migrations/002_add_novel_counters.ts
**Priority: LOW** - Migration file (should remain as raw SQL)

Keep as-is - migration files should use raw SQL.

## 🎯 Migration Strategy

### Phase 1: CategoryQueries.ts ✅
- **Status**: COMPLETED
- All functions migrated to Drizzle ORM

### Phase 2: Simple CRUD Operations (HIGH PRIORITY)
**Target Files**: ChapterQueries.ts, NovelQueries.ts

#### Simple Updates (No Joins)
1. `markChapterRead()` - Convert to `drizzleDb.update(chapter).set({unread: false}).where(eq(chapter.id, chapterId))`
2. `markChapterUnread()` - Similar pattern
3. `updateChapterProgress()` - Update with single where clause
4. `bookmarkChapter()` - Update with CASE expression in SQL

#### Batch Updates with IN Clauses
1. `markChaptersRead()` - Convert to use `inArray()` operator
2. `markChaptersUnread()` - Use `inArray()` operator
3. `deleteChapters()` - Use `inArray()` operator

#### Simple Selects
1. `getChapter()` - Convert to `drizzleDb.select().from(chapter).where(eq(chapter.id, id)).get()`
2. `getNovelChapters()` - Select with single where clause
3. `getCustomPages()` - Select distinct with where

### Phase 3: Complex Queries with Joins (MEDIUM PRIORITY)
**Target Files**: ChapterQueries.ts, LibraryQueries.ts, HistoryQueries.ts

#### Queries with JOINs
1. `getDownloadedChapters()` - LEFT JOIN Novel
2. `getUpdatedOverviewFromDb()` - JOIN with GROUP BY and DATE function
3. `getDetailedUpdatesFromDb()` - JOIN with WHERE clause
4. `getHistoryFromDb()` - JOIN with GROUP BY and HAVING

#### Queries with Complex WHERE Clauses
1. `getLibraryNovelsFromDb()` - Dynamic WHERE clause building
2. `getPrevChapter()` - Complex OR conditions with page comparison
3. `getNextChapter()` - Similar to getPrevChapter

### Phase 4: Transactions (MEDIUM PRIORITY)
**Target Files**: NovelQueries.ts, ChapterQueries.ts

1. `insertChapters()` - Complex transaction with conditional logic
2. `insertNovelAndChapters()` - Multi-step transaction

### Phase 5: Low Priority
**Target Files**: db.ts, downloadChapter.ts, LibraryUpdateQueries.ts

- Migration of initialization code
- Single-query utilities

## 📋 Migration Patterns

### Pattern 1: Simple Update
```typescript
// Before (raw SQL)
db.runAsync('UPDATE Chapter SET unread = 0 WHERE id = ?', chapterId);

// After (Drizzle)
drizzleDb.update(chapter).set({ unread: false }).where(eq(chapter.id, chapterId)).run();
```

### Pattern 2: Update with IN Clause
```typescript
// Before (raw SQL with string interpolation - UNSAFE)
db.execAsync(`UPDATE Chapter SET unread = 0 WHERE id IN (${chapterIds.join(',')})`);

// After (Drizzle - SAFE)
drizzleDb.update(chapter).set({ unread: false }).where(inArray(chapter.id, chapterIds)).run();
```

### Pattern 3: Simple Select
```typescript
// Before (raw SQL)
db.getFirstAsync('SELECT * FROM Chapter WHERE id = ?', chapterId);

// After (Drizzle)
drizzleDb.select().from(chapter).where(eq(chapter.id, chapterId)).get();
```

### Pattern 4: Select with JOIN
```typescript
// Before (raw SQL)
db.getAllAsync(`
  SELECT Chapter.*, Novel.pluginId, Novel.name as novelName
  FROM Chapter
  JOIN Novel ON Chapter.novelId = Novel.id
  WHERE Chapter.isDownloaded = 1
`);

// After (Drizzle)
drizzleDb
  .select({
    ...chapter,
    pluginId: novel.pluginId,
    novelName: novel.name,
  })
  .from(chapter)
  .innerJoin(novel, eq(chapter.novelId, novel.id))
  .where(eq(chapter.isDownloaded, true))
  .all();
```

### Pattern 5: Subquery
```typescript
// Before (raw SQL)
const query = `
  SELECT Category.*, NC.novelsCount
  FROM Category LEFT JOIN
  (SELECT categoryId, COUNT(novelId) as novelsCount
   FROM NovelCategory WHERE novelId in (${novelIds.join(',')})
   GROUP BY categoryId
  ) as NC ON Category.id = NC.categoryId
`;

// After (Drizzle)
const subquery = drizzleDb
  .select({
    categoryId: novelCategory.categoryId,
    novelsCount: sql`COUNT(${novelCategory.novelId})`.as('novelsCount'),
  })
  .from(novelCategory)
  .where(inArray(novelCategory.novelId, novelIds))
  .groupBy(novelCategory.categoryId)
  .as('NC');

drizzleDb
  .select({
    ...category,
    novelsCount: subquery.novelsCount,
  })
  .from(category)
  .leftJoin(subquery, eq(category.id, subquery.categoryId))
  .all();
```

## ⚠️ Important Notes

1. **String Interpolation is Unsafe**: Many queries use string interpolation for IN clauses (e.g., `WHERE id IN (${ids.join(',')})`). This is a SQL injection risk. Drizzle's `inArray()` operator handles this safely.

2. **Boolean Conversion**: SQLite uses integers (0/1) for booleans. The schema defines these as `{ mode: 'boolean' }`, so Drizzle handles the conversion automatically.

3. **Transactions**: For multi-step operations, use `drizzleDb.transaction()` to ensure atomicity.

4. **Async/Sync Methods**: 
   - Drizzle uses `.all()` for multiple rows
   - `.get()` for single row
   - `.run()` for mutations without returning data
   - `.values()` for raw values

5. **SQL Template Literals**: For complex SQL expressions not supported by Drizzle's type-safe API, use `sql` template literals: `sql\`COUNT(${column})\``

## 🧪 Testing Checklist

For each migrated function:
- [ ] Verify query results match original implementation
- [ ] Test with empty result sets
- [ ] Test with NULL values
- [ ] Test transaction rollback on errors
- [ ] Verify performance is comparable or better
- [ ] Check that SQL injection vulnerabilities are eliminated
- [ ] Ensure type safety is maintained

## 📚 Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Query API](https://orm.drizzle.team/docs/rqb)
- [SQLite in Drizzle](https://orm.drizzle.team/docs/get-started-sqlite)