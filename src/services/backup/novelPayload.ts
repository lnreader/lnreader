import type { BackupNovel, ChapterInfo } from '@database/types';

type NullableString = string | null;
type NullableNumber = number | null;
type NullableBoolean = boolean | null;

type CompactChapter = [
  number,
  string,
  string,
  NullableString,
  NullableBoolean,
  NullableBoolean,
  NullableString,
  NullableBoolean,
  NullableString,
  NullableNumber,
  NullableString,
  NullableNumber,
  NullableNumber,
  NullableString,
  NullableNumber,
];

type CompactNovel = {
  c: CompactChapter[];
  id: number;
  p: string;
  pi: string;
  n: string;
  co: NullableString;
  s: NullableString;
  a: NullableString;
  ar: NullableString;
  st: NullableString;
  g: NullableString;
  l: NullableBoolean;
  lo: NullableBoolean;
  t: NullableNumber;
  d: NullableNumber;
  u: NullableNumber;
  tc: NullableNumber;
  lr: NullableString;
  lu: NullableString;
};

type BackupNovelWithAggregates = BackupNovel & {
  chaptersDownloaded?: number | null;
  chaptersUnread?: number | null;
  totalChapters?: number | null;
  lastReadAt?: string | null;
  lastUpdatedAt?: string | null;
};

const NOVEL_KEYS = [
  'c',
  'id',
  'p',
  'pi',
  'n',
  'co',
  's',
  'a',
  'ar',
  'st',
  'g',
  'l',
  'lo',
  't',
  'd',
  'u',
  'tc',
  'lr',
  'lu',
] as const;

const isNullable = <T>(
  value: unknown,
  predicate: (value: unknown) => value is T,
): value is T | null => value === null || predicate(value);

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isId = (value: unknown): value is number =>
  isNumber(value) && Number.isInteger(value) && value > 0;
const isBoolean = (value: unknown): value is boolean =>
  typeof value === 'boolean';

const nullableString = (value: unknown): value is NullableString =>
  isNullable(value, isString);
const nullableNumber = (value: unknown): value is NullableNumber =>
  isNullable(value, isNumber);
const nullableBoolean = (value: unknown): value is NullableBoolean =>
  isNullable(value, isBoolean);
const nonEmptyString = (value: unknown): value is string =>
  isString(value) && value.trim().length > 0;

const nullableLegacyString = (value: Record<string, unknown>, key: string) => {
  const field = value[key];
  if (field === undefined || field === null) {
    return null;
  }
  if (!isString(field)) {
    throw new Error(`Invalid legacy ${key}`);
  }
  return field;
};

const nullableLegacyNumber = (value: Record<string, unknown>, key: string) => {
  const field = value[key];
  if (field === undefined || field === null) {
    return null;
  }
  if (!isNumber(field)) {
    throw new Error(`Invalid legacy ${key}`);
  }
  return field;
};

const nullableLegacyBoolean = (value: Record<string, unknown>, key: string) => {
  const field = value[key];
  if (field === undefined || field === null) {
    return null;
  }
  if (!isBoolean(field)) {
    throw new Error(`Invalid legacy ${key}`);
  }
  return field;
};

const positiveId = (value: unknown): value is number =>
  isId(value) && value > 0;

const normalizeLegacyChapter = (
  value: unknown,
  containingNovelId: number,
): ChapterInfo => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid legacy chapter');
  }
  const chapter = value as Record<string, unknown>;
  if (
    !positiveId(chapter.id) ||
    !nonEmptyString(chapter.path) ||
    !isString(chapter.name) ||
    (chapter.novelId !== undefined &&
      chapter.novelId !== null &&
      !positiveId(chapter.novelId))
  ) {
    throw new Error('Invalid legacy chapter fields');
  }
  return {
    id: chapter.id,
    novelId: containingNovelId,
    path: chapter.path,
    name: chapter.name,
    releaseTime: nullableLegacyString(chapter, 'releaseTime'),
    readTime: nullableLegacyString(chapter, 'readTime'),
    bookmark: nullableLegacyBoolean(chapter, 'bookmark'),
    unread: nullableLegacyBoolean(chapter, 'unread'),
    isDownloaded: nullableLegacyBoolean(chapter, 'isDownloaded'),
    updatedTime: nullableLegacyString(chapter, 'updatedTime'),
    chapterNumber: nullableLegacyNumber(chapter, 'chapterNumber'),
    page: nullableLegacyString(chapter, 'page'),
    progress: nullableLegacyNumber(chapter, 'progress'),
    position: nullableLegacyNumber(chapter, 'position'),
    scanlator: nullableLegacyString(chapter, 'scanlator'),
    timeSpent: nullableLegacyNumber(chapter, 'timeSpent'),
  };
};

