import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { NovelInfo } from '@database/types';
import { useNavigation } from '@react-navigation/native';
import { useBoolean } from '@hooks';
import { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';
import SetCategoryModal from '../SetCategoriesModal';
import { NovelScreenProps } from '@navigators/types';
import { useTrackedNovel, useTracker } from '@hooks/persisted';
import Animated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import { MaterialDesignIconName } from '@type/icon';

const NButton = ({
  onPress,
  onLongPress,
  icon,
  label,
  color,
  theme,
}: {
  onPress: () => void;
  onLongPress?: () => void;
  icon: MaterialDesignIconName;
  label: string;
  color?: string;
  theme: ThemeColors;
}) => {
  return (
    <Animated.View
      entering={ZoomIn.duration(150)}
      exiting={ZoomOut.duration(150)}
      collapsable={false}
      style={styles.buttonContainer}
    >
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.button}
      >
        <MaterialCommunityIcons
          name={icon}
          color={color ?? theme.outline}
          size={24}
        />
        <Text style={[styles.buttonLabel, { color: color ?? theme.outline }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};
const Button = memo(NButton);

interface NovelScreenButtonGroupProps {
  novel: NovelInfo | (Omit<NovelInfo, 'id'> & { id: 'NO_ID' });
  theme: ThemeColors;
  handleTrackerSheet: () => void;
  handleFollowNovel: () => void;
}

const NovelScreenButtonGroup: React.FC<NovelScreenButtonGroupProps> = ({
  novel,
  handleTrackerSheet,
  handleFollowNovel,
  theme,
}) => {
  const { inLibrary, isLocal } = novel;
  const { navigate } = useNavigation<NovelScreenProps['navigation']>();
  const { tracker } = useTracker();
  const { trackedNovel } = useTrackedNovel(novel.id);

  const followButtonColor = inLibrary ? theme.primary : theme.outline;
  const trackerButtonColor = trackedNovel ? theme.primary : theme.outline;

  const handleOpenWebView = async () => {
    navigate('WebviewScreen', {
      name: novel.name,
      url: novel.path,
      pluginId: novel.pluginId,
      isNovel: true,
    });
  };
  const handleMigrateNovel = () =>
    novel.id !== 'NO_ID' &&
    navigate('MigrateNovel', {
      novel: novel,
    });

  const {
    value: setCategoryModalVisible,
    setTrue: showSetCategoryModal,
    setFalse: closeSetCategoryModal,
  } = useBoolean();

  return (
    <>
      <View style={styles.buttonGroupContainer}>
        <Button
          theme={theme}
          onPress={handleFollowNovel}
          onLongPress={showSetCategoryModal}
          icon={inLibrary ? 'heart' : 'heart-outline'}
          label={getString(
            inLibrary ? 'novelScreen.inLibaray' : 'novelScreen.addToLibaray',
          )}
          color={followButtonColor}
        />

        {tracker ? (
          <Button
            theme={theme}
            onPress={handleTrackerSheet}
            icon={trackedNovel ? 'check' : 'sync'}
            label={
              trackedNovel
                ? getString('novelScreen.tracked')
                : getString('novelScreen.tracking')
            }
            color={trackerButtonColor}
          />
        ) : null}
        {inLibrary && !isLocal ? (
          <Button
            theme={theme}
            onPress={handleMigrateNovel}
            icon="swap-vertical-variant"
            label={getString('novelScreen.migrate')}
          />
        ) : null}
        {!isLocal ? (
          <Button
            theme={theme}
            onPress={handleOpenWebView}
            icon="earth"
            label={'WebView'}
          />
        ) : null}
      </View>
      {novel.id !== 'NO_ID' && setCategoryModalVisible ? (
        <SetCategoryModal
          novelIds={[novel.id]}
          closeModal={closeSetCategoryModal}
          visible
        />
      ) : null}
    </>
  );
};

export default memo(NovelScreenButtonGroup);

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  buttonContainer: {
    borderRadius: 50,
    flex: 1,
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  buttonGroupContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    paddingTop: 8,
  },
  buttonLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
