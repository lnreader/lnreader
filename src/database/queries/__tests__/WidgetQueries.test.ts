/**
 * Tests for WidgetQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import dayjs from 'dayjs';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestNovel, insertTestChapter, clearAllTables } from './testData';

import {
  getRandomLibraryNovelFromDb,
  getWidgetReadDaysFromDb,
  getWidgetReadingFromDb,
  getWidgetUpdatesCountFromDb,
  getWidgetUpdatesFromDb,
} from '../WidgetQueries';

const localTime = (daysAgo: number, time = '12:00:00') =>
  `${dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD')} ${time}`;

describe('WidgetQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getWidgetReadingFromDb', () => {
    it('returns the latest read chapter of each novel, newest first', async () => {
      const testDb = getTestDb();
      const older = await insertTestNovel(testDb, { name: 'Older' });
      const newer = await insertTestNovel(testDb, { name: 'Newer' });

      await insertTestChapter(testDb, older, {
        name: 'First',
        readTime: localTime(3),
      });
      const latestOfOlder = await insertTestChapter(testDb, older, {
        name: 'The Lantern Under Frost',
        chapterNumber: 412,
        readTime: localTime(1),
        progress: 40,
      });
      const latestOfNewer = await insertTestChapter(testDb, newer, {
        name: 'Noon, Again',
        readTime: localTime(0),
      });
      await insertTestChapter(testDb, newer, { name: 'Never opened' });

      const result = await getWidgetReadingFromDb(4);

      expect(result.map(r => r.chapterId)).toEqual([
        latestOfNewer,
        latestOfOlder,
      ]);
      expect(result[1]).toMatchObject({
        novelName: 'Older',
        chapterName: 'The Lantern Under Frost',
        chapterNumber: 412,
        // Maintained by the Chapter insert trigger.
        totalChapters: 2,
        progress: 40,
      });
    });

    it('respects the limit', async () => {
      const testDb = getTestDb();
      for (let i = 0; i < 6; i++) {
        const novelId = await insertTestNovel(testDb);
        await insertTestChapter(testDb, novelId, { readTime: localTime(i) });
      }

      expect(await getWidgetReadingFromDb(4)).toHaveLength(4);
    });
  });

  describe('getWidgetUpdatesFromDb', () => {
    it('returns unread updated chapters of library novels, newest first', async () => {
      const testDb = getTestDb();
      const library = await insertTestNovel(testDb, { inLibrary: true });
      const notInLibrary = await insertTestNovel(testDb, { inLibrary: false });

      const older = await insertTestChapter(testDb, library, {
        updatedTime: '2026-11-20T08:00:00.000Z',
      });
      const newest = await insertTestChapter(testDb, library, {
        updatedTime: '2026-11-21T08:00:00.000Z',
      });
      await insertTestChapter(testDb, library, {
        updatedTime: '2026-11-21T09:00:00.000Z',
        unread: false,
      });
      await insertTestChapter(testDb, library, { updatedTime: null });
      await insertTestChapter(testDb, notInLibrary, {
        updatedTime: '2026-11-21T10:00:00.000Z',
      });

      const result = await getWidgetUpdatesFromDb(6);

      expect(result.map(r => r.chapterId)).toEqual([newest, older]);
      expect(await getWidgetUpdatesCountFromDb()).toBe(2);
    });

    it('counts every unread update even when the list is limited', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb, { inLibrary: true });
      for (let i = 0; i < 9; i++) {
        await insertTestChapter(testDb, novelId, {
          updatedTime: `2026-11-21T0${i}:00:00.000Z`,
        });
      }

      expect(await getWidgetUpdatesFromDb(6)).toHaveLength(6);
      expect(await getWidgetUpdatesCountFromDb()).toBe(9);
    });
  });

  describe('getWidgetReadDaysFromDb', () => {
    it('counts chapters per local day inside the window', async () => {
      const testDb = getTestDb();
      const novelId = await insertTestNovel(testDb);
      await insertTestChapter(testDb, novelId, {
        readTime: localTime(0, '08:00:00'),
      });
      await insertTestChapter(testDb, novelId, {
        readTime: localTime(0, '21:30:00'),
      });
      await insertTestChapter(testDb, novelId, { readTime: localTime(2) });
      await insertTestChapter(testDb, novelId, { readTime: localTime(90) });

      const result = await getWidgetReadDaysFromDb(60);
      const byDay = Object.fromEntries(result.map(r => [r.day, r.chapters]));

      expect(byDay).toEqual({
        [dayjs().format('YYYY-MM-DD')]: 2,
        [dayjs().subtract(2, 'day').format('YYYY-MM-DD')]: 1,
      });
    });
  });

  describe('getRandomLibraryNovelFromDb', () => {
    it('only picks novels in the library', async () => {
      const testDb = getTestDb();
      await insertTestNovel(testDb, { inLibrary: false });
      const libraryNovel = await insertTestNovel(testDb, { inLibrary: true });

      expect((await getRandomLibraryNovelFromDb())?.id).toBe(libraryNovel);
    });

    it('returns undefined for an empty library', async () => {
      expect(await getRandomLibraryNovelFromDb()).toBeUndefined();
    });
  });
});
