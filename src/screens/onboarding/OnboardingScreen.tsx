import { useTheme } from '@hooks/persisted';
import { Box, Column, Image } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { AppText, Button, Screen, useScreenInsets } from '@components';
import ThemeSelectionStep from './ThemeSelectionStep';
import { useState } from 'react';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { getString } from '@i18n/translations';
import logo from '../../../assets/logo.png';

enum OnboardingStep {
  PICK_THEME,
}

export default function OnboardingScreen() {
  const theme = useTheme();
  const { top, bottom } = useScreenInsets();
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
    <Screen>
      <Column
        modifiers={[
          fillMaxSize(),
          background(theme.background),
          padding(16, top + 40, 16, bottom + 16),
        ]}
      >
        <Image source={logo} tint={theme.primary} modifiers={[size(90, 90)]} />
        <AppText
          variant="headlineLarge"
          weight="500"
          color={theme.onBackground}
          modifiers={[padding(0, 0, 0, 8)]}
        >
          {getString('onboardingScreen.welcome')}
        </AppText>
        <AppText
          weight="500"
          color={theme.onBackground}
          modifiers={[padding(0, 0, 0, 8)]}
        >
          {renderHelptext()}
        </AppText>
        <Box
          modifiers={[
            fillMaxWidth(),
            weight(1),
            padding(0, 0, 0, 16),
            clip(Shapes.RoundedCorner(8)),
            background(theme.surfaceVariant),
            padding(0, 16, 0, 0),
          ]}
        >
          {renderStep()}
        </Box>

        <Button
          title={getString('onboardingScreen.complete')}
          mode="contained"
          onPress={() => {
            MMKVStorage.set('IS_ONBOARDED', true);
          }}
          modifiers={[fillMaxWidth()]}
        />
      </Column>
    </Screen>
  );
}
