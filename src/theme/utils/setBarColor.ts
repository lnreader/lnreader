import { StatusBar } from 'react-native';
import { ThemeColors } from '@theme/types';
import Color, { ColorInstance } from 'color';

export const setStatusBarColor = (color: ThemeColors | ColorInstance) => {
  if (color instanceof Color) {
    // fullscreen reader mode
    StatusBar.setBarStyle(color.isDark() ? 'light-content' : 'dark-content');
    StatusBar.setBackgroundColor(color.hexa());
  } else {
    StatusBar.setTranslucent(true);
    StatusBar.setBackgroundColor('transparent');
    StatusBar.setBarStyle(color.isDark ? 'light-content' : 'dark-content');
  }
};
