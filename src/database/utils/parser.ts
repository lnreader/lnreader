import {
  CHAPTER_FILTER,
  CHAPTER_ORDER,
  ChapterFilterKey,
  ChapterOrderKey,
} from '@database/constants';
import { SQL, sql } from 'drizzle-orm';

export function chapterOrderToSQL(order: ChapterOrderKey) {
  const o = CHAPTER_ORDER[order] ?? CHAPTER_ORDER.positionAsc;
  return sql.raw(o);
}

export function chapterFilterToSQL(filter?: ChapterFilterKey[]) {
  if (!filter || !filter.length) return sql.raw('true');
  let filters: SQL | undefined;
  filter.forEach(value => {
    if (!filters) {
      filters = sql.raw(CHAPTER_FILTER[value]);
    } else {
      filters.append(sql.raw(` AND ${CHAPTER_FILTER[value]}`));
    }
  });
  return filters ?? sql.raw('true');
}
