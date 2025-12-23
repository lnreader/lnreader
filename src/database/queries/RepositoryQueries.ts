import { eq } from 'drizzle-orm';
import { drizzleDb } from '@database/db';
import { repository, type RepositoryRow } from '@database/schema';

export const getRepositoriesFromDb = (): RepositoryRow[] => {
  return drizzleDb.select().from(repository).all();
};

export const isRepoUrlDuplicated = (repoUrl: string): boolean => {
  const result = drizzleDb
    .select({ count: repository.id })
    .from(repository)
    .where(eq(repository.url, repoUrl))
    .get();

  return !!result;
};

export const createRepository = (repoUrl: string): RepositoryRow => {
  const [row] = drizzleDb
    .insert(repository)
    .values({ url: repoUrl })
    .returning()
    .all();
  return row;
};

export const deleteRepositoryById = (id: number): void => {
  drizzleDb.delete(repository).where(eq(repository.id, id)).run();
};

export const updateRepository = (id: number, url: string): void => {
  drizzleDb.update(repository).set({ url }).where(eq(repository.id, id)).run();
};
