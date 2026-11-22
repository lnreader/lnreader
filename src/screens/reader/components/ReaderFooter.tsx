import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import color from 'color';
import Animated from 'react-native-reanimated';
import { useChapterContext } from '../ChapterContext';
import { useTheme } from '@hooks/persisted';
import { useNovelLayout } from '@screens/novel/NovelContext';

interface ChapterFooterProps {
  visible: boolean;
  fadeDuration: number;
  openReaderSheet: () => void;
  scrollToStart: () => void;
  openDrawer: () => void;
}

const ChapterFooter = ({
  visible,
  fadeDuration,
  openReaderSheet,
  scrollToStart,
  openDrawer,
}: ChapterFooterProps) => {
  const { nextChapter, prevChapter, navigateChapter } = useChapterContext();
  const theme = useTheme();
  const rippleConfig = {
    color: theme.rippleColor,
    borderless: true,
    radius: 50,
  };
  const { navigationBarHeight } = useNovelLayout();

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[
        styles.footer,
        {
          backgroundColor: color(theme.surface).alpha(0.9).string(),
          paddingBottom: navigationBarHeight,
          opacity: visible ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: fadeDuration,
          transitionTimingFunction: 'ease-out',
        },
      ]}
    >
      <View style={styles.buttonsContainer}>
        <Pressable
          android_ripple={rippleConfig}
          style={styles.buttonStyles}
          onPress={() => navigateChapter('PREV')}
        >
          <IconButton
            icon="chevron-left"
            size={26}
            disabled={!prevChapter}
            iconColor={theme.onSurface}
          />
        </Pressable>
        <Pressable
          android_ripple={rippleConfig}
          style={styles.buttonStyles}
          onPress={() => scrollToStart()}
        >
          <IconButton
            icon="arrow-collapse-up"
            size={26}
            iconColor={theme.onSurface}
          />
        </Pressable>
        <Pressable
          android_ripple={rippleConfig}
          style={styles.buttonStyles}
          onPress={() => openDrawer()}
        >
          <IconButton
            icon="format-list-bulleted"
            size={26}
            iconColor={theme.onSurface}
          />
        </Pressable>
        <Pressable
          android_ripple={rippleConfig}
          style={styles.buttonStyles}
          onPress={openReaderSheet}
        >
          <IconButton
            icon="cog-outline"
            size={26}
            iconColor={theme.onSurface}
          />
        </Pressable>
        <Pressable
          android_ripple={rippleConfig}
          style={styles.buttonStyles}
          onPress={() => navigateChapter('NEXT')}
        >
          <IconButton
            icon="chevron-right"
            size={26}
            disabled={!nextChapter}
            iconColor={theme.onSurface}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
};

export default React.memo(ChapterFooter);

const styles = StyleSheet.create({
  buttonStyles: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 4,
    paddingVertical: 8,
  },
  buttonsContainer: {
    flexDirection: 'row',
  },
  footer: {
    bottom: 0,
    flex: 1,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
});
