import {
  CHAPTER_FILTER,
  CHAPTER_ORDER,
  ChapterFilterKey,
  ChapterOrderKey,
} from '@database/constants';
import { sql } from 'drizzle-orm';

export function chapterOrderToSQL(order: ChapterOrderKey) {
  const o = CHAPTER_ORDER[order] ?? CHAPTER_ORDER.positionAsc;
  return sql.raw(o);
}

export function chapterFilterToSQL(filter?: ChapterFilterKey) {
  if (!filter) return sql.raw('true');
  const f = CHAPTER_FILTER[filter] ?? true;
  return sql.raw(f);
}
