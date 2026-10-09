import type { BackupNovel, ChapterInfo } from '@database/types';
import { decodeNovelBatch, encodeNovelBatch } from '../../novelPayload';
import type { ResolvedBackupManifest } from '../../types';
import {
  decodeAndValidateNovelFile,
  decodeRestoreNovelFile,
  getNovelFileRecordCount,
  NovelFileValidationError,
} from '../validation';

jest.mock('@utils/Storages', () => ({ ROOT_STORAGE: '/storage' }));

const sections = {
  library: true,
  settings: false,
  plugins: false,
  downloadedFiles: false,
};

const makeManifest = (novelDataFormat: 1 | 2): ResolvedBackupManifest => ({
  appVersion: '2.1.3',
  formatVersion: 2,
  novelDataFormat,
  sections,
});

const legacyManifest = makeManifest(1);
const compactManifest = makeManifest(2);

const makeTestChapter = (novelId: number, chapterNumber = 1): ChapterInfo => ({
  id: novelId * 100 + chapterNumber,
  novelId,
  path: `/novel/${novelId}/chapter/${chapterNumber}`,
  name: `Chapter ${chapterNumber}`,
  releaseTime: `2024-01-${String(chapterNumber).padStart(2, '0')}`,
  readTime: `2024-03-${String(chapterNumber).padStart(2, '0')}`,
  bookmark: chapterNumber % 2 === 0,
  unread: chapterNumber % 2 !== 0,
  isDownloaded: true,
  updatedTime: `2024-02-${String(chapterNumber).padStart(2, '0')}`,
  chapterNumber,
  page: String(chapterNumber),
  position: chapterNumber - 1,
  progress: chapterNumber / 10,
  scanlator: `scanlator-${chapterNumber}`,
  timeSpent: chapterNumber * 60,
});

const makeTestNovel = (
  id: number,
  pluginId = 'source',
  chapters = [makeTestChapter(id)],
): BackupNovel => ({
  id,
  name: `Novel ${id}`,
  path: `/novel/${id}`,
  pluginId,
  cover: null,
  summary: `Summary ${id}`,
  author: `Author ${id}`,
  artist: `Artist ${id}`,
  status: 'ongoing',
  genres: 'fantasy',
  inLibrary: true,
  isLocal: false,
  totalPages: 100,
  chapters,
});

type MutableLegacyNovel = Record<string, unknown> & {
  chapters: Record<string, unknown>[];
};

type MutableCompactNovel = Record<string, unknown> & { c: unknown[][] };

type SeenRecords = {
  novelIds: Set<number>;
  novelIdentities: Set<string>;
  chapterIdentities: Set<string>;
};

const newSeenRecords = (): SeenRecords => ({
  novelIds: new Set(),
  novelIdentities: new Set(),
  chapterIdentities: new Set(),
});

const makeLegacyPayload = (): MutableLegacyNovel => ({
  id: 1,
  path: '/legacy/one',
  pluginId: 'legacy-source',
  name: 'Legacy novel',
  cover: null,
  summary: null,
  author: null,
  artist: null,
  status: null,
  genres: null,
  inLibrary: null,
  isLocal: null,
  totalPages: null,
  chapters: [
    {
      id: 101,
      novelId: 1,
      path: '/legacy/one/chapter/1',
      name: 'Legacy chapter',
      releaseTime: null,
      readTime: null,
      bookmark: null,
      unread: null,
      isDownloaded: null,
      updatedTime: null,
      chapterNumber: null,
      page: null,
      progress: null,
      position: null,
      scanlator: null,
      timeSpent: null,
    },
  ],
});

const makeCompactRecord = (
  novel: BackupNovel = makeTestNovel(1),
): MutableCompactNovel =>
  encodeNovelBatch([novel])[0] as unknown as MutableCompactNovel;

const setLegacyNovelField = (field: string, value: unknown) => {
  const payload = makeLegacyPayload();
  payload[field] = value;
  return payload;
};

const setLegacyChapterField = (field: string, value: unknown) => {
  const payload = makeLegacyPayload();
  const chapter = payload.chapters[0];
  if (!chapter) {
    throw new Error('Expected a legacy chapter fixture');
  }
  chapter[field] = value;
  return payload;
};

const setCompactNovelField = (field: string, value: unknown) => {
  const record = makeCompactRecord();
  record[field] = value;
  return [record];
};

const setCompactChapterField = (index: number, value: unknown) => {
  const record = makeCompactRecord();
  const chapter = record.c[0];
  if (!chapter) {
    throw new Error('Expected a compact chapter fixture');
  }
  chapter[index] = value;
  return [record];
};

