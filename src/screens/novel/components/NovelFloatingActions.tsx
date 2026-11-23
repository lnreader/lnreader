import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { AnimatedFAB } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { NOVEL_FAB_HEIGHT, NOVEL_FAB_MARGIN } from '../novelLayout';

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
  theme,
}: NovelFloatingActionsProps) => {
  const scrollToTopStyle = useMemo(
    () => [
      styles.scrollToTop,
      { backgroundColor: theme.surface2, marginBottom: bottomInset },
    ],
    [bottomInset, theme.surface2],
  );
  const continueStyle = useMemo(
    () => [
      styles.continue,
      { backgroundColor: theme.primary, marginBottom: bottomInset },
    ],
    [bottomInset, theme.primary],
  );

  return (
    <>
      {showScrollToTop ? (
        <AnimatedFAB
          style={scrollToTopStyle}
          color={theme.primary}
          icon="arrow-up"
          label=""
          extended={false}
          onPress={onScrollToTop}
          visible
        />
      ) : null}
      {showContinue ? (
        <AnimatedFAB
          style={continueStyle}
          extended={isContinueExtended && !loading}
          color={theme.onPrimary}
          uppercase={false}
          label={continueLabel}
          icon="play"
          onPress={onContinue}
        />
      ) : null}
    </>
  );
};

export default memo(NovelFloatingActions);

const styles = StyleSheet.create({
  continue: {
    bottom: NOVEL_FAB_MARGIN,
    height: NOVEL_FAB_HEIGHT,
    margin: NOVEL_FAB_MARGIN,
    position: 'absolute',
    right: 0,
  },
  scrollToTop: {
    bottom: NOVEL_FAB_MARGIN,
    position: 'absolute',
  },
});
