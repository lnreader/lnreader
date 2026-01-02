/**
 * Tests for ChapterQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';

import {
  markChapterRead,
  markChapterUnread,
  getNovelChapters,
  bookmarkChapter,
} from '../ChapterQueries';

describe('ChapterQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('markChapterRead', () => {
    it('should mark chapter as read', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: true,
      });

      await markChapterRead(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.unread).toBe(false);
    });
  });

  describe('markChapterUnread', () => {
    it('should mark chapter as unread', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        unread: false,
      });

      await markChapterUnread(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.unread).toBe(true);
    });
  });

  describe('bookmarkChapter', () => {
    it('should bookmark a chapter', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      const chapterId = await insertTestChapter(testDb, novelId, {
        bookmark: false,
      });

      await bookmarkChapter(chapterId);

      const chapters = await getNovelChapters(novelId);
      const chapter = chapters.find(c => c.id === chapterId);
      expect(chapter?.bookmark).toBe(true);
    });
  });

  describe('getNovelChapters', () => {
    it('should return all chapters for a novel', async () => {
      const testDb = getTestDb();

      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      await insertTestChapter(testDb, novelId, { name: 'Chapter 1' });
      await insertTestChapter(testDb, novelId, { name: 'Chapter 2' });

      const result = await getNovelChapters(novelId);

      expect(result).toHaveLength(2);
      expect(result.map(c => c.name)).toContain('Chapter 1');
      expect(result.map(c => c.name)).toContain('Chapter 2');
    });
  });
});
