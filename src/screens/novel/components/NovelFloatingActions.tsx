import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { AppHost, Fab } from '@components';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import ArrowUpwardIcon from '@expo/material-symbols/arrow_upward.xml';
import PlayArrowIcon from '@expo/material-symbols/play_arrow.xml';

interface NovelFloatingActionsProps {
  bottomInset: number;
  continueLabel: string;
  isContinueExtended: boolean;
  loading: boolean;
  onContinue: () => void;
  onScrollToTop: () => void;
  showContinue: boolean;
  showScrollToTop: boolean;
  theme: ThemeColors;
}

const NovelFloatingActions = ({
  bottomInset,
  continueLabel,
  isContinueExtended,
  loading,
  onContinue,
  onScrollToTop,
  showContinue,
  showScrollToTop,
}: NovelFloatingActionsProps) => {
  return (
    <>
      {showScrollToTop ? (
        <AppHost
          matchContents
          style={[styles.scrollToTop, { marginBottom: bottomInset }]}
        >
          <Fab
            icon={ArrowUpwardIcon}
            label={getString('readerScreen.drawer.scrollToTop')}
            onPress={onScrollToTop}
          />
        </AppHost>
      ) : null}
      {showContinue ? (
        <AppHost
          matchContents
          style={[styles.continue, { marginBottom: bottomInset }]}
        >
          <Fab
            extended={isContinueExtended && !loading}
            label={continueLabel}
            icon={PlayArrowIcon}
            onPress={onContinue}
          />
        </AppHost>
      ) : null}
    </>
  );
};

export default memo(NovelFloatingActions);

const styles = StyleSheet.create({
  continue: {
    bottom: 16,
    margin: 16,
    position: 'absolute',
    right: 0,
  },
  scrollToTop: {
    bottom: 32,
    left: 16,
    position: 'absolute',
  },
});
