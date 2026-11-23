import { StatusBar } from 'react-native';
import { ThemeColors } from '@theme/types';
import Color, { ColorInstance } from 'color';
import { NavigationBar } from 'expo-navigation-bar';

export const setNavigationBarStyle = (isDark: boolean) => {
  NavigationBar.setStyle(isDark ? 'light' : 'dark');
};

/**
 * The app is edge-to-edge, so the status bar is always transparent and only
 * its icon style follows the colour drawn behind it.
 */
export const setStatusBarStyle = (color: ThemeColors | ColorInstance) => {
  const isDark = color instanceof Color ? color.isDark() : color.isDark;
  StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
};
