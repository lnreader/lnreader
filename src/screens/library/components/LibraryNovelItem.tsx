import { memo, useCallback } from 'react';
import NovelCover from '@components/NovelCover';
import { History, NovelInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import { ImageRequestInit } from '@plugins/types';

interface LibraryNovelItemProps {
  item: NovelInfo;
  theme: ThemeColors;
  isSelected: boolean;
  hasSelection: boolean;
  onSelect: (id: number) => void;
  onNavigate: (item: NovelInfo) => void;
  onContinueReading: (item: NovelInfo, chapter: History) => void;
  lastReadChapter?: History;
  showContinueReadingButton: boolean;
  imageRequestInit: ImageRequestInit | undefined;
}

const LibraryNovelItem = memo(function LibraryNovelItem_({
  item,
  theme,
  isSelected,
  hasSelection,
  onSelect,
  onNavigate,
  onContinueReading,
  lastReadChapter,
  showContinueReadingButton,
  imageRequestInit,
}: LibraryNovelItemProps) {
  const handleLongPress = useCallback(() => {
    onSelect(item.id);
  }, [item.id, onSelect]);

  const handlePress = useCallback(() => {
    if (hasSelection) {
      onSelect(item.id);
    } else {
      onNavigate(item);
    }
  }, [hasSelection, item, onSelect, onNavigate]);

  const handleContinueReading = useCallback(() => {
    if (lastReadChapter) {
      onContinueReading(item, lastReadChapter);
    }
  }, [item, lastReadChapter, onContinueReading]);

  return (
    <NovelCover
      item={item}
      theme={theme}
      isSelected={isSelected}
      hasSelection={hasSelection}
      onLongPress={handleLongPress}
      onPress={handlePress}
      onContinueReading={
        showContinueReadingButton && lastReadChapter
          ? handleContinueReading
          : undefined
      }
      libraryStatus={false}
      imageRequestInit={imageRequestInit}
    />
  );
});

export default LibraryNovelItem;
