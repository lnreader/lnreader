/**
 * Native formats chapter row text (ChapterRowFormatter.kt); it must match what
 * `ChapterItem` renders in JS. The shared fixture holds chapters, settings and
 * the expected title and subtitle:
 *
 * - this test checks the expectations against the JS formatting
 *   (`formatDate`, `getString`), and that `toChapterRow` /
 *   `buildChapterRowFormat` produce the inputs the fixture hands native;
 * - ChapterRowFormatterParityTest.kt checks native output against the same file.
 *
 * Regenerate after changing cases or strings:
 *   UPDATE_CHAPTER_ROW_FIXTURE=1 pnpm exec jest --selectProjects rn -- chapterRowFormatParity
 */
import fs from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import type { ChapterInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { formatDate, type DateFormat } from '@utils/dateFormat';
import {
  buildChapterRowFormat,
  type ChapterRowSettings,
  toChapterRow,
} from '../chapterListSync';

const FIXTURE = path.join(
  __dirname,
  '../../../../modules/nitro-chapter-list/fixtures/chapter-row-format.json',
);

// Saturday. Dates are local wall-clock times, so the fixture works in any
// time zone on both sides.
const NOW = '2026-07-25T12:00:00';

interface Case {
  name: string;
  settings: ChapterRowSettings;
  chapter: Pick<
    ChapterInfo,
    | 'id'
    | 'name'
    | 'chapterNumber'
    | 'releaseTime'
    | 'scanlator'
    | 'progress'
    | 'unread'
  >;
}

const settings = (
  dateFormat: DateFormat,
  relativeTimestamps = true,
  showChapterTitles = false,
): ChapterRowSettings => ({
  dateFormat,
  relativeTimestamps,
  showChapterTitles,
});

const chapter = (
  overrides: Partial<Case['chapter']> = {},
): Case['chapter'] => ({
  id: 1,
  name: 'The Beginning',
  chapterNumber: 12,
  releaseTime: null,
  scanlator: null,
  progress: 0,
  unread: true,
  ...overrides,
});

const CASES: Case[] = [
  {
    name: 'today, with scanlator and progress',
    settings: settings('default'),
    chapter: chapter({
      releaseTime: '2026-07-25T09:00:00',
      scanlator: 'Team A',
      progress: 40,
    }),
  },
  {
    name: 'yesterday, late evening',
    settings: settings('default'),
    chapter: chapter({ releaseTime: '2026-07-24T23:30:00' }),
  },
  {
    name: 'last week, Monday',
    settings: settings('default'),
    chapter: chapter({ releaseTime: '2026-07-20T08:00:00' }),
  },
  {
    name: 'six days ago, Sunday',
    settings: settings('YYYY-MM-DD'),
    chapter: chapter({ releaseTime: '2026-07-19T00:05:00' }),
  },
  {
    name: 'seven days ago falls back to the date format',
    settings: settings('YYYY-MM-DD'),
    chapter: chapter({ releaseTime: '2026-07-18T12:00:00' }),
  },
  {
    name: 'tomorrow',
    settings: settings('default'),
    chapter: chapter({ releaseTime: '2026-07-26T10:00:00' }),
  },
  {
    name: 'next week, Tuesday',
    settings: settings('default'),
    chapter: chapter({ releaseTime: '2026-07-28T10:00:00' }),
  },
  {
    name: 'a week ahead uses DD MMM YYYY',
    settings: settings('DD MMM YYYY'),
    chapter: chapter({ releaseTime: '2026-08-01T10:00:00' }),
  },
  {
    name: 'MMM DD, YYYY',
    settings: settings('MMM DD, YYYY', false),
    chapter: chapter({ releaseTime: '2026-01-05T10:00:00' }),
  },
  {
    name: 'MM/DD/YY',
    settings: settings('MM/DD/YY', false),
    chapter: chapter({ releaseTime: '2026-01-05T10:00:00' }),
  },
  {
    name: 'DD/MM/YY',
    settings: settings('DD/MM/YY', false),
    chapter: chapter({ releaseTime: '2026-12-31T23:59:00' }),
  },
  {
    name: 'relative dates off shows today as a date',
    settings: settings('YYYY-MM-DD', false),
    chapter: chapter({ releaseTime: '2026-07-25T09:00:00' }),
  },
  {
    name: 'unparseable release text is shown as is',
    settings: settings('default'),
    chapter: chapter({ releaseTime: 'Unknown', scanlator: 'Team B' }),
  },
  {
    name: 'nothing to show',
    settings: settings('default'),
    chapter: chapter(),
  },
  {
    name: 'read chapters hide progress',
    settings: settings('YYYY-MM-DD', false),
    chapter: chapter({
      releaseTime: '2026-03-01T10:00:00',
      progress: 40,
      unread: false,
    }),
  },
  {
    name: 'chapter titles',
    settings: settings('default', true, true),
    chapter: chapter({ name: 'Chapter 1669: I Love You', progress: 5 }),
  },
  {
    name: 'fractional chapter number',
    settings: settings('default'),
    chapter: chapter({ chapterNumber: 10.5 }),
  },
];

/** What `ChapterItem` renders, via the JS formatting it uses. */
const renderInJs = ({ settings: s, chapter: c }: Case) => {
  const parts: string[] = [];
  if (c.releaseTime) {
    parts.push(
      formatDate(c.releaseTime, s.dateFormat, s.relativeTimestamps, NOW),
    );
  }
  if (c.scanlator) {
    parts.push(c.scanlator);
  }
  if (c.progress && c.progress > 0 && c.unread) {
    parts.push(getString('novelScreen.progress', { progress: c.progress }));
  }
  return {
    title: s.showChapterTitles
      ? c.name
      : getString('novelScreen.chapterChapnum', { num: c.chapterNumber }),
    subtitle: parts.join(' •  '),
  };
};

/** The row native receives, minus releaseTime (epoch ms depend on the zone). */
const rowForFixture = (c: Case['chapter']) => {
  const { releaseTime: _releaseTime, ...row } = toChapterRow(c as ChapterInfo);
  return row;
};

const generate = () => {
  const base = buildChapterRowFormat(settings('default'));
  return {
    now: NOW,
    baseFormat: base,
    cases: CASES.map(testCase => ({
      name: testCase.name,
      settings: testCase.settings,
      row: rowForFixture(testCase.chapter),
      // Local wall-clock time for native to parse; null when JS sent none.
      releaseLocal:
        testCase.chapter.releaseTime &&
        dayjs(testCase.chapter.releaseTime).isValid()
          ? testCase.chapter.releaseTime
          : null,
      ...renderInJs(testCase),
    })),
  };
};

describe('chapter row format parity fixture', () => {
  if (process.env.UPDATE_CHAPTER_ROW_FIXTURE) {
    it('writes the fixture', () => {
      fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
      fs.writeFileSync(FIXTURE, JSON.stringify(generate(), null, 2) + '\n');
      expect(JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))).toEqual(generate());
    });
    return;
  }

  const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

  it('matches what the JS formatting renders, case by case', () => {
    expect(fixture).toEqual(generate());
  });

  it('hands native the parsed release time JS sends', () => {
    for (const testCase of CASES) {
      const row = toChapterRow(testCase.chapter as ChapterInfo);
      const expected = dayjs(testCase.chapter.releaseTime ?? '');
      expect(row.releaseTime).toBe(
        testCase.chapter.releaseTime && expected.isValid()
          ? expected.valueOf()
          : undefined,
      );
    }
  });

  it('builds the format native gets from the same settings', () => {
    for (const testCase of CASES) {
      expect(buildChapterRowFormat(testCase.settings)).toEqual({
        ...fixture.baseFormat,
        showChapterTitles: testCase.settings.showChapterTitles,
        dateFormat: testCase.settings.dateFormat,
        relativeDates: testCase.settings.relativeTimestamps,
      });
    }
  });
});