const encodeFile = (novels: BackupNovel[]) =>
  JSON.stringify(encodeNovelBatch(novels));

const captureValidationError = (
  fileContent: string,
  manifest: ResolvedBackupManifest,
  seen: SeenRecords = newSeenRecords(),
): NovelFileValidationError => {
  try {
    decodeAndValidateNovelFile(
      fileContent,
      manifest,
      seen.novelIds,
      seen.novelIdentities,
      seen.chapterIdentities,
    );
  } catch (error) {
    expect(error).toBeInstanceOf(NovelFileValidationError);
    return error as NovelFileValidationError;
  }
  throw new Error('Expected novel file validation to fail');
};

describe('decodeRestoreNovelFile', () => {
  it('normalizes legacy values and ignores fields outside the backup shape', () => {
    const payload = {
      id: 22,
      path: '/legacy/empty-name',
      pluginId: 'legacy-source',
      name: '',
      cover: '/covers/legacy.jpg',
      chapters: [
        {
          id: 2201,
          novelId: 999,
          path: '/legacy/empty-name/chapter/1',
          name: '',
          extraChapterField: 'discard me',
        },
      ],
      extraNovelField: 'discard me',
    };

    expect(decodeRestoreNovelFile(payload, legacyManifest)).toEqual([
      {
        id: 22,
        path: '/legacy/empty-name',
        pluginId: 'legacy-source',
        name: '',
        cover: 'file:///storage/covers/legacy.jpg',
        summary: null,
        author: null,
        artist: null,
        status: null,
        genres: null,
        inLibrary: null,
        isLocal: null,
        totalPages: null,
        chapters: [
          {
            id: 2201,
            novelId: 22,
            path: '/legacy/empty-name/chapter/1',
            name: '',
            releaseTime: null,
            readTime: null,
            bookmark: null,
            unread: null,
            isDownloaded: null,
            updatedTime: null,
            chapterNumber: null,
            page: null,
            progress: null,
            position: null,
            scanlator: null,
            timeSpent: null,
          },
        ],
      },
    ]);
  });

  it('maps every compact chapter tuple field and removes restore-only aggregates', () => {
    const chapter: ChapterInfo = {
      id: 1402,
      novelId: 14,
      path: '/novel/14/chapter/2',
      name: 'Mapped chapter',
      releaseTime: 'released-at',
      bookmark: true,
      unread: false,
      readTime: 'read-at',
      isDownloaded: false,
      updatedTime: 'updated-at',
      chapterNumber: 2.5,
      page: 'page-token',
      position: 3.5,
      progress: 0.625,
      scanlator: 'scanlator-team',
      timeSpent: 91,
    };
    const novel: BackupNovel = {
      ...makeTestNovel(14, 'compact-source', [chapter]),
      name: 'Compact mapping novel',
      path: '/novel/14',
      cover: '/covers/round-trip.jpg',
    };
    const novelWithAggregates = {
      ...novel,
      chaptersDownloaded: 4,
      chaptersUnread: 6,
      totalChapters: 12,
      lastReadAt: '2024-03-01T10:20:30.000Z',
      lastUpdatedAt: '2024-03-02T10:20:30.000Z',
    };
    const compactPayload = encodeNovelBatch([novelWithAggregates]);

    expect(compactPayload[0]?.c).toEqual([
      [
        1402,
        '/novel/14/chapter/2',
        'Mapped chapter',
        'released-at',
        true,
        false,
        'read-at',
        false,
        'updated-at',
        2.5,
        'page-token',
        3.5,
        0.625,
        'scanlator-team',
        91,
      ],
    ]);
    expect(decodeNovelBatch(compactPayload)).toEqual([novelWithAggregates]);

    expect(decodeRestoreNovelFile(compactPayload, compactManifest)).toEqual([
      {
        ...novel,
        cover: 'file:///storage/covers/round-trip.jpg',
      },
    ]);
  });

  it.each([
    ['HTTP', 'https://cdn.example/cover.jpg', 'https://cdn.example/cover.jpg'],
    [
      '/covers/relative.jpg',
      '/covers/relative.jpg',
      'file:///storage/covers/relative.jpg',
    ],
    ['empty', '', ''],
    ['null', null, null],
  ] as const)(
    'keeps the existing %s compact cover handling',
    (_description, cover, expectedCover) => {
      const novel = { ...makeTestNovel(40), cover };
      const [restored] = decodeRestoreNovelFile(
        encodeNovelBatch([novel]),
        compactManifest,
      );

      expect(restored?.cover).toBe(expectedCover);
    },
  );
});

