import { useCallback, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useTheme,
} from '../persisted';
import Color from 'color';
import {
  setNavigationBarStyle,
  setStatusBarColor,
} from '@theme/utils/setBarColor';
import { NavigationBar } from 'expo-navigation-bar';

const useFullscreenMode = () => {
  const { addListener } = useNavigation();
  const { theme: backgroundColor } = useChapterReaderSettings();
  const { fullScreenMode } = useChapterGeneralSettings();
  const theme = useTheme();

  const setImmersiveMode = useCallback(() => {
    if (fullScreenMode) {
      StatusBar.setHidden(true);
      NavigationBar.setHidden(true);
    } else {
      setStatusBarColor(Color(backgroundColor));
      setNavigationBarStyle(Color(backgroundColor).isDark());
    }
  }, [backgroundColor, fullScreenMode]);

  const showStatusAndNavBar = useCallback(() => {
    StatusBar.setHidden(false);
    NavigationBar.setHidden(false);

    if (fullScreenMode) {
      /**
       * This is overlay of reader footer and should be transparent.
       * But in hexa, ##xxxxxx00 could be another color
       */

      setStatusBarColor(theme);
      setNavigationBarStyle(theme.isDark);
    }
  }, [fullScreenMode, theme]);

  useEffect(() => {
    setImmersiveMode();
    return () => {
      StatusBar.setHidden(false);
      NavigationBar.setHidden(false);
    };
  }, [setImmersiveMode]);

  useEffect(() => {
    const unsubscribe = addListener('beforeRemove', () => {
      StatusBar.setHidden(false);
      NavigationBar.setHidden(false);
      setStatusBarColor(theme);
      setNavigationBarStyle(theme.isDark);
    });

    return unsubscribe;
  }, [addListener, theme]);

  return { setImmersiveMode, showStatusAndNavBar };
};

export default useFullscreenMode;
