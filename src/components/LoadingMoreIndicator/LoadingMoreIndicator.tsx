import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CircularProgressIndicator } from '@expo/ui/jetpack-compose';

import { ExpoHost } from '@components/ExpoUI';
import { ThemeColors } from '../../theme/types';

interface Props {
  theme: ThemeColors;
}

const LoadingMoreIndicator: React.FC<Props> = ({ theme }) => (
  <View style={styles.container}>
    <ExpoHost theme={theme} matchContents>
      <CircularProgressIndicator color={theme.primary} />
    </ExpoHost>
  </View>
);

export default LoadingMoreIndicator;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
});
