import {
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
  type ChapterGeneralSettings,
  type ChapterReaderSettings,
} from '@hooks/persisted/useSettings';

import {
  DEFAULT_READER_PREFERENCES,
  toReaderPreferences,
} from '../preferences';

const reader = (values: Partial<ChapterReaderSettings> = {}) => ({
  ...initialChapterReaderSettings,
  ...values,
});
const general = (values: Partial<ChapterGeneralSettings> = {}) => ({
  ...initialChapterGeneralSettings,
  ...values,
});

describe('toReaderPreferences', () => {
  it('matches the engine defaults for default settings', () => {
    expect(toReaderPreferences(reader(), general())).toEqual(
      DEFAULT_READER_PREFERENCES,
    );
  });

  it('maps the reader and behaviour settings', () => {
    const prefs = toReaderPreferences(
      reader({
        textSize: 20,
        lineHeight: 1.8,
        textAlign: 'justify',
        padding: 24,
        theme: '#ffffff',
        textColor: '#000000',
        columns: 2,
        showChapterTitle: true,
      }),
      general({
        pageReader: true,
        tapToScroll: true,
        swipeGestures: true,
        showBatteryAndTime: true,
        pageAnimation: 'curl',
        continuousChapters: true,
      }),
      'p { color: red }',
    );
    expect(prefs).toMatchObject({
      fontSize: 20,
      lineHeight: 1.8,
      textAlign: 'justify',
      padding: 24,
      backgroundColor: '#ffffff',
      textColor: '#000000',
      columns: 2,
      showChapterTitle: true,
      flow: 'paginated',
      tapToScroll: true,
      swipeGestures: true,
      showBatteryAndTime: true,
      animation: 'curl',
      continuousChapters: true,
      customCss: 'p { color: red }',
    });
  });

  it('disabled page transitions win over the turn style', () => {
    const prefs = toReaderPreferences(
      reader(),
      general({ pageAnimation: 'slide', pageReaderDisableAnimation: true }),
    );
    expect(prefs.animation).toBe('none');
  });

  it('clamps out-of-range and rejects malformed values', () => {
    const prefs = toReaderPreferences(
      reader({
        textSize: 400,
        lineHeight: Number.NaN,
        textAlign: 'sideways',
        columns: 3 as unknown as 2,
        paragraphSpacing: -5,
      }),
      general({ pageAnimation: 'spin' as unknown as 'push' }),
    );
    expect(prefs.fontSize).toBe(64);
    expect(prefs.lineHeight).toBe(DEFAULT_READER_PREFERENCES.lineHeight);
    expect(prefs.textAlign).toBe(DEFAULT_READER_PREFERENCES.textAlign);
    expect(prefs.columns).toBe('auto');
    expect(prefs.paragraphSpacing).toBe(0);
    expect(prefs.animation).toBe('push');
  });

  it('fills in fields missing from settings saved by older versions', () => {
    const legacyReader = {
      ...initialChapterReaderSettings,
    } as Partial<ChapterReaderSettings>;
    delete legacyReader.paragraphSpacing;
    delete legacyReader.columns;
    const legacyGeneral = {
      ...initialChapterGeneralSettings,
    } as Partial<ChapterGeneralSettings>;
    delete legacyGeneral.pageAnimation;
    delete legacyGeneral.continuousChapters;
    const prefs = toReaderPreferences(
      legacyReader as ChapterReaderSettings,
      legacyGeneral as ChapterGeneralSettings,
    );
    expect(prefs.paragraphSpacing).toBe(
      DEFAULT_READER_PREFERENCES.paragraphSpacing,
    );
    expect(prefs.columns).toBe('auto');
    expect(prefs.animation).toBe('push');
    expect(prefs.continuousChapters).toBe(true);
  });
});
