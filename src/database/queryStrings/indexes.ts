
export const createNovelIndexQuery = `
    CREATE INDEX
    IF NOT EXISTS
    NovelIndex ON Novel(pluginId, path, id, inLibrary);
`;

export const dropNovelIndexQuery = `
    DROP INDEX IF EXISTS NovelIndex;
`;



export const createChapterIndexQuery = `
    CREATE INDEX
    IF NOT EXISTS
    chapterNovelIdIndex ON Chapter(novelId, position,page, id)
`;

export const dropChapterIndexQuery = `
    DROP INDEX IF EXISTS chapterNovelIdIndex;
`;