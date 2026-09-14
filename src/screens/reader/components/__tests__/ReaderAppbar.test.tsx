import { fireEvent, render, screen } from '@testing-library/react-native';
import ReaderAppbar from '../ReaderAppbar';

const mockUseChapterContext = jest.fn();
const onToggleTranslation = jest.fn();

jest.mock('@screens/reader/ChapterContext', () => ({
  useChapterContext: () => mockUseChapterContext(),
}));

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelLayout: () => ({ statusBarHeight: 0 }),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  bookmarkChapter: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@components', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  const IconButtonV2 = ({ name, onPress, accessibilityLabel }: any) =>
    React.createElement(
      Pressable,
      { onPress, accessibilityLabel },
      React.createElement(Text, null, name),
    );

  const Menu: any = () => null;
  Menu.Item = ({ title, onPress }: any) =>
    React.createElement(
      Pressable,
      { onPress },
      React.createElement(Text, null, title),
    );

  return { IconButtonV2, Menu };
});

jest.mock('../ReaderSearchbar', () => () => null);

const buildProps = () => ({
  theme: {
    primary: '#aabbcc',
    onSurface: '#bbccdd',
    onSurfaceVariant: '#ccddee',
    surface: '#dddddd',
  } as any,
  goBack: jest.fn(),
  bookmarked: false,
  setBookmarked: jest.fn(),
  searchVisible: false,
  setSearchVisible: jest.fn(),
  searchText: '',
  setSearchText: jest.fn(),
  searchResult: {} as any,
  resetSearchResult: jest.fn(),
  resetSearch: jest.fn(),
  openInWebView: jest.fn(),
  openInBrowser: jest.fn(),
  shareChapter: jest.fn(),
  translationEnabled: false,
  onToggleTranslation,
});

describe('ReaderAppbar', () => {
  beforeEach(() => {
    mockUseChapterContext.mockReturnValue({
      chapter: { id: 1, name: 'Chapter 1' },
      novel: { id: 42, name: 'A Novel', isLocal: false },
      refetch: jest.fn(),
    });
    onToggleTranslation.mockClear();
  });

  it('renders the translation quick toggle', () => {
    render(<ReaderAppbar {...buildProps()} />);
    expect(
      screen.getByLabelText('readerScreen.bottomSheet.translation'),
    ).toBeTruthy();
  });

  it('toggles translation from the quick toggle', () => {
    render(<ReaderAppbar {...buildProps()} />);
    fireEvent.press(
      screen.getByLabelText('readerScreen.bottomSheet.translation'),
    );
    expect(onToggleTranslation).toHaveBeenCalledTimes(1);
  });

  it('still toggles when translation is already enabled', () => {
    const props = buildProps();
    props.translationEnabled = true;
    render(<ReaderAppbar {...props} />);
    fireEvent.press(
      screen.getByLabelText('readerScreen.bottomSheet.translation'),
    );
    expect(onToggleTranslation).toHaveBeenCalledTimes(1);
  });
});