type InvalidKind = 'string' | 'boolean' | 'number';
type MalformedInputCase = {
  label: string;
  manifest: ResolvedBackupManifest;
  payload: () => unknown;
};

const invalidValueForKind: Record<InvalidKind, unknown> = {
  string: 42,
  boolean: 'not-a-boolean',
  number: 'not-a-number',
};

const nullableFieldCases = (
  prefix: string,
  manifest: ResolvedBackupManifest,
  fields: readonly (readonly [string, InvalidKind])[],
  makePayload: (field: string, value: unknown) => unknown,
): MalformedInputCase[] =>
  fields.map(([field, kind]) => ({
    label: `${prefix} ${field}`,
    manifest,
    payload: () => makePayload(field, invalidValueForKind[kind]),
  }));

const compactChapterNullableFields: readonly (readonly [
  string,
  number,
  InvalidKind,
])[] = [
  ['releaseTime', 3, 'string'],
  ['bookmark', 4, 'boolean'],
  ['unread', 5, 'boolean'],
  ['readTime', 6, 'string'],
  ['isDownloaded', 7, 'boolean'],
  ['updatedTime', 8, 'string'],
  ['chapterNumber', 9, 'number'],
  ['page', 10, 'string'],
  ['position', 11, 'number'],
  ['progress', 12, 'number'],
  ['scanlator', 13, 'string'],
  ['timeSpent', 14, 'number'],
];

const malformedInputCases: MalformedInputCase[] = [
  {
    label: 'legacy novel id',
    manifest: legacyManifest,
    payload: () => setLegacyNovelField('id', 0),
  },
  {
    label: 'legacy novel path',
    manifest: legacyManifest,
    payload: () => setLegacyNovelField('path', ''),
  },
  {
    label: 'legacy plugin id',
    manifest: legacyManifest,
    payload: () => setLegacyNovelField('pluginId', ''),
  },
  {
    label: 'legacy novel name type',
    manifest: legacyManifest,
    payload: () => setLegacyNovelField('name', null),
  },
  {
    label: 'legacy chapter id',
    manifest: legacyManifest,
    payload: () => setLegacyChapterField('id', 0),
  },
  {
    label: 'legacy chapter novel id',
    manifest: legacyManifest,
    payload: () => setLegacyChapterField('novelId', 0),
  },
  {
    label: 'legacy chapter path',
    manifest: legacyManifest,
    payload: () => setLegacyChapterField('path', ''),
  },
  {
    label: 'legacy chapter name type',
    manifest: legacyManifest,
    payload: () => setLegacyChapterField('name', false),
  },
  {
    label: 'legacy chapters collection',
    manifest: legacyManifest,
    payload: () => setLegacyNovelField('chapters', {}),
  },
  ...nullableFieldCases(
    'legacy novel',
    legacyManifest,
    [
      ['cover', 'string'],
      ['summary', 'string'],
      ['author', 'string'],
      ['artist', 'string'],
      ['status', 'string'],
      ['genres', 'string'],
      ['inLibrary', 'boolean'],
      ['isLocal', 'boolean'],
      ['totalPages', 'number'],
    ],
    setLegacyNovelField,
  ),
  ...nullableFieldCases(
    'legacy chapter',
    legacyManifest,
    [
      ['releaseTime', 'string'],
      ['readTime', 'string'],
      ['bookmark', 'boolean'],
      ['unread', 'boolean'],
      ['isDownloaded', 'boolean'],
      ['updatedTime', 'string'],
      ['chapterNumber', 'number'],
      ['page', 'string'],
      ['progress', 'number'],
      ['position', 'number'],
      ['scanlator', 'string'],
      ['timeSpent', 'number'],
    ],
    setLegacyChapterField,
  ),
  {
    label: 'compact novel id',
    manifest: compactManifest,
    payload: () => setCompactNovelField('id', 0),
  },
  {
    label: 'compact novel path',
    manifest: compactManifest,
    payload: () => setCompactNovelField('p', ''),
  },
  {
    label: 'compact plugin id',
    manifest: compactManifest,
    payload: () => setCompactNovelField('pi', ''),
  },
  {
    label: 'compact novel name type',
    manifest: compactManifest,
    payload: () => setCompactNovelField('n', null),
  },
  {
    label: 'compact chapter id',
    manifest: compactManifest,
    payload: () => setCompactChapterField(0, 0),
  },
  {
    label: 'compact chapter path',
    manifest: compactManifest,
    payload: () => setCompactChapterField(1, ''),
  },
  {
    label: 'compact chapter name type',
    manifest: compactManifest,
    payload: () => setCompactChapterField(2, false),
  },
  {
    label: 'compact chapter collection',
    manifest: compactManifest,
    payload: () => setCompactNovelField('c', {}),
  },
  ...nullableFieldCases(
    'compact novel',
    compactManifest,
    [
      ['co', 'string'],
      ['s', 'string'],
      ['a', 'string'],
      ['ar', 'string'],
      ['st', 'string'],
      ['g', 'string'],
      ['l', 'boolean'],
      ['lo', 'boolean'],
      ['t', 'number'],
      ['d', 'number'],
      ['u', 'number'],
      ['tc', 'number'],
      ['lr', 'string'],
      ['lu', 'string'],
    ],
    setCompactNovelField,
  ),
  ...compactChapterNullableFields.map(([field, index, kind]) => ({
    label: `compact chapter ${field}`,
    manifest: compactManifest,
    payload: () => setCompactChapterField(index, invalidValueForKind[kind]),
  })),
];

