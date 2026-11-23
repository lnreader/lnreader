import { fireEvent, render, screen } from '@test-utils';

import UpcomingScreen from '../UpcomingScreen';
import { monthWeeks } from '../upcomingUtils';
import {
  parseDay,
  startOfLocalDay,
  toLocalDay,
} from '@services/updates/releaseSchedule';
import type { UpcomingNovel } from '@database/queries/LibraryQueries';

const mockSetLibrarySettings = jest.fn();
let mockNovels: UpcomingNovel[] = [];

jest.mock('@database/manager/liveQuery', () => ({
  useLiveQuery: () => mockNovels,
}));
jest.mock('@database/queries/LibraryQueries', () => ({
  getUpcomingNovelsQuery: jest.fn(),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    primary: '#111111',
    onPrimary: '#ffffff',
    onSurface: '#222222',
    onSurfaceVariant: '#333333',
    surface: '#ffffff',
    surfaceVariant: '#eeeeee',
    secondaryContainer: '#dddddd',
    onSecondaryContainer: '#444444',
    rippleColor: '#555555',
    outline: '#666666',
    scrim: '#000000',
  }),
  useAppSettings: () => ({}),
  useLibrarySettings: () => ({
    upcomingIncludeCategoryIds: [],
    upcomingExcludeCategoryIds: [],
    setLibrarySettings: mockSetLibrarySettings,
  }),
  useCategories: () => ({
    categories: [
      { id: 1, name: 'Default', sort: 1 },
      { id: 2, name: 'Local', sort: 2 },
      { id: 10, name: 'Reading', sort: 3 },
    ],
  }),
}));
jest.mock('@screens/novel/NovelContext', () => ({}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

const today = toLocalDay(new Date());
const upcoming = (id: number, name: string, inDays: number) => ({
  id,
  name,
  path: `/novel/${id}`,
  pluginId: 'plugin',
  cover: null,
  nextUpdate: startOfLocalDay(today + inDays).toISOString(),
});

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const renderScreen = () =>
  render(
    <UpcomingScreen navigation={navigation as never} route={{} as never} />,
  );

describe('UpcomingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNovels = [
      upcoming(1, 'Due Today', 0),
      upcoming(2, 'Due Tomorrow A', 1),
      upcoming(3, 'Due Tomorrow B', 1),
      upcoming(4, 'Due Later', 5),
    ];
  });

  it('groups novels under their predicted day', () => {
    renderScreen();

    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(screen.getByText('Tomorrow')).toBeOnTheScreen();
    expect(screen.getByText('In 5 days')).toBeOnTheScreen();
    expect(screen.getByText('Due Tomorrow B')).toBeOnTheScreen();
  });

  it('opens a novel when its row is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByText('Due Later'));

    expect(navigation.navigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: expect.objectContaining({ path: '/novel/4', name: 'Due Later' }),
    });
  });

  it('saves the category filter, leaving out the Local category', () => {
    renderScreen();

    fireEvent.press(screen.getByLabelText('Filter'));
    expect(screen.queryByText('Local')).toBeNull();
    fireEvent.press(screen.getByText('Reading'));
    fireEvent.press(screen.getByText('Ok'));

    expect(mockSetLibrarySettings).toHaveBeenCalledWith({
      upcomingIncludeCategoryIds: [10],
      upcomingExcludeCategoryIds: [],
    });
  });

  it('explains that predictions build up when there are none', () => {
    mockNovels = [];
    renderScreen();

    expect(
      screen.getByText(
        'No upcoming updates predicted. Predictions build up as your library updates.',
      ),
    ).toBeOnTheScreen();
  });
});

describe('monthWeeks', () => {
  it('lays out a month from the locale week start', () => {
    // November 2026 starts on a Sunday and has 30 days
    const november = parseDay('2026-11-01');

    const sundayFirst = monthWeeks(november, 0);
    expect(sundayFirst).toHaveLength(5);
    expect(sundayFirst[0][0]).toBe(november);
    expect(sundayFirst[4].filter(day => day !== null)).toHaveLength(2);

    const mondayFirst = monthWeeks(november, 1);
    expect(mondayFirst[0].slice(0, 6)).toEqual(Array(6).fill(null));
    expect(mondayFirst[0][6]).toBe(november);
  });
});
