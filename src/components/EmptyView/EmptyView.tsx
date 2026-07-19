import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

import { ThemeColors } from '../../theme/types';
import { Button } from 'react-native-paper';

interface EmptyViewProps {
  icon?: string;
  description: string;
  theme: ThemeColors;
  actions?: {
    iconName: string;
    title: string;
    onPress: () => void;
  }[];
}

const EmptyView: React.FC<EmptyViewProps> = ({
  icon,
  description,
  theme,
  actions,
}) => (
  <View style={styles.container}>
    {icon ? (
      <Text style={[styles.icon, { color: theme.outline }]}>{icon}</Text>
    ) : null}
    <Text style={[styles.text, { color: theme.outline }]}>{description}</Text>
    {actions?.length ? (
      <View style={styles.actionsCtn}>
        {actions.map(action => (
          <View key={action.title} style={styles.buttonWrapper}>
            <Button
              rippleColor={theme.rippleColor}
              onPress={action.onPress}
              icon={action.iconName}
              textColor={theme.outline}
              mode="outlined"
            >
              {action.title}
            </Button>
          </View>
        ))}
      </View>
    ) : null}
  </View>
);

export default EmptyView;

const styles = StyleSheet.create({
  actionsCtn: {
    flexDirection: 'row',
    marginTop: 20,
  },
  buttonWrapper: {
    flexDirection: 'row',
    marginHorizontal: 4,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  icon: {
    fontSize: 40,
    fontWeight: 'bold',
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
  },
});
