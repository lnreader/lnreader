import { eq } from 'drizzle-orm';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';
import {
  computeNovelSchedule,
  shouldRecomputeSchedule,
  startOfLocalDay,
  toLocalDay,
} from './releaseSchedule';

/**
 * Works out a novel's release schedule again after a successful fetch, or when it joins the library.
 *
 * @param foundRelease whether the fetch found new chapters for a novel that already had some.
 * @param manual whether the user asked for this fetch, which always recomputes.
 */
export const updateNovelSchedule = async (
  novelId: number,
  { foundRelease = false, manual = false } = {},
) => {
  const novel = await dbManager
    .select({
      fetchInterval: novelSchema.fetchInterval,
      nextUpdate: novelSchema.nextUpdate,
      lastUpdatedAt: novelSchema.lastUpdatedAt,
      isLocal: novelSchema.isLocal,
    })
    .from(novelSchema)
    .where(eq(novelSchema.id, novelId))
    .get();
  if (!novel || novel.isLocal) {
    return;
  }

  const today = toLocalDay(new Date());
  const state = {
    fetchInterval: novel.fetchInterval ?? 0,
    nextUpdate: novel.nextUpdate,
    lastUpdatedAt: novel.lastUpdatedAt,
  };
  if (!shouldRecomputeSchedule(state, today, { foundRelease, manual })) {
    return;
  }

  const chapters = await dbManager
    .select({
      releaseTime: chapterSchema.releaseTime,
      updatedTime: chapterSchema.updatedTime,
    })
    .from(chapterSchema)
    .where(eq(chapterSchema.novelId, novelId))
    .all();
  const { fetchInterval, nextUpdate } = computeNovelSchedule(
    state,
    chapters,
    today,
    foundRelease,
  );

  await dbManager.write(async tx => {
    await tx
      .update(novelSchema)
      .set({
        fetchInterval,
        nextUpdate: startOfLocalDay(nextUpdate).toISOString(),
      })
      .where(eq(novelSchema.id, novelId))
      .run();
  });
};
