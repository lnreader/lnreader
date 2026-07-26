import { Image, StyleSheet, View } from 'react-native';

import { Appbar, List } from '@components';
import { AboutScreenProps, MoreStackScreenProps } from '@navigators/types';
import { ThemeColors } from '@theme/types';

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
    <View style={styles.overflow}>
      <View style={[styles.logoContainer, { backgroundColor: theme.surface }]}>
        <Image
          source={require('../../../../assets/logo.png')}
          style={[styles.logo, { tintColor: theme.onSurface }]}
        />
      </View>
    </View>
    <List.Divider theme={theme} />
  </>
);

const styles = StyleSheet.create({
  logo: {
    height: 90,
    width: 90,
  },
  logoContainer: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingTop: 4,
  },
  overflow: {
    overflow: 'hidden',
    paddingBottom: 4,
  },
});