describe('malformed backup records', () => {
  it.each(malformedInputCases)('rejects $label', ({ manifest, payload }) => {
    expect(() => decodeRestoreNovelFile(payload(), manifest)).toThrow();
  });

  it.each([
    ['missing', (record: MutableCompactNovel) => delete record.p],
    ['extra', (record: MutableCompactNovel) => (record.extra = true)],
  ])('rejects compact records with %s novel keys', (_shape, mutate) => {
    const record = makeCompactRecord();
    mutate(record);

    expect(() => decodeNovelBatch([record])).toThrow();
  });

  it.each([
    ['short', 14],
    ['long', 16],
  ] as const)('rejects a %s compact chapter tuple', (_shape, length) => {
    const record = makeCompactRecord();
    const chapter = record.c[0];
    if (!chapter) {
      throw new Error('Expected a compact chapter fixture');
    }
    record.c[0] =
      length === 14 ? chapter.slice(0, length) : [...chapter, 'extra'];

    expect(() => decodeNovelBatch([record])).toThrow(
      'Invalid compact novel record',
    );
  });

  it.each([
    ['novel id', () => setCompactNovelField('id', Number.NaN)],
    [
      'aggregate count',
      () => setCompactNovelField('d', Number.POSITIVE_INFINITY),
    ],
    [
      'chapter number',
      () => setCompactChapterField(9, Number.NEGATIVE_INFINITY),
    ],
  ])('rejects non-finite %s values in the compact codec', (_field, payload) => {
    expect(() => decodeNovelBatch(payload())).toThrow(
      'Invalid compact novel record',
    );
  });
});

