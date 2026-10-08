import React, { createContext, useContext } from 'react';
import { Column, Row, Surface } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';
import { ThemeColors } from '../../theme/types';
import { useScreenInsets } from '../Screen/insets';
import IconButtonV2 from '../IconButtonV2/IconButtonV2';
import AppText from '../AppText/AppText';

interface AppbarProps {
  title: string;
  handleGoBack?: () => void;
  theme: ThemeColors;
  mode?: 'small' | 'medium' | 'large' | 'center-aligned';
  children?: React.ReactNode;
  containerColor?: string;
  titleColor?: string;
  /** Compose top bars draw under the status bar, so the bar pads itself. */
  insetTop?: boolean;
}

/** Screens opened from the navigation rail show no back arrow, like the tabs. */
const TopLevelScreenContext = createContext(false);

export const TopLevelScreenProvider = TopLevelScreenContext.Provider;

export const useIsTopLevelScreen = () => useContext(TopLevelScreenContext);

const Appbar: React.FC<AppbarProps> = ({
  title,
  handleGoBack,
  theme,
  mode = 'large',
  children,
  containerColor,
  titleColor,
  insetTop = true,
}) => {
  const { top, left, right } = useScreenInsets();
  const topLevel = useIsTopLevelScreen();
  const showBack = handleGoBack && !topLevel;

  return (
    <Surface
      color={containerColor ?? theme.surface}
      contentColor={theme.onSurface}
      modifiers={[fillMaxWidth()]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[
          fillMaxWidth(),
          padding(4 + left, insetTop ? top : 0, 4 + right, 0),
          height(64 + (insetTop ? top : 0)),
        ]}
      >
        {showBack ? (
          <IconButtonV2
            name={ArrowBackIcon}
            accessibilityLabel={getString('common.back')}
            color={theme.onSurface}
            onPress={handleGoBack}
            theme={theme}
          />
        ) : null}
        <Column
          horizontalAlignment={mode === 'center-aligned' ? 'center' : 'start'}
          modifiers={[weight(1), padding(showBack ? 4 : 12, 0, 4, 0)]}
        >
          <AppText
            variant="titleLarge"
            color={titleColor ?? theme.onSurface}
            maxLines={1}
          >
            {title}
          </AppText>
        </Column>
        {children}
      </Row>
    </Surface>
  );
};

export default Appbar;
