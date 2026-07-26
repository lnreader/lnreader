import { ThemeColors } from '@theme/types';

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from 'react-native-paper';

interface ErrorAction {
  name: string;
  icon: string;
  onPress: () => void;
}

interface ErrorViewProps {
  errorName: string;
  actions: ErrorAction[];
  theme: ThemeColors;
}

// Dynamic style helpers
const getOutlineColor = (theme: ThemeColors) => ({ color: theme.outline });
const getRipple = (theme: ThemeColors) => ({
  color: theme.rippleColor,
  borderless: false,
});
const getActionTextColor = (theme: ThemeColors) => ({ color: theme.outline });

export const ErrorView = ({ errorName, actions, theme }: ErrorViewProps) => (
  <View style={styles.emptyViewContainer}>
    <Text style={[styles.emptyViewIcon, getOutlineColor(theme)]}>
      {/* {icons[Math.floor(Math.random() * 5)]} */}
      ಥ_ಥ
    </Text>
    <Text style={[styles.emptyViewText, getOutlineColor(theme)]}>
      {errorName}
    </Text>
    <View style={styles.actionsRow}>
      {actions.map(action => (
        <View key={action.name} style={styles.actionContainer}>
          <Pressable
            android_ripple={getRipple(theme)}
            onPress={action.onPress}
            style={styles.actionPressable}
          >
            <IconButton
              icon={action.icon}
              size={24}
              style={styles.iconButton}
            />
            <Text style={[styles.actionText, getActionTextColor(theme)]}>
              {action.name}
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  emptyViewContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  emptyViewIcon: {
    fontSize: 45,
  },
  emptyViewText: {
    fontWeight: 'bold',
    marginTop: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
  },
  actionContainer: {
    borderRadius: 4,
    overflow: 'hidden',
    margin: 16,
  },
  actionPressable: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
    paddingHorizontal: 20,
    minWidth: 100,
  },
  iconButton: {
    margin: 0,
  },
  actionText: {
    fontSize: 12,
  },
});
