export const createNovelTriggerQueryInsert = `CREATE TRIGGER IF NOT EXISTS update_novel_stats 
AFTER INSERT ON Chapter
BEGIN
    UPDATE Novel
    SET 
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;

`;
export const createNovelTriggerQueryUpdate = `CREATE TRIGGER IF NOT EXISTS update_novel_stats_on_update 
AFTER UPDATE ON Chapter
BEGIN
    UPDATE Novel
    SET 
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = NEW.novelId;
END;
`;
export const createNovelTriggerQueryDelete = `CREATE TRIGGER IF NOT EXISTS update_novel_stats_on_delete 
AFTER DELETE ON Chapter
BEGIN
    UPDATE Novel
    SET 
        chaptersDownloaded = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.isDownloaded = 1),
        chaptersUnread = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id AND Chapter.unread = 1),
        totalChapters = (SELECT COUNT(*) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastReadAt = (SELECT MAX(readTime) FROM Chapter WHERE Chapter.novelId = Novel.id),
        lastUpdatedAt = (SELECT MAX(updatedTime) FROM Chapter WHERE Chapter.novelId = Novel.id)
    WHERE id = OLD.novelId;
END;
`;

export const createCategoryTriggerQuery = `
  CREATE TRIGGER IF NOT EXISTS add_category AFTER INSERT ON Category
  BEGIN
    UPDATE Category SET sort = (SELECT IFNULL(sort, new.id)) WHERE id = new.id;
  END;
`;