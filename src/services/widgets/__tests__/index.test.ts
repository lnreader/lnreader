import NativeWidgets from '@modules/native-widgets';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import {
  getWidgetReadDaysFromDb,
  getWidgetReadingFromDb,
  getWidgetUpdatesCountFromDb,
  getWidgetUpdatesFromDb,
} from '@database/queries/WidgetQueries';
import { buildWidgetSnapshot, syncWidgets } from '..';

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
}));

jest.mock('@database/queries/WidgetQueries', () => ({
  getWidgetReadingFromDb: jest.fn(),
  getWidgetUpdatesFromDb: jest.fn(),
  getWidgetUpdatesCountFromDb: jest.fn(),
  getWidgetReadDaysFromDb: jest.fn(),
}));

const native = NativeWidgets as unknown as {
  hasWidgets: jest.Mock;
  setSnapshot: jest.Mock;
};

const readingRow = {
  novelId: 1,
  novelName: "The Archmage's Second Apprentice",
  novelCover: 'https://example.com/cover.jpg',
  totalChapters: 980,
  chapterId: 10,
  chapterName: 'The Lantern Under Frost',
  chapterNumber: 412,
  progress: 35,
  readTime: '2026-11-21 08:00:00',
};

describe('widget snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMMKVObject as jest.Mock).mockReturnValue(undefined);
    (getWidgetReadingFromDb as jest.Mock).mockResolvedValue([readingRow]);
    (getWidgetUpdatesFromDb as jest.Mock).mockResolvedValue([
      {
        novelId: 2,
        novelName: 'Saltwind Cartographer',
        novelCover: null,
        chapterId: 20,
        chapterName: 'Chapter 241: Harbor of Glass',
        chapterNumber: null,
        updatedTime: '2026-11-21T06:00:00.000Z',
      },
    ]);
    (getWidgetUpdatesCountFromDb as jest.Mock).mockResolvedValue(18);
    (getWidgetReadDaysFromDb as jest.Mock).mockResolvedValue([
      { day: '2026-11-21', chapters: 5 },
      { day: '2026-11-19', chapters: 2 },
    ]);
  });

  it('maps reading history, updates and reading days', async () => {
    const snapshot = await buildWidgetSnapshot();

    expect(snapshot.incognito).toBe(false);
    expect(snapshot.reading).toEqual([
      {
        novelId: 1,
        chapterId: 10,
        novelName: "The Archmage's Second Apprentice",
        chapterName: 'The Lantern Under Frost',
        chapterNumber: '412',
        novelProgress: 412 / 980,
        chapterProgress: 0.35,
        totalChapters: 980,
        cover: 'https://example.com/cover.jpg',
      },
    ]);
    expect(snapshot.updates.count).toBe(18);
    expect(snapshot.updates.items[0]).toMatchObject({
      chapterId: 20,
      // Parsed from the name when the source gives no number.
      chapterNumber: '241',
      updatedAt: Date.parse('2026-11-21T06:00:00.000Z'),
      cover: null,
    });
    expect(snapshot.readDays).toEqual({ '2026-11-21': 5, '2026-11-19': 2 });
  });

  it('leaves placeholders for native code to fill', async () => {
    const { strings } = await buildWidgetSnapshot();

    expect(strings.chapter).toBe('Ch. {number}');
    expect(strings.more).toBe('+{remaining} more');
    expect(strings.updatingProgress).toBe('Updating · {done}/{total}');
  });

  it('omits novel progress when the chapter count is unknown', async () => {
    (getWidgetReadingFromDb as jest.Mock).mockResolvedValue([
      { ...readingRow, totalChapters: 0, chapterNumber: null, chapterName: '' },
    ]);

    const [item] = (await buildWidgetSnapshot()).reading;

    expect(item.novelProgress).toBeNull();
    expect(item.chapterNumber).toBe('');
  });

  it('sends no titles, covers or history in incognito mode', async () => {
    (getMMKVObject as jest.Mock).mockReturnValue({ incognitoMode: true });

    const snapshot = await buildWidgetSnapshot();

    expect(snapshot).toMatchObject({
      incognito: true,
      reading: [],
      updates: { count: 0, items: [] },
      readDays: {},
    });
    expect(getWidgetReadingFromDb).not.toHaveBeenCalled();
    expect(getWidgetUpdatesFromDb).not.toHaveBeenCalled();
  });

  it('only builds a snapshot when a widget is on the home screen', async () => {
    native.hasWidgets.mockResolvedValueOnce(false);
    await syncWidgets();
    expect(native.setSnapshot).not.toHaveBeenCalled();
    expect(getWidgetReadingFromDb).not.toHaveBeenCalled();

    native.hasWidgets.mockResolvedValueOnce(true);
    await syncWidgets();
    expect(native.setSnapshot).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(native.setSnapshot.mock.calls[0][0]).reading,
    ).toHaveLength(1);
  });
});
