import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { overlay } from 'react-native-paper';
import color from 'color';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '@theme/types';

interface ThemePickerProps {
  theme: ThemeColors;
  currentTheme: ThemeColors;
  onPress: () => void;
  horizontal?: boolean;
}

export const ThemePicker = ({
  theme,
  currentTheme,
  onPress,
  horizontal = false,
}: ThemePickerProps) => (
  <View style={[styles.container, horizontal && styles.horizontalContainer]}>
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.background,
          borderColor:
            currentTheme.id === theme.id
              ? theme.primary
              : currentTheme.background,
        },
      ]}
    >
      <Pressable style={styles.flex1} onPress={onPress}>
        {currentTheme.id === theme.id ? (
          <MaterialCommunityIcons
            name="check"
            color={theme.onPrimary}
            size={15}
            style={[styles.checkIcon, { backgroundColor: theme.primary }]}
          />
        ) : null}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: overlay(2, theme.surface),
            },
          ]}
        >
          <View
            style={[styles.topBarAccent, { backgroundColor: theme.onSurface }]}
          />
        </View>
        <View style={styles.content}>
          <View
            style={[
              styles.titleBar,
              { backgroundColor: theme.onSurfaceVariant },
            ]}
          />
          <View style={styles.row}>
            <View
              style={[styles.rowAccent, { backgroundColor: theme.onSurface }]}
            />
            <View
              style={[
                styles.rowAccentSmall,
                { backgroundColor: theme.primary },
              ]}
            />
          </View>
          <View style={styles.row}>
            <View
              style={[
                styles.rowAccentShort,
                { backgroundColor: theme.onSurfaceVariant },
              ]}
            />
            <View
              style={[
                styles.rowAccentShort,
                styles.marginLeft,
                { backgroundColor: theme.onSurfaceVariant },
              ]}
            />
          </View>
        </View>
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: color(theme.primary).alpha(0.08).string(),
            },
          ]}
        >
          <View style={styles.bottomBarContent}>
            <View
              style={[
                styles.dot,
                styles.opacityDot,
                { backgroundColor: theme.onSurface },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <View
              style={[
                styles.dot,
                styles.opacityDot,
                { backgroundColor: theme.onSurface },
              ]}
            />
          </View>
        </View>
      </Pressable>
    </View>
    <Text style={[styles.themeName, { color: currentTheme.onSurface }]}>
      {theme.name}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
    width: '33%',
  },
  horizontalContainer: {
    width: undefined,
    marginHorizontal: 4,
  },
  card: {
    borderWidth: 3.6,
    width: 95,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    // Elevation for Android
    elevation: 2,
  },
  flex1: {
    flex: 1,
  },
  checkIcon: {
    position: 'absolute',
    top: 5,
    end: 5,
    borderRadius: 50,
    padding: 1.6,
    zIndex: 1,
  },
  topBar: {
    height: 20,
    justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
  },
  topBarAccent: {
    width: 44,
    height: 10,
    marginStart: 8,
    borderRadius: 50,
  },
  content: {
    padding: 8,
  },
  titleBar: {
    height: 18,
    borderRadius: 4,
  },
  row: {
    paddingVertical: 4,
    flexDirection: 'row',
  },
  rowAccent: {
    height: 10,
    width: 44,
    borderRadius: 50,
  },
  rowAccentSmall: {
    height: 10,
    width: 16,
    marginStart: 4,
    borderRadius: 50,
  },
  rowAccentShort: {
    height: 10,
    width: 24,
    borderRadius: 50,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    justifyContent: 'center',
  },
  bottomBarContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  dot: {
    height: 12,
    width: 12,
    borderRadius: 50,
  },
  opacityDot: {
    opacity: 0.54,
  },
  themeName: {
    fontSize: 12,
    paddingVertical: 4,
  },
  marginLeft: { marginStart: 4 },
});
