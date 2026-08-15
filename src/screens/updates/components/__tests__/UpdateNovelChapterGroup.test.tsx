import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { Update, UpdateOverview } from '@database/types';
import UpdateNovelChapterGroup from '../UpdateNovelChapterGroup';

const mockUseDetailedUpdates = jest.fn();
const mockNovelChapterGroup = jest.fn();

jest.mock('@hooks/persisted/useUpdates', () => ({
  useDetailedUpdates: (...args: unknown[]) => mockUseDetailedUpdates(...args),
}));

jest.mock('@screens/novel/components/NovelChapterGroup', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: (props: { onExpand?: () => void }) => {
      mockNovelChapterGroup(props);
      return ReactModule.createElement(Pressable, {
        onPress: props.onExpand,
        testID: 'novel-chapter-group',
      });
    },
  };
});

const overview: UpdateOverview = {
  inLibrary: true,
  novelId: 42,
  pluginId: 'source-id',
  novelName: 'Example Novel',
  novelPath: '/example-novel',
  novelCover: null,
  updateDate: '2026-07-24',
  updatesPerDay: 2,
};

describe('UpdateNovelChapterGroup', () => {
  beforeEach(() => {
    mockUseDetailedUpdates.mockReset();
    mockNovelChapterGroup.mockReset();
    mockUseDetailedUpdates.mockReturnValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('subscribes a collapsed group only on its first expansion', () => {
    render(
      <UpdateNovelChapterGroup
        chapterCountLabel="updates"
        onDeleteChapter={jest.fn()}
        overview={overview}
      />,
    );

    expect(mockUseDetailedUpdates).not.toHaveBeenCalled();
    expect(mockNovelChapterGroup.mock.calls.at(-1)?.[0].novel).toMatchObject({
      inLibrary: true,
    });

    fireEvent.press(screen.getByTestId('novel-chapter-group'));

    expect(mockUseDetailedUpdates).toHaveBeenCalledWith(
      overview.novelId,
      false,
      overview.updateDate,
    );

    fireEvent.press(screen.getByTestId('novel-chapter-group'));

    expect(mockUseDetailedUpdates).toHaveBeenCalledTimes(1);
  });

  it('loads a single-chapter group immediately because it has no accordion', async () => {
    jest.useFakeTimers();

    render(
      <UpdateNovelChapterGroup
        chapterCountLabel="update"
        onDeleteChapter={jest.fn()}
        overview={{ ...overview, updatesPerDay: 1 }}
      />,
    );

    expect(mockUseDetailedUpdates).not.toHaveBeenCalled();

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(mockUseDetailedUpdates).toHaveBeenCalledTimes(1);
  });

  it('updates a loaded chapter when its reactive query changes', async () => {
    const initialChapters = [
      {
        id: 1,
        isDownloaded: false,
        name: 'Chapter 1',
      } as Update,
    ];
    let setReactiveChapters:
      | React.Dispatch<React.SetStateAction<Update[]>>
      | undefined;
    mockUseDetailedUpdates.mockImplementation(() => {
      const ReactModule = jest.requireActual<typeof import('react')>('react');
      const [reactiveChapters, setChapters] =
        ReactModule.useState(initialChapters);
      setReactiveChapters = setChapters;
      return reactiveChapters;
    });

    render(
      <UpdateNovelChapterGroup
        chapterCountLabel="updates"
        onDeleteChapter={jest.fn()}
        overview={overview}
      />,
    );

    fireEvent.press(screen.getByTestId('novel-chapter-group'));

    expect(
      mockNovelChapterGroup.mock.calls.at(-1)?.[0].chapters[0],
    ).toMatchObject({ id: 1, isDownloaded: false });

    act(() => {
      setReactiveChapters?.([{ ...initialChapters[0], isDownloaded: true }]);
    });

    await waitFor(() =>
      expect(
        mockNovelChapterGroup.mock.calls.at(-1)?.[0].chapters[0],
      ).toMatchObject({ id: 1, isDownloaded: true }),
    );
  });
});
