import { RefObject, useCallback, useEffect } from 'react';
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
  setStatusBarStyle,
} from '@theme/utils/setBarColor';
import { NavigationBar } from 'expo-navigation-bar';

/** `chromeHiddenRef`: whether the reader controls are hidden. */
const useFullscreenMode = (chromeHiddenRef: RefObject<boolean>) => {
  const { addListener } = useNavigation();
  const { theme: backgroundColor } = useChapterReaderSettings();
  const { fullScreenMode } = useChapterGeneralSettings();
  const theme = useTheme();

  const setImmersiveMode = useCallback(() => {
    if (fullScreenMode) {
      StatusBar.setHidden(true);
      NavigationBar.setHidden(true);
    } else {
      setStatusBarStyle(Color(backgroundColor));
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

      setStatusBarStyle(theme);
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
    const showAppBars = () => {
      StatusBar.setHidden(false);
      NavigationBar.setHidden(false);
      setStatusBarStyle(theme);
      setNavigationBarStyle(theme.isDark);
    };
    // A screen pushed over the reader (a linked novel) does not remove it, so
    // the bars must follow focus as well as removal.
    const unsubscribers = [
      addListener('beforeRemove', showAppBars),
      addListener('blur', showAppBars),
      addListener('focus', () => {
        const chromeHidden = chromeHiddenRef.current;
        // Without fullScreenMode this only recolours the bars.
        if (chromeHidden || !fullScreenMode) {
          setImmersiveMode();
        }
        if (!chromeHidden) {
          showStatusAndNavBar();
        }
      }),
    ];

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [
    addListener,
    chromeHiddenRef,
    fullScreenMode,
    setImmersiveMode,
    showStatusAndNavBar,
    theme,
  ]);

  return { setImmersiveMode, showStatusAndNavBar };
};

export default useFullscreenMode;
