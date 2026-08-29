import { and, eq, sql } from 'drizzle-orm';
import { dbManager } from '@database/db';
import { chapterTranslationSchema } from '@database/schema';

export interface ChapterTranslationKey {
  novelId: number;
  path: string;
  provider: string;
  sourceLanguage: string;
  targetLanguage: string;
}

const cacheKey = (key: ChapterTranslationKey) => ({
  novelId: key.novelId,
  path: key.path,
  provider: key.provider,
  sourceLanguage: key.sourceLanguage,
  targetLanguage: key.targetLanguage,
});

export const getChapterTranslationFromDb = async (
  key: ChapterTranslationKey,
): Promise<string[] | null> => {
  const row = await dbManager
    .select()
    .from(chapterTranslationSchema)
    .where(
      and(
        eq(chapterTranslationSchema.novelId, key.novelId),
        eq(chapterTranslationSchema.path, key.path),
        eq(chapterTranslationSchema.provider, key.provider),
        eq(chapterTranslationSchema.sourceLanguage, key.sourceLanguage),
        eq(chapterTranslationSchema.targetLanguage, key.targetLanguage),
      ),
    )
    .get();
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.paragraphs);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const upsertChapterTranslation = async (
  key: ChapterTranslationKey,
  paragraphs: string[],
): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .insert(chapterTranslationSchema)
      .values({
        ...cacheKey(key),
        paragraphs: JSON.stringify(paragraphs),
        updatedTime: sql`datetime('now','localtime')`,
      })
      .onConflictDoUpdate({
        target: [
          chapterTranslationSchema.novelId,
          chapterTranslationSchema.path,
          chapterTranslationSchema.provider,
          chapterTranslationSchema.sourceLanguage,
          chapterTranslationSchema.targetLanguage,
        ],
        set: {
          paragraphs: JSON.stringify(paragraphs),
          updatedTime: sql`datetime('now','localtime')`,
        },
      })
      .run();
  });
};

/** Drop every cached translation for a novel (e.g. before deletion). */
export const deleteChapterTranslationByNovel = async (
  novelId: number,
): Promise<void> => {
  await dbManager.write(async tx => {
    await tx
      .delete(chapterTranslationSchema)
      .where(eq(chapterTranslationSchema.novelId, novelId))
      .run();
  });
};
