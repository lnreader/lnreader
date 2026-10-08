import { fireEvent, render, screen } from '@test-utils';

import { getNovelsWithGenresFromDb } from '@database/queries/StatsQueries';

import SettingsTaxonomyScreen from '../SettingsTaxonomyScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => () => void) => {
    require('react').useEffect(callback, [callback]);
  },
}));

let mockTaxonomy: { parent: string; children: string[] }[] = [];
const mockSetTaxonomy = jest.fn(
  (next: { parent: string; children: string[] }[]) => {
    mockTaxonomy = next;
  },
);

jest.mock('@hooks/persisted/useGenreTaxonomy', () => ({
  useGenreTaxonomy: () => ({
    taxonomy: mockTaxonomy,
    setTaxonomy: mockSetTaxonomy,
  }),
}));

jest.mock('@database/queries/StatsQueries', () => ({
  getNovelsWithGenresFromDb: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

const renderScreen = () =>
  render(
    <SettingsTaxonomyScreen
      navigation={{ goBack: jest.fn() } as never}
      route={{} as never}
    />,
  );

describe('SettingsTaxonomyScreen', () => {
  beforeEach(() => {
    mockTaxonomy = [{ parent: 'Fantasy', children: ['Sci-Fi'] }];
    mockSetTaxonomy.mockClear();
    jest
      .mocked(getNovelsWithGenresFromDb)
      .mockImplementation(() => new Promise(() => {}));
  });

  it('refuses a parent that normalizes to an existing parent', () => {
    renderScreen();
    fireEvent.press(screen.getByText('genreStats.newGroup'));
    fireEvent.changeText(screen.getByTestId('taxonomy-group-name'), 'fantasy');
    fireEvent.press(screen.getByText('common.ok'));
    expect(mockSetTaxonomy).not.toHaveBeenCalled();
  });

  it('adds a parent with a distinct normalized name', () => {
    renderScreen();
    fireEvent.press(screen.getByText('genreStats.newGroup'));
    fireEvent.changeText(screen.getByTestId('taxonomy-group-name'), 'Comedy');
    fireEvent.press(screen.getByText('common.ok'));
    expect(mockSetTaxonomy).toHaveBeenCalledWith([
      { parent: 'Fantasy', children: ['Sci-Fi'] },
      { parent: 'Comedy', children: [] },
    ]);
  });

  it('stays in the dialog to add subgenres right after adding a parent', () => {
    renderScreen();
    fireEvent.press(screen.getByText('genreStats.newGroup'));
    fireEvent.changeText(screen.getByTestId('taxonomy-group-name'), 'Comedy');
    fireEvent.press(screen.getByText('common.ok'));
    // Dialog switched to edit mode for the new parent: child input is live
    fireEvent.changeText(
      screen.getByTestId('taxonomy-genre-name'),
      'Slice of Life',
    );
    fireEvent.press(screen.getByLabelText('common.add'));
    expect(mockSetTaxonomy).toHaveBeenLastCalledWith([
      { parent: 'Fantasy', children: ['Sci-Fi'] },
      { parent: 'Comedy', children: ['Slice of Life'] },
    ]);
  });

  it('refuses renaming a parent to a normalized duplicate', () => {
    mockTaxonomy = [
      { parent: 'Fantasy', children: [] },
      { parent: 'Romance', children: [] },
    ];
    renderScreen();
    fireEvent.press(screen.getByText('Fantasy'));
    fireEvent.changeText(screen.getByTestId('taxonomy-group-name'), 'romance');
    fireEvent.press(screen.getByText('common.ok'));
    expect(mockSetTaxonomy).not.toHaveBeenCalled();
  });

  it('refuses a child that normalizes to an existing child', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Fantasy'));
    fireEvent.changeText(screen.getByTestId('taxonomy-genre-name'), 'SCIFI');
    fireEvent.press(screen.getByLabelText('common.add'));
    expect(mockSetTaxonomy).not.toHaveBeenCalled();
  });

  it('adds a child with a distinct normalized name', () => {
    renderScreen();
    fireEvent.press(screen.getByText('Fantasy'));
    fireEvent.changeText(screen.getByTestId('taxonomy-genre-name'), 'Harem');
    fireEvent.press(screen.getByLabelText('common.add'));
    expect(mockSetTaxonomy).toHaveBeenCalledWith([
      { parent: 'Fantasy', children: ['Sci-Fi', 'Harem'] },
    ]);
  });

  it('suggests ungrouped library genres and adds one to the group', async () => {
    jest.mocked(getNovelsWithGenresFromDb).mockResolvedValue([
      {
        id: 1,
        name: 'Novel',
        path: '',
        cover: null,
        pluginId: '',
        genres: 'Sci Fi, Wuxia',
        status: null,
      },
    ]);
    renderScreen();
    fireEvent.press(screen.getByText('Fantasy'));
    expect(await screen.findByText('Wuxia')).toBeTruthy();
    expect(screen.queryByText('Sci Fi')).toBeNull();
    fireEvent.press(screen.getByText('Wuxia'));
    expect(mockSetTaxonomy).toHaveBeenLastCalledWith([
      { parent: 'Fantasy', children: ['Sci-Fi', 'Wuxia'] },
    ]);
  });
});
