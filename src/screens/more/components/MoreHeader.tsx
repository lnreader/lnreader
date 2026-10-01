import { Box, Image } from '@expo/ui/jetpack-compose';
import {
  background,
  fillMaxWidth,
  padding,
  size,
} from '@expo/ui/jetpack-compose/modifiers';

import { Appbar, List } from '@components';
import { AboutScreenProps, MoreStackScreenProps } from '@navigators/types';
import { ThemeColors } from '@theme/types';
import logo from '../../../../assets/logo.png';

interface MoreHeaderProps {
  title: string;
  navigation:
    | AboutScreenProps['navigation']
    | MoreStackScreenProps['navigation'];
  theme: ThemeColors;
  goBack?: boolean;
}

export const MoreHeader = ({
  title,
  navigation,
  theme,
  goBack,
}: MoreHeaderProps) => (
  <>
    <Appbar
      title={title}
      handleGoBack={goBack ? navigation.goBack : undefined}
      mode="small"
      theme={theme}
    />
    <Box
      contentAlignment="center"
      modifiers={[
        fillMaxWidth(),
        background(theme.surface),
        padding(0, 4, 0, 28),
      ]}
    >
      <Image source={logo} tint={theme.onSurface} modifiers={[size(90, 90)]} />
    </Box>
    <List.Divider theme={theme} />
  </>
);