describe('decodeAndValidateNovelFile', () => {
  it.each([
    {
      label: 'novel ID',
      novels: [makeTestNovel(31), makeTestNovel(31, 'other-source')],
      message: 'Duplicate backup novel identity',
    },
    {
      label: 'plugin and path identity',
      novels: [
        makeTestNovel(32, 'source'),
        { ...makeTestNovel(33, 'source'), path: '/novel/32' },
      ],
      message: 'Duplicate backup novel identity',
    },
    {
      label: 'chapter path identity',
      novels: [
        makeTestNovel(34, 'source', [
          makeTestChapter(34, 1),
          {
            ...makeTestChapter(34, 2),
            path: makeTestChapter(34, 1).path,
          },
        ]),
      ],
      message: 'Duplicate backup chapter identity',
    },
  ])('rejects duplicate $label values within a file', ({ novels, message }) => {
    expect(
      captureValidationError(encodeFile(novels), compactManifest).message,
    ).toBe(message);
  });

  it.each([
    {
      label: 'novel ID',
      candidate: (accepted: BackupNovel) => ({
        ...makeTestNovel(502, 'other-source'),
        id: accepted.id,
        path: '/novel/different-path',
      }),
    },
    {
      label: 'plugin and path identity',
      candidate: (accepted: BackupNovel) => ({
        ...makeTestNovel(503, accepted.pluginId),
        path: accepted.path,
      }),
    },
  ])(
    'rejects duplicate $label identities from a prior file',
    ({ candidate }) => {
      const seen = newSeenRecords();
      const accepted = makeTestNovel(501, 'source');
      expect(
        decodeAndValidateNovelFile(
          encodeFile([accepted]),
          compactManifest,
          seen.novelIds,
          seen.novelIdentities,
          seen.chapterIdentities,
        ),
      ).toHaveLength(1);

      const error = captureValidationError(
        encodeFile([candidate(accepted)]),
        compactManifest,
        seen,
      );
      expect(error.message).toBe('Duplicate backup novel identity');
    },
  );

  it('preserves all identity sets after late failure and accepts valid records', () => {
    const seen: SeenRecords = {
      novelIds: new Set([900]),
      novelIdentities: new Set(['prior-source\u0000/prior-novel']),
      chapterIdentities: new Set(['900\u0000/prior-chapter']),
    };
    const before = {
      novelIds: new Set(seen.novelIds),
      novelIdentities: new Set(seen.novelIdentities),
      chapterIdentities: new Set(seen.chapterIdentities),
    };
    const first = makeTestNovel(601);
    const second = makeTestNovel(602);
    const duplicateChapter = makeTestChapter(603, 1);
    const lateFailure = makeTestNovel(603, 'source', [
      duplicateChapter,
      { ...makeTestChapter(603, 2), path: duplicateChapter.path },
    ]);

    const error = captureValidationError(
      encodeFile([first, second, lateFailure]),
      compactManifest,
      seen,
    );

    expect(error.recordCount).toBe(3);
    expect(seen.novelIds).toEqual(before.novelIds);
    expect(seen.novelIdentities).toEqual(before.novelIdentities);
    expect(seen.chapterIdentities).toEqual(before.chapterIdentities);

    expect(
      decodeAndValidateNovelFile(
        encodeFile([first, second]),
        compactManifest,
        seen.novelIds,
        seen.novelIdentities,
        seen.chapterIdentities,
      ),
    ).toHaveLength(2);
    expect([...seen.novelIds]).toEqual([900, first.id, second.id]);
    expect(seen.novelIdentities.size).toBe(3);
    expect(seen.chapterIdentities.size).toBe(3);
  });

  it('counts a late malformed chapter without accepting earlier records', () => {
    const seen = newSeenRecords();
    const first = makeTestNovel(701);
    const second = makeTestNovel(702);
    const last = makeCompactRecord(makeTestNovel(703));
    const lastChapter = last.c[0];
    if (!lastChapter) {
      throw new Error('Expected a compact chapter fixture');
    }
    lastChapter[1] = '';

    const error = captureValidationError(
      JSON.stringify([
        makeCompactRecord(first),
        makeCompactRecord(second),
        last,
      ]),
      compactManifest,
      seen,
    );

    expect(error.recordCount).toBe(3);
    expect(seen.novelIds.size).toBe(0);
    expect(seen.novelIdentities.size).toBe(0);
    expect(seen.chapterIdentities.size).toBe(0);
  });

  it('counts failures and accepts an empty compact batch', () => {
    expect(captureValidationError('{', compactManifest).recordCount).toBe(1);
    expect(captureValidationError('{}', compactManifest).recordCount).toBe(1);
    expect(
      captureValidationError(JSON.stringify({}), legacyManifest).recordCount,
    ).toBe(1);

    const oversizedPayload = Array.from({ length: 101 }, () => null);
    expect(getNovelFileRecordCount(oversizedPayload, compactManifest)).toBe(
      101,
    );
    expect(
      captureValidationError(JSON.stringify(oversizedPayload), compactManifest)
        .recordCount,
    ).toBe(101);

    const malformedRecord = makeCompactRecord();
    malformedRecord.n = null;
    expect(
      captureValidationError(
        JSON.stringify([makeCompactRecord(), malformedRecord]),
        compactManifest,
      ).recordCount,
    ).toBe(2);

    expect(getNovelFileRecordCount({}, compactManifest)).toBe(1);
    expect(getNovelFileRecordCount([], compactManifest)).toBe(1);
    expect(getNovelFileRecordCount([null, null], compactManifest)).toBe(2);
    expect(getNovelFileRecordCount([null, null], legacyManifest)).toBe(1);
    expect(getNovelFileRecordCount({}, legacyManifest)).toBe(1);

    expect(decodeRestoreNovelFile([], compactManifest)).toEqual([]);
    const seen = newSeenRecords();
    expect(
      decodeAndValidateNovelFile(
        '[]',
        compactManifest,
        seen.novelIds,
        seen.novelIdentities,
        seen.chapterIdentities,
      ),
    ).toEqual([]);
    expect(seen.novelIds.size).toBe(0);
    expect(seen.novelIdentities.size).toBe(0);
    expect(seen.chapterIdentities.size).toBe(0);
  });
});
