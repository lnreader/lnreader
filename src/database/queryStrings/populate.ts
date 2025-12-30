import { getString } from '@strings/translations';

// if category with id = 2 exists, nothing in db.ts file is executed
export const createCategoryDefaultQuery = `
INSERT OR IGNORE INTO Category (id, name, sort) VALUES 
  (1, "${getString('categories.default')}", 1),
  (2, "${getString('categories.local')}", 2)
`;