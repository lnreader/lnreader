import {
  useAppSettings,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from './useSettings';

const restoreIfUnchanged = <T>(current: T, preset: T, previous: T): T =>
  current === preset ? previous : current;

export const useEPaperOptimizations = () => {
  const {
    disableLoadingAnimations = false,
    reduceAppAnimations = false,
    ePaperOptimizations = false,
    ePaperPreviousSettings,
    setAppSettings,
  } = useAppSettings();
  const readerGeneral = useChapterGeneralSettings();
  const readerTheme = useChapterReaderSettings();

  const applyEPaperOptimizations = () => {
    if (ePaperOptimizations) return;

    setAppSettings({
      ePaperOptimizations: true,
      disableLoadingAnimations: true,
      reduceAppAnimations: true,
      ePaperPreviousSettings: {
        disableLoadingAnimations,
        reduceAppAnimations,
        readerTheme: {
          backgroundColor: readerTheme.theme,
          textColor: readerTheme.textColor,
        },
        readerGeneral: {
          pageReader: readerGeneral.pageReader,
          useVolumeButtons: readerGeneral.useVolumeButtons,
          pageReaderDisableAnimation: readerGeneral.pageReaderDisableAnimation,
          autoScroll: readerGeneral.autoScroll,
        },
      },
    });
    readerTheme.setChapterReaderSettings({
      theme: '#FFFFFF',
      textColor: '#000000',
    });
    readerGeneral.setChapterGeneralSettings({
      pageReader: true,
      useVolumeButtons: true,
      pageReaderDisableAnimation: true,
      autoScroll: false,
    });
  };

  const disableEPaperOptimizations = () => {
    const previous = ePaperPreviousSettings;
    setAppSettings({
      ePaperOptimizations: false,
      ePaperPreviousSettings: undefined,
      disableLoadingAnimations: previous
        ? restoreIfUnchanged(
            disableLoadingAnimations,
            true,
            previous.disableLoadingAnimations,
          )
        : disableLoadingAnimations,
      reduceAppAnimations: previous
        ? restoreIfUnchanged(
            reduceAppAnimations,
            true,
            previous.reduceAppAnimations,
          )
        : reduceAppAnimations,
    });
    if (!previous) return;

    readerGeneral.setChapterGeneralSettings({
      pageReader: restoreIfUnchanged(
        readerGeneral.pageReader,
        true,
        previous.readerGeneral.pageReader,
      ),
      useVolumeButtons: restoreIfUnchanged(
        readerGeneral.useVolumeButtons,
        true,
        previous.readerGeneral.useVolumeButtons,
      ),
      pageReaderDisableAnimation: restoreIfUnchanged(
        readerGeneral.pageReaderDisableAnimation,
        true,
        previous.readerGeneral.pageReaderDisableAnimation,
      ),
      autoScroll: restoreIfUnchanged(
        readerGeneral.autoScroll,
        false,
        previous.readerGeneral.autoScroll,
      ),
    });
    if (
      readerTheme.theme === '#FFFFFF' &&
      readerTheme.textColor === '#000000'
    ) {
      readerTheme.setChapterReaderSettings({
        theme: previous.readerTheme.backgroundColor,
        textColor: previous.readerTheme.textColor,
      });
    }
  };

  return {
    ePaperOptimizations,
    applyEPaperOptimizations,
    disableEPaperOptimizations,
  };
};
