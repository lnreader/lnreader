/**
 * Tests for RepositoryQueries
 *
 * These tests use a real in-memory database to verify actual data returned by queries.
 */

import './mockDb';
import { setupTestDatabase, getTestDb, teardownTestDatabase } from './setup';
import { insertTestRepository, clearAllTables } from './testData';

import {
  getRepositoriesFromDb,
  isRepoUrlDuplicated,
  createRepository,
  deleteRepositoryById,
  updateRepository,
} from '../RepositoryQueries';

describe('RepositoryQueries', () => {
  beforeEach(() => {
    const testDb = setupTestDatabase();
    clearAllTables(testDb);
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  describe('getRepositoriesFromDb', () => {
    it('should return all repositories', async () => {
      const testDb = getTestDb();

      await insertTestRepository(testDb, {
        url: 'https://repo1.example.com',
      });
      await insertTestRepository(testDb, {
        url: 'https://repo2.example.com',
      });
      await insertTestRepository(testDb, {
        url: 'https://repo3.example.com',
      });

      const result = await getRepositoriesFromDb();

      expect(result).toHaveLength(3);
      expect(result.map(r => r.url)).toEqual([
        'https://repo1.example.com',
        'https://repo2.example.com',
        'https://repo3.example.com',
      ]);
    });

    it('should return empty array when no repositories exist', async () => {
      const result = await getRepositoriesFromDb();

      expect(result).toEqual([]);
    });
  });

  describe('isRepoUrlDuplicated', () => {
    it('should return true when URL already exists', async () => {
      const testDb = getTestDb();

      await insertTestRepository(testDb, { url: 'https://example.com/repo' });

      const result = await isRepoUrlDuplicated('https://example.com/repo');

      expect(result).toBe(true);
    });

    it('should return false when URL does not exist', async () => {
      const testDb = getTestDb();

      await insertTestRepository(testDb, { url: 'https://example.com/repo1' });

      const result = await isRepoUrlDuplicated('https://example.com/repo2');

      expect(result).toBe(false);
    });

    it('should be case-sensitive for URLs', async () => {
      const testDb = getTestDb();

      await insertTestRepository(testDb, { url: 'https://example.com/repo' });

      const result = await isRepoUrlDuplicated('https://EXAMPLE.COM/repo');

      expect(result).toBe(false);
    });
  });

  describe('createRepository', () => {
    it('should create a new repository and return it', async () => {
      const result = await createRepository('https://example.com/repo');

      expect(result).toBeDefined();
      expect(result.url).toBe('https://example.com/repo');
      expect(result.id).toBeGreaterThan(0);
    });

    it('should store the URL exactly as provided', async () => {
      const url = 'https://example.com/repo/';
      const result = await createRepository(url);

      expect(result.url).toBe(url);
    });

    it('should handle URLs with query parameters', async () => {
      const url = 'https://example.com/repo?branch=main&format=json';
      const result = await createRepository(url);

      expect(result.url).toBe(url);
    });
  });

  describe('deleteRepositoryById', () => {
    it('should delete repository by ID', async () => {
      const testDb = getTestDb();

      const id = await insertTestRepository(testDb, {
        url: 'https://example.com/repo',
      });

      await deleteRepositoryById(id);

      const repositories = await getRepositoriesFromDb();
      expect(repositories).toHaveLength(0);
    });

    it('should handle deleting non-existent repository', async () => {
      await expect(deleteRepositoryById(999)).resolves.not.toThrow();
    });
  });

  describe('updateRepository', () => {
    it('should update repository URL', async () => {
      const testDb = getTestDb();

      const id = await insertTestRepository(testDb, {
        url: 'https://old-url.example.com',
      });

      await updateRepository(id, 'https://new-url.example.com');

      const repositories = await getRepositoriesFromDb();
      expect(repositories[0].url).toBe('https://new-url.example.com');
    });

    it('should update the correct repository by ID', async () => {
      const testDb = getTestDb();

      const id1 = await insertTestRepository(testDb, {
        url: 'https://repo1.example.com',
      });
      const id2 = await insertTestRepository(testDb, {
        url: 'https://repo2.example.com',
      });

      await updateRepository(id1, 'https://updated-repo1.example.com');

      const repositories = await getRepositoriesFromDb();
      const repo1 = repositories.find(r => r.id === id1);
      const repo2 = repositories.find(r => r.id === id2);

      expect(repo1?.url).toBe('https://updated-repo1.example.com');
      expect(repo2?.url).toBe('https://repo2.example.com');
    });

    it('should handle updating non-existent repository', async () => {
      await expect(
        updateRepository(999, 'https://example.com'),
      ).resolves.not.toThrow();
    });
  });
});