export const validateBackupNovel = (novel: BackupNovel): BackupNovel => {
  if (
    !positiveId(novel.id) ||
    !nonEmptyString(novel.path) ||
    !nonEmptyString(novel.pluginId) ||
    !isString(novel.name) ||
    !Array.isArray(novel.chapters)
  ) {
    throw new Error('Invalid novel fields');
  }
  const stringFields = [
    novel.cover,
    novel.summary,
    novel.author,
    novel.artist,
    novel.status,
    novel.genres,
  ];
  if (stringFields.some(value => value !== null && !isString(value))) {
    throw new Error('Invalid novel string field');
  }
  const booleanFields = [novel.inLibrary, novel.isLocal];
  if (booleanFields.some(value => value !== null && !isBoolean(value))) {
    throw new Error('Invalid novel boolean field');
  }
  if (novel.totalPages !== null && !isNumber(novel.totalPages)) {
    throw new Error('Invalid novel number field');
  }
  for (const chapter of novel.chapters) {
    if (
      !positiveId(chapter.id) ||
      !positiveId(chapter.novelId) ||
      !nonEmptyString(chapter.path) ||
      !isStringOrNull(chapter.releaseTime) ||
      !isStringOrNull(chapter.readTime) ||
      !isBooleanOrNull(chapter.bookmark) ||
      !isBooleanOrNull(chapter.unread) ||
      !isBooleanOrNull(chapter.isDownloaded) ||
      !isStringOrNull(chapter.updatedTime) ||
      !isNumberOrNull(chapter.chapterNumber) ||
      !isStringOrNull(chapter.page) ||
      !isNumberOrNull(chapter.progress) ||
      !isNumberOrNull(chapter.position) ||
      !isStringOrNull(chapter.scanlator) ||
      !isNumberOrNull(chapter.timeSpent)
    ) {
      throw new Error('Invalid chapter fields');
    }
  }
  return novel;
};

const isStringOrNull = (value: unknown): value is string | null =>
  value === null || isString(value);
const isNumberOrNull = (value: unknown): value is number | null =>
  value === null || isNumber(value);
const isBooleanOrNull = (value: unknown): value is boolean | null =>
  value === null || isBoolean(value);

export const normalizeLegacyNovel = (value: unknown): BackupNovel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid legacy novel');
  }
  const source = value as Record<string, unknown>;
  if (
    !positiveId(source.id) ||
    !nonEmptyString(source.path) ||
    !nonEmptyString(source.pluginId) ||
    !isString(source.name) ||
    !Array.isArray(source.chapters)
  ) {
    throw new Error('Invalid legacy novel fields');
  }
  const novelId = source.id;
  const novel: BackupNovel = {
    id: novelId,
    path: source.path,
    pluginId: source.pluginId,
    name: source.name,
    cover: nullableLegacyString(source, 'cover'),
    summary: nullableLegacyString(source, 'summary'),
    author: nullableLegacyString(source, 'author'),
    artist: nullableLegacyString(source, 'artist'),
    status: nullableLegacyString(source, 'status'),
    genres: nullableLegacyString(source, 'genres'),
    inLibrary: nullableLegacyBoolean(source, 'inLibrary'),
    isLocal: nullableLegacyBoolean(source, 'isLocal'),
    totalPages: nullableLegacyNumber(source, 'totalPages'),
    chapters: source.chapters.map(chapter =>
      normalizeLegacyChapter(chapter, novelId),
    ),
  };
  return validateBackupNovel(novel);
};

const assertNovelKeys = (novel: Record<string, unknown>) => {
  const keys = Object.keys(novel).sort();
  const expected = [...NOVEL_KEYS].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    throw new Error('Invalid compact novel keys');
  }
};

const isCompactChapter = (value: unknown): value is CompactChapter => {
  if (!Array.isArray(value) || value.length !== 15) {
    return false;
  }

  return (
    isId(value[0]) &&
    nonEmptyString(value[1]) &&
    isString(value[2]) &&
    nullableString(value[3]) &&
    nullableBoolean(value[4]) &&
    nullableBoolean(value[5]) &&
    nullableString(value[6]) &&
    nullableBoolean(value[7]) &&
    nullableString(value[8]) &&
    nullableNumber(value[9]) &&
    nullableString(value[10]) &&
    nullableNumber(value[11]) &&
    nullableNumber(value[12]) &&
    nullableString(value[13]) &&
    nullableNumber(value[14])
  );
};

