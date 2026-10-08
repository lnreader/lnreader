import { and, asc, eq } from 'drizzle-orm';

import { dbManager } from '@database/db';
import { castInt } from '@database/manager/manager';
import { chapterSchema } from '@database/schema';
import type { ChapterInfo } from '@database/types';
import { scanlatorFilterToSQL } from './ChapterQueries';

// In reading order, as `getNextChapter` walks them.
export const getReaderChapters = (
  novelId: number,
  excludedScanlators?: string[],
): Promise<ChapterInfo[]> =>
  dbManager
    .select()
    .from(chapterSchema)
    .where(
      and(
        eq(chapterSchema.novelId, novelId),
        scanlatorFilterToSQL(excludedScanlators),
      ),
    )
    .orderBy(
      asc(castInt(chapterSchema.page)),
      asc(castInt(chapterSchema.position)),
      asc(chapterSchema.id),
    )
    .all();
