import { useTheme } from '@hooks/persisted';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, StyleSheet, View } from 'react-native';
import { Button } from '@components';
import ThemeSelectionStep from './ThemeSelectionStep';
import { useState } from 'react';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { getString } from '@i18n/translations';

enum OnboardingStep {
  PICK_THEME,
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const [step] = useState<OnboardingStep>(OnboardingStep.PICK_THEME);

  const renderStep = () => {
    switch (step) {
      case OnboardingStep.PICK_THEME:
        return <ThemeSelectionStep />;
      default:
        return <ThemeSelectionStep />;
    }
  };
  const renderHelptext = () => {
    switch (step) {
      case OnboardingStep.PICK_THEME:
        return getString('onboardingScreen.pickATheme');
      default:
        return getString('onboardingScreen.pickATheme');
    }
  };

  return (
    <SafeAreaView style={[{ backgroundColor: theme.background }, styles.root]}>
      <Image
        source={require('../../../assets/logo.png')}
        tintColor={theme.primary}
        style={styles.logo}
      />
      <Text
        variant="headlineLarge"
        style={[{ color: theme.onBackground }, styles.headline]}
      >
        {getString('onboardingScreen.welcome')}
      </Text>
      <Text style={[{ color: theme.onBackground }, styles.helpText]}>
        {renderHelptext()}
      </Text>
      <View
        style={[
          { backgroundColor: theme.surfaceVariant },
          styles.stepContainer,
        ]}
      >
        {renderStep()}
      </View>

      <Button
        title={getString('onboardingScreen.complete')}
        mode="contained"
        onPress={() => {
          MMKVStorage.set('IS_ONBOARDED', true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    height: '100%',
    paddingBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  logo: {
    width: 90,
    height: 90,
  },
  headline: {
    fontWeight: 500,
    paddingBottom: 8,
  },
  helpText: {
    fontWeight: 500,
    paddingBottom: 8,
  },
  stepContainer: {
    borderRadius: 8,
    flexBasis: '20%',
    flexGrow: 1,
    marginBottom: 16,
    paddingTop: 16,
    position: 'relative',
  },
});
