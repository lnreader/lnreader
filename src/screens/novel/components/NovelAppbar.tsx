import React, { memo, useCallback, useMemo, useState } from 'react';
import { getString } from '@strings/translations';
import { Appbar } from 'react-native-paper';
import { Menu as DefaultMenu } from '@components';
import { ThemeColors } from '@theme/types';
import Animated, {
  FadeIn,
  FadeOut,
  SharedValue,
  SlideInUp,
  SlideOutUp,
  interpolateColor,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ExportNovelAsEpubButton from './ExportNovelAsEpubButton';
import { NovelInfo } from '@database/types';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { MaterialDesignIconName } from '@type/icon';

const AnimatedAppbarAction = Animated.createAnimatedComponent(Appbar.Action);

const Menu = React.memo(
  ({
    visible,
    onDismiss,
    anchor,
    items,
    theme,
  }: {
    visible: boolean;
    onDismiss: () => void;
    anchor: React.ReactNode;
    theme: ThemeColors;
    items: { label: string; onPress: () => void }[];
  }) => {
    const contentStyle = useMemo(
      () => ({ backgroundColor: theme.surface2 }),
      [theme.surface2],
    );
    const itemStyle = useMemo(
      () => ({ backgroundColor: theme.surface2 }),
      [theme.surface2],
    );
    const titleStyle = useMemo(
      () => ({ color: theme.onSurface }),
      [theme.onSurface],
    );

    return (
      <DefaultMenu
        visible={visible}
        onDismiss={onDismiss}
        anchor={anchor}
        contentStyle={contentStyle}
      >
        {items.map((item, index) => (
          <DefaultMenu.Item
            key={index + item.label}
            title={item.label}
            style={itemStyle}
            titleStyle={titleStyle}
            onPress={() => {
              onDismiss();
              item.onPress();
            }}
          />
        ))}
      </DefaultMenu>
    );
  },
);

const NovelAppbar = ({
  novel,
  theme,
  isLocal,
  downloadChapters,
  deleteChapters,
  showEditInfoModal,
  downloadCustomChapterModal,
  setCustomNovelCover,
  goBack,
  shareNovel,
  showJumpToChapterModal,
  headerOpacity,
}: {
  novel: NovelInfo | undefined;
  theme: ThemeColors;
  isLocal: boolean | undefined;
  downloadChapters: (amount: number | 'all' | 'unread') => void;
  deleteChapters: () => void;
  showEditInfoModal: React.Dispatch<React.SetStateAction<boolean>>;
  downloadCustomChapterModal: () => void;
  setCustomNovelCover: () => Promise<void>;
  goBack: () => void;
  shareNovel: () => void;
  showJumpToChapterModal: (arg: boolean) => void;
  headerOpacity: SharedValue<number>;
}) => {
  const headerOpacityStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      headerOpacity.value,
      [0, 1],
      ['transparent', theme.surface2 || theme.surface],
    );
    return {
      backgroundColor,
    };
  });

  const [downloadMenu, showDownloadMenu] = useState(false);
  const [extraMenu, showExtraMenu] = useState(false);

  const appbarTheme = useMemo(() => ({ colors: theme }), [theme]);

  const AppbarAction = useCallback(
    (props: {
      icon: MaterialDesignIconName;
      onPress: () => void;
      style?: StyleProp<ViewStyle>;
      size?: number;
    }) => {
      return (
        <AnimatedAppbarAction
          entering={FadeIn.duration(250)}
          exiting={FadeOut.delay(50).duration(250)}
          theme={appbarTheme}
          size={24}
          {...props}
        />
      );
    },
    [appbarTheme],
  );

  const downloadMenuItems = useMemo(() => {
    return [
      {
        label: getString('novelScreen.download.next'),
        onPress: () => downloadChapters(1),
      },
      {
        label: getString('novelScreen.download.next5'),
        onPress: () => downloadChapters(5),
      },
      {
        label: getString('novelScreen.download.next10'),
        onPress: () => downloadChapters(10),
      },
      {
        label: getString('novelScreen.download.custom'),
        onPress: () => downloadCustomChapterModal(),
      },
      {
        label: getString('novelScreen.download.unread'),
        onPress: () => downloadChapters('unread'),
      },
      {
        label: getString('common.all'),
        onPress: () => downloadChapters('all'),
      },
      {
        label: getString('novelScreen.download.delete'),
        onPress: () => deleteChapters(),
      },
    ];
  }, [deleteChapters, downloadChapters, downloadCustomChapterModal]);

  const extraMenuItems = useMemo(
    () => [
      {
        label: getString('novelScreen.edit.info'),
        onPress: () => showEditInfoModal(true),
      },
      {
        label: getString('novelScreen.edit.cover'),
        onPress: () => setCustomNovelCover(),
      },
    ],
    [showEditInfoModal, setCustomNovelCover],
  );

  const openDlMenu = useCallback(() => showDownloadMenu(true), []);
  const closeDlMenu = useCallback(() => showDownloadMenu(false), []);
  const openExtraMenu = useCallback(() => showExtraMenu(true), []);
  const closeExtraMenu = useCallback(() => showExtraMenu(false), []);

  const openJumpToChapter = useCallback(
    () => showJumpToChapterModal(true),
    [showJumpToChapterModal],
  );

  const headerTheme = useMemo(
    () => ({ colors: { ...theme, surface: 'transparent' } }),
    [theme],
  );

  return (
    <Animated.View
      entering={SlideInUp.duration(250)}
      exiting={SlideOutUp.duration(250)}
      style={headerOpacityStyle}
    >
      <Appbar.Header theme={headerTheme}>
        <Appbar.BackAction onPress={goBack} />

        <View style={styles.row}>
          <ExportNovelAsEpubButton novel={novel} iconComponent={AppbarAction} />
          <AppbarAction icon="share-variant" onPress={shareNovel} />
          <AppbarAction
            icon="text-box-search-outline"
            onPress={openJumpToChapter}
          />
          {!isLocal ? (
            <Menu
              theme={theme}
              visible={downloadMenu}
              onDismiss={closeDlMenu}
              anchor={
                <Appbar.Action
                  theme={appbarTheme}
                  icon="download-outline"
                  onPress={openDlMenu}
                  size={26}
                />
              }
              items={downloadMenuItems}
            />
          ) : null}
          <Menu
            visible={extraMenu}
            onDismiss={closeExtraMenu}
            anchor={
              <Appbar.Action
                theme={appbarTheme}
                icon="dots-vertical"
                onPress={openExtraMenu}
                size={24}
              />
            }
            theme={theme}
            items={extraMenuItems}
          />
        </View>
      </Appbar.Header>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    position: 'absolute',
    end: 0,
  },
});

export default memo(NovelAppbar);