const isCompactNovel = (value: unknown): value is CompactNovel => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const novel = value as Record<string, unknown>;
  assertNovelKeys(novel);
  return (
    Array.isArray(novel.c) &&
    novel.c.every(isCompactChapter) &&
    isId(novel.id) &&
    nonEmptyString(novel.p) &&
    nonEmptyString(novel.pi) &&
    isString(novel.n) &&
    nullableString(novel.co) &&
    nullableString(novel.s) &&
    nullableString(novel.a) &&
    nullableString(novel.ar) &&
    nullableString(novel.st) &&
    nullableString(novel.g) &&
    nullableBoolean(novel.l) &&
    nullableBoolean(novel.lo) &&
    nullableNumber(novel.t) &&
    nullableNumber(novel.d) &&
    nullableNumber(novel.u) &&
    nullableNumber(novel.tc) &&
    nullableString(novel.lr) &&
    nullableString(novel.lu)
  );
};

const nullable = <T>(value: T | undefined | null): T | null => value ?? null;

const encodeChapter = (chapter: ChapterInfo): CompactChapter => [
  chapter.id,
  chapter.path,
  chapter.name,
  nullable(chapter.releaseTime),
  nullable(chapter.bookmark),
  nullable(chapter.unread),
  nullable(chapter.readTime),
  nullable(chapter.isDownloaded),
  nullable(chapter.updatedTime),
  nullable(chapter.chapterNumber),
  nullable(chapter.page),
  nullable(chapter.position),
  nullable(chapter.progress),
  nullable(chapter.scanlator),
  nullable(chapter.timeSpent),
];

const encodeNovel = (novel: BackupNovel): CompactNovel => {
  const novelWithAggregates = novel as BackupNovelWithAggregates;
  return {
    c: novel.chapters.map(encodeChapter),
    id: novel.id,
    p: novel.path,
    pi: novel.pluginId,
    n: novel.name,
    co: nullable(novel.cover),
    s: nullable(novel.summary),
    a: nullable(novel.author),
    ar: nullable(novel.artist),
    st: nullable(novel.status),
    g: nullable(novel.genres),
    l: nullable(novel.inLibrary),
    lo: nullable(novel.isLocal),
    t: nullable(novel.totalPages),
    d: nullable(novelWithAggregates.chaptersDownloaded),
    u: nullable(novelWithAggregates.chaptersUnread),
    tc: nullable(novelWithAggregates.totalChapters),
    lr: nullable(novelWithAggregates.lastReadAt),
    lu: nullable(novelWithAggregates.lastUpdatedAt),
  };
};

const decodeNovel = (novel: CompactNovel): BackupNovel => {
  const decoded: BackupNovelWithAggregates = {
    id: novel.id,
    path: novel.p,
    pluginId: novel.pi,
    name: novel.n,
    cover: novel.co,
    summary: novel.s,
    author: novel.a,
    artist: novel.ar,
    status: novel.st,
    genres: novel.g,
    inLibrary: novel.l,
    isLocal: novel.lo,
    totalPages: novel.t,
    chaptersDownloaded: novel.d,
    chaptersUnread: novel.u,
    totalChapters: novel.tc,
    lastReadAt: novel.lr,
    lastUpdatedAt: novel.lu,
    chapters: novel.c.map(chapter => ({
      id: chapter[0],
      novelId: novel.id,
      path: chapter[1],
      name: chapter[2],
      releaseTime: chapter[3],
      bookmark: chapter[4],
      unread: chapter[5],
      readTime: chapter[6],
      isDownloaded: chapter[7],
      updatedTime: chapter[8],
      chapterNumber: chapter[9],
      page: chapter[10],
      position: chapter[11],
      progress: chapter[12],
      scanlator: chapter[13],
      timeSpent: chapter[14],
    })),
  };
  return decoded;
};

export const encodeNovelBatch = (novels: BackupNovel[]): CompactNovel[] => {
  if (novels.length > 100) {
    throw new Error('Compact novel batch exceeds 100 novels');
  }
  return novels.map(encodeNovel);
};

export const decodeNovelBatch = (payload: unknown): BackupNovel[] => {
  if (!Array.isArray(payload) || payload.length > 100) {
    throw new Error('Invalid compact novel batch');
  }
  return payload.map(value => {
    if (!isCompactNovel(value)) {
      throw new Error('Invalid compact novel record');
    }
    return decodeNovel(value);
  });
};
