import { fireEvent, render, screen } from '@test-utils';
import ChapterTextFilters from '../ChapterTextFilters';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@hooks/persisted/useTheme');
jest.mock('@hooks/persisted', () => ({
  useTheme: () => require('@hooks/persisted/useTheme').mockTheme,
}));
jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  useNovelValue: () => {
    throw new Error('Novel context is unavailable inside the sheet portal');
  },
  useNovelAction: () => {
    throw new Error('Novel context is unavailable inside the sheet portal');
  },
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const { TextInput } = require('react-native');
  return {
    BottomSheetTextInput: TextInput,
    BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
      children,
  };
});
jest.mock('@i18n/translations', () => ({ getString: (key: string) => key }));

describe('ChapterTextFilters in the sheet portal', () => {
  it('renders and adds a novel filter without access to novel context', () => {
    const save = jest.fn();
    render(
      <ChapterTextFilters
        chapterTextFilters={['Existing text']}
        setChapterTextFilters={save}
      />,
    );
    fireEvent.changeText(
      screen.getByLabelText('readerScreen.bottomSheet.filterText'),
      'Unwanted text',
    );
    fireEvent.press(screen.getByLabelText('common.add'));
    expect(save).toHaveBeenCalledWith(['Existing text', 'Unwanted text']);
    expect(
      screen.getByLabelText('readerScreen.bottomSheet.filterText').props.value,
    ).toBe('');
  });

  it('removes only the selected filter', () => {
    const save = jest.fn();
    render(
      <ChapterTextFilters
        chapterTextFilters={['First', 'Second']}
        setChapterTextFilters={save}
      />,
    );
    fireEvent.press(screen.getByLabelText('common.remove: First'));
    expect(save).toHaveBeenCalledWith(['Second']);
  });

  it('does not save blank or duplicate filters', () => {
    const save = jest.fn();
    render(
      <ChapterTextFilters
        chapterTextFilters={['Existing']}
        setChapterTextFilters={save}
      />,
    );
    const input = screen.getByLabelText('readerScreen.bottomSheet.filterText');
    fireEvent.changeText(input, '   ');
    fireEvent(input, 'submitEditing');
    fireEvent.changeText(input, 'Existing');
    fireEvent(input, 'submitEditing');
    expect(save).not.toHaveBeenCalled();
  });
});
