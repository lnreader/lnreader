# Database Manager (Drizzle + queued sqlite)

## Usage
```ts
import { dbManager } from '@database/manager';

// execute a predefined query
await dbManager.execute('createCategory', { name: 'Favorites' });

// listen to query lifecycle events
const sub = dbManager.on('createCategory', 'after', ({ params, result }) => {
  console.log('category created', params.name, result?.id);
});

// fetch chapters
const chapters = await dbManager.execute('chaptersByNovel', { novelId: 1 });

// stop listening
sub.off();
```

## Why this design
- **Typesafe catalog**: Only queries defined in `queryCatalog` can run; params/results are inferred from Drizzle schema.
- **Queue for sync sqlite**: Single-flight queue with retries avoids `database is locked` errors on mobile.
- **Pluggable driver**: Default driver targets `expo-sqlite`; an `op-sqlite` adapter can be plugged via `createOpSqliteDriver`.
- **Listeners**: Subscribe to `before`, `after`, and `error` events per query id.

## Extending
Add new entries to `queryCatalog` in `queries.ts` using the `defineQuery` helper and Drizzle schema. Keep IDs stable to preserve listener contracts. Use the queue for any synchronous operations that could conflict with locks.

