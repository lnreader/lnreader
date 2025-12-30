import { eq } from 'drizzle-orm';
import { drizzleDb } from '@database/db';
import { repositorySchema, type RepositoryRow } from '@database/schema';

export const getRepositoriesFromDb = (): RepositoryRow[] => {
  return drizzleDb.select().from(repositorySchema).all();
};

export const isRepoUrlDuplicated = (repoUrl: string): boolean => {
  const result = drizzleDb
    .select({ count: repositorySchema.id })
    .from(repositorySchema)
    .where(eq(repositorySchema.url, repoUrl))
    .get();

  return !!result;
};

export const createRepository = (repoUrl: string): RepositoryRow => {
  const [row] = drizzleDb
    .insert(repositorySchema)
    .values({ url: repoUrl })
    .returning()
    .all();
  return row;
};

export const deleteRepositoryById = (id: number): void => {
  drizzleDb.delete(repositorySchema).where(eq(repositorySchema.id, id)).run();
};

export const updateRepository = (id: number, url: string): void => {
  drizzleDb
    .update(repositorySchema)
    .set({ url })
    .where(eq(repositorySchema.id, id))
    .run();
};
