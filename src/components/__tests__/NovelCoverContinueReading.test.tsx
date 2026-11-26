import './mocks';
import { Fragment, type ReactElement } from 'react';
import { fireEvent, render, screen } from '@test-utils';
import NovelCover from '../NovelCover';
import { NovelCoverLayoutProvider } from '../NovelCoverLayoutContext';
import { DisplayModes } from '@screens/library/constants/constants';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import LibraryNovelItem from '@screens/library/components/LibraryNovelItem';
import type { History } from '@database/types';

jest.mock(
  '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading',
  () => 'SourceScreenSkeletonLoading',
);
jest.mock('@hooks', () => ({ useDeviceOrientation: () => 'portrait' }));

const novel = {
  id: 1,
  name: 'Example Novel',
  path: '/example',
  pluginId: 'example',
};

const onPress = jest.fn();
const onContinueReading = jest.fn();
const lastReadChapter = {
  id: 7,
  novelId: novel.id,
  name: 'Chapter 7',
} as History;
const renderCover = (element: ReactElement) =>
  render(element, { wrapper: Fragment });

const Cover = ({
  displayMode,
  hasSelection = false,
  canContinue = true,
}: {
  displayMode: DisplayModes;
  hasSelection?: boolean;
  canContinue?: boolean;
}) => {
  const theme = useTheme();

  return (
    <NovelCoverLayoutProvider
      value={{
        coverHeight: 160,
        displayMode,
        numColumns: displayMode === DisplayModes.List ? 1 : 3,
        showDownloadBadges: false,
        showUnreadBadges: false,
      }}
    >
      <NovelCover
        item={novel}
        theme={theme}
        isSelected={false}
        hasSelection={hasSelection}
        onPress={onPress}
        onLongPress={jest.fn()}
        onContinueReading={canContinue ? onContinueReading : undefined}
        libraryStatus={false}
      />
    </NovelCoverLayoutProvider>
  );
};

const LibraryItem = ({
  showContinueReadingButton,
}: {
  showContinueReadingButton: boolean;
}) => {
  const theme = useTheme();

  return (
    <NovelCoverLayoutProvider
      value={{
        coverHeight: 160,
        displayMode: DisplayModes.Comfortable,
        numColumns: 3,
        showDownloadBadges: false,
        showUnreadBadges: false,
      }}
    >
      <LibraryNovelItem
        item={novel}
        theme={theme}
        isSelected={false}
        hasSelection={false}
        onSelect={jest.fn()}
        onNavigate={jest.fn()}
        onContinueReading={onContinueReading}
        lastReadChapter={lastReadChapter}
        showContinueReadingButton={showContinueReadingButton}
        imageRequestInit={undefined}
      />
    </NovelCoverLayoutProvider>
  );
};

describe('NovelCover continue reading', () => {
  beforeEach(() => {
    onPress.mockClear();
    onContinueReading.mockClear();
  });

  it.each([DisplayModes.Compact, DisplayModes.Comfortable, DisplayModes.List])(
    'opens the saved chapter from %s layout',
    displayMode => {
      renderCover(<Cover displayMode={displayMode} />);

      fireEvent.press(
        screen.getByRole('button', {
          name: getString('novelScreen.continueReading'),
        }),
        { stopPropagation: jest.fn() },
      );

      expect(onContinueReading).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    },
  );

  it('hides the shortcut during selection and when there is no reading history', () => {
    const { rerender } = renderCover(
      <Cover displayMode={DisplayModes.Comfortable} hasSelection />,
    );
    expect(
      screen.queryByRole('button', {
        name: getString('novelScreen.continueReading'),
      }),
    ).toBeNull();

    rerender(
      <Cover displayMode={DisplayModes.Comfortable} canContinue={false} />,
    );
    expect(
      screen.queryByRole('button', {
        name: getString('novelScreen.continueReading'),
      }),
    ).toBeNull();
  });

  it('respects the library display setting', () => {
    const { rerender } = renderCover(
      <LibraryItem showContinueReadingButton={false} />,
    );
    expect(
      screen.queryByRole('button', {
        name: getString('novelScreen.continueReading'),
      }),
    ).toBeNull();

    rerender(<LibraryItem showContinueReadingButton />);
    fireEvent.press(
      screen.getByRole('button', {
        name: getString('novelScreen.continueReading'),
      }),
      { stopPropagation: jest.fn() },
    );
    expect(onContinueReading).toHaveBeenCalledWith(novel, lastReadChapter);
  });
});
