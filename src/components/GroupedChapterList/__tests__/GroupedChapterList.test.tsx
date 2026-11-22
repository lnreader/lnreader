import { useState } from 'react';

import { fireEvent, render, screen } from '@test-utils';
import { createGroupedChapterListStore } from '@modules/nitro-chapter-list';
import type { DownloadedChapter, NovelInfo } from '@database/types';
import type { ThemeColors } from '@theme/types';
import GroupedChapterList, { toggleChapterGroup } from '../GroupedChapterList';

const { mockNavigate } = require('../../../../test/mocks/react-navigation');
const mockDownloadChapter = jest.fn();
const mockDeleteChapter = jest.fn();

jest.mock('@hooks/persisted', () => ({}));
jest.mock('@screens/novel/NovelContext', () => ({}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@hooks/persisted/useDownload', () => () => ({
  downloadChapter: mockDownloadChapter,
  downloadingChapterIds: new Set([4]),
}));

const novel: NovelInfo = {
  id: 7,
  name: 'Example',
  path: '/example',
  pluginId: 'example',
};
const chapters: DownloadedChapter[] = Array.from(
  { length: 5000 },
  (_, index) => ({
    id: index + 1,
    novelId: novel.id,
    name: `Chapter ${index + 1}`,
    chapterNumber: index + 1,
    path: `/${index + 1}`,
    page: '1',
    unread: true,
    isDownloaded: index === 0,
    bookmark: false,
    updatedTime: null,
    readTime: null,
    progress: null,
    timeSpent: null,
    pluginId: novel.pluginId,
    novelName: novel.name,
    novelPath: novel.path,
    novelCover: null,
  }),
);

const sections = [
  {
    key: 'date',
    title: 'Today',
    groups: [{ key: 'example', novel, count: chapters.length, chapters }],
  },
];

const TestList = () => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return (
    <GroupedChapterList
      sections={sections}
      expanded={expanded}
      onToggleGroup={key =>
        setExpanded(previous => toggleChapterGroup(previous, key))
      }
      onDeleteChapter={mockDeleteChapter}
      countLabel="updates"
      theme={{} as ThemeColors}
    />
  );
};

it('sends individual native rows only when expanded and routes actions by row key', () => {
  render(<TestList />);
  const store = jest
    .mocked(createGroupedChapterListStore)
    .mock.results.at(-1)?.value;
  const setRows = jest.mocked(store!.setRows);
  const nativeList = screen.getByTestId('grouped-chapter-list');

  expect(setRows.mock.lastCall?.[0]).toEqual([
    expect.objectContaining({ kind: 'label', title: 'Today' }),
    expect.objectContaining({
      kind: 'group',
      key: 'group-example',
      expanded: false,
    }),
  ]);

  fireEvent(nativeList, 'rowPress', { nativeEvent: { key: 'group-example' } });
  expect(setRows.mock.lastCall?.[0]).toHaveLength(5002);
  expect(setRows.mock.lastCall?.[0].at(-1)).toMatchObject({
    key: 'chapter-5000',
    kind: 'chapter',
  });

  fireEvent(nativeList, 'rowPress', { nativeEvent: { key: 'chapter-5000' } });
  expect(mockNavigate).toHaveBeenLastCalledWith('ReaderStack', {
    screen: 'Chapter',
    params: { novel, chapter: chapters.at(-1) },
  });
  fireEvent(nativeList, 'coverPress', {
    nativeEvent: { key: 'group-example' },
  });
  expect(mockNavigate).toHaveBeenLastCalledWith(
    'ReaderStack',
    expect.objectContaining({ screen: 'Novel' }),
  );

  fireEvent(nativeList, 'downloadPress', { nativeEvent: { key: 'chapter-2' } });
  expect(mockDownloadChapter).toHaveBeenCalledWith(novel, chapters[1]);
  fireEvent(nativeList, 'deletePress', { nativeEvent: { key: 'chapter-1' } });
  expect(mockDeleteChapter).toHaveBeenCalledWith(chapters[0]);

  fireEvent(nativeList, 'rowPress', { nativeEvent: { key: 'group-example' } });
  expect(setRows.mock.lastCall?.[0]).toHaveLength(2);
});
