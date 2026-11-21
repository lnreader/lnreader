import { render, screen } from '@testing-library/react-native';
import { ChapterInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import RenderListChapter from '../RenderListChapter';

jest.mock('react-native-paper', () => {
  const { Text } = jest.requireActual('react-native');

  return { Text };
});

const theme = {
  onSecondaryContainer: '#111111',
  onSurface: '#222222',
  onSurfaceVariant: '#333333',
  outline: '#444444',
  rippleColor: '#555555',
  secondaryContainer: '#666666',
} as ThemeColors;

const styles = {
  chapterCtn: {},
  drawerElementContainer: {},
  chapterNameCtn: {},
  releaseDateCtn: {},
};

const chapter = {
  id: 1,
  name: 'Chapter 1',
  unread: true,
} as ChapterInfo;

const renderChapter = (item: ChapterInfo, chapterId = 2) =>
  render(
    <RenderListChapter
      item={item}
      styles={styles}
      theme={theme}
      chapterId={chapterId}
      onPress={jest.fn()}
    />,
  );

describe('RenderListChapter', () => {
  it('uses the on-surface color for an unread chapter', () => {
    renderChapter(chapter);

    expect(screen.getByText(chapter.name)).toHaveStyle({
      color: theme.onSurface,
    });
  });

  it('uses the outline color for a read chapter', () => {
    renderChapter({ ...chapter, unread: false });

    expect(screen.getByText(chapter.name)).toHaveStyle({
      color: theme.outline,
    });
  });

  it('formats an ISO release time and keeps non-date text as-is', () => {
    const { rerender } = renderChapter({
      ...chapter,
      releaseTime: '2024-03-05T10:20:30.000Z',
    });
    expect(screen.queryByText('2024-03-05T10:20:30.000Z')).toBeNull();

    rerender(
      <RenderListChapter
        item={{ ...chapter, releaseTime: 'Free since yesterday' }}
        styles={styles}
        theme={theme}
        chapterId={2}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getByText('Free since yesterday')).toBeTruthy();
  });

  it('keeps the current-chapter color regardless of read state', () => {
    renderChapter({ ...chapter, unread: false }, chapter.id);

    expect(screen.getByText(chapter.name)).toHaveStyle({
      color: theme.onSecondaryContainer,
    });
  });
});
