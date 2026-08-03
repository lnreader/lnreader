import React from 'react';
import { StyleSheet, View } from 'react-native';
import { CircularProgressIndicator } from '@expo/ui/jetpack-compose';

import { ExpoHost } from '@components/ExpoUI';
import { ThemeColors } from '../../theme/types';

const LoadingScreen: React.FC<{ theme: ThemeColors }> = ({ theme }) => (
  <View style={styles.container}>
    <ExpoHost theme={theme} matchContents>
      <CircularProgressIndicator color={theme.primary} strokeWidth={4} />
    </ExpoHost>
  </View>
);

export default LoadingScreen;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
