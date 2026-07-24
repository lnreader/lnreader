import React, { useMemo } from 'react';
import { ThemeColors } from '@theme/types';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { overlay } from 'react-native-paper';
import { getString } from '@i18n/translations';
import { useBoolean } from '@hooks/index';
import { IconButtonV2, Menu } from '@components';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

interface DownloadButtonProps {
  isDownloaded: boolean;
  isDownloading?: boolean;
  theme: ThemeColors;
  deleteChapter: () => void;
  downloadChapter: () => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  isDownloaded,
  isDownloading,
  theme,
  deleteChapter,
  downloadChapter,
}) => {
  const {
    value: deleteChapterMenuVisible,
    setTrue: showDeleteChapterMenu,
    setFalse: hideDeleteChapterMenu,
  } = useBoolean();

  const menuContentStyle = useMemo(
    () => ({ backgroundColor: overlay(2, theme.surface) }),
    [theme.surface],
  );
  const menuTitleStyle = useMemo(
    () => ({ color: theme.onSurface }),
    [theme.onSurface],
  );

  if (isDownloading) {
    return <ChapterDownloadingButton theme={theme} />;
  }
  if (isDownloaded) {
    return (
      <Menu
        visible={deleteChapterMenuVisible}
        onDismiss={hideDeleteChapterMenu}
        anchor={
          <DeleteChapterButton theme={theme} onPress={showDeleteChapterMenu} />
        }
        contentStyle={menuContentStyle}
      >
        <Menu.Item
          onPress={() => {
            deleteChapter();
            hideDeleteChapterMenu();
          }}
          title={getString('common.delete')}
          titleStyle={menuTitleStyle}
        />
      </Menu>
    );
  }
  return <DownloadChapterButton theme={theme} onPress={downloadChapter} />;
};

interface theme {
  theme: ThemeColors;
}
type buttonPropType = theme & {
  onPress: () => void;
};
export const ChapterDownloadingButton: React.FC<theme> = ({ theme }) => (
  <View style={styles.container}>
    <ActivityIndicator
      color={theme.outline}
      size={25}
      style={styles.activityIndicator}
    />
  </View>
);

const DownloadIcon: React.FC<theme> = ({ theme }) => (
  <MaterialCommunityIcons
    name="arrow-down-circle-outline"
    size={25}
    color={theme.outline}
  />
);

export const DownloadChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => (
  <View style={styles.container}>
    <Pressable
      style={styles.pressable}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor }}
    >
      <DownloadIcon theme={theme} />
    </Pressable>
  </View>
);

const DeleteIcon: React.FC<theme> = ({ theme }) => (
  <MaterialCommunityIcons
    name="check-circle"
    size={25}
    color={theme.onSurface}
  />
);

export const DeleteChapterButton: React.FC<buttonPropType> = ({
  theme,
  onPress,
}) => (
  <View style={styles.container}>
    <Pressable
      style={styles.pressable}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor }}
    >
      <DeleteIcon theme={theme} />
    </Pressable>
  </View>
);

export const ChapterBookmarkButton: React.FC<theme> = ({ theme }) => (
  <IconButtonV2
    name="bookmark"
    theme={theme}
    color={theme.primary}
    size={18}
    style={styles.iconButtonLeft}
  />
);

const styles = StyleSheet.create({
  activityIndicator: { margin: 3.5, padding: 5 },
  container: {
    borderRadius: 50,
    width: 40,
    height: 40,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: { margin: 2 },
  iconButtonLeft: { marginLeft: 2 },
});
