import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { Button } from '@components';
import { getString } from '@i18n/translations';
import { ChapterInfo } from '@database/types';
import { useAppSettings } from '@hooks/persisted';

interface ReadButtonProps {
  firstUnreadChapter?: ChapterInfo;
  lastRead?: ChapterInfo;
  navigateToChapter: (chapter: ChapterInfo) => void;
}

const ReadButton = ({
  firstUnreadChapter,
  lastRead,
  navigateToChapter,
}: ReadButtonProps) => {
  const { useFabForContinueReading = false } = useAppSettings();

  const targetChapter = lastRead ?? firstUnreadChapter;

  const navigateToTargetChapter = () => {
    if (targetChapter) {
      navigateToChapter(targetChapter);
    }
  };

  if (!useFabForContinueReading) {
    return targetChapter ? (
      <Button
        title={
          lastRead
            ? `${getString('novelScreen.continueReading')} ${lastRead.name}`
            : getString('novelScreen.startReadingChapters', {
                name: targetChapter.name,
              })
        }
        modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
        onPress={navigateToTargetChapter}
        mode="contained"
      />
    ) : null;
  } else {
    return null;
  }
};

export default ReadButton;
