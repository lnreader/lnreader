import { type ReactNode, type Ref } from 'react';
import {
  Column,
  Snackbar,
  SnackbarHost,
  Surface,
  type SnackbarHostRef,
} from '@expo/ui/jetpack-compose';
import { fillMaxSize, fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@hooks/persisted/useTheme';
import AppHost from '../AppHost/AppHost';
import OverlayHost from '../OverlayHost/OverlayHost';
import { useScreenInsets } from './insets';

export interface ScreenProps {
  topBar?: ReactNode;
  /** The top bar floats, transparent, over content that starts under it. */
  topBarOverContent?: boolean;
  /** Compose content filling the screen. */
  children?: ReactNode;
  /**
   * React Native content (a `ComposeList`) shown instead of `children`, laid
   * out by React Native so the list keeps its own virtualization.
   */
  list?: ReactNode;
  floatingAction?: ReactNode;
  bottomBar?: ReactNode;
  overlays?: ReactNode;
  backgroundColor?: string;
  snackbarRef?: Ref<SnackbarHostRef>;
}

/** Compose content placed in React Native layout, e.g. beside a list. */
export const ScreenContent = ({
  children,
  backgroundColor,
}: {
  children: ReactNode;
  backgroundColor?: string;
}) => {
  const theme = useTheme();
  return (
    <AppHost style={styles.fill}>
      <Surface
        color={backgroundColor ?? theme.background}
        contentColor={theme.onBackground}
        modifiers={[fillMaxSize()]}
      >
        {children}
      </Surface>
    </AppHost>
  );
};

const Screen = ({
  topBar,
  topBarOverContent = false,
  children,
  list,
  floatingAction,
  bottomBar,
  overlays,
  backgroundColor,
  snackbarRef,
}: ScreenProps) => {
  const theme = useTheme();
  const { bottom, right } = useScreenInsets();
  const background = backgroundColor ?? theme.background;
  const aboveBottomBar = bottom + (bottomBar ? 88 : 0);
  const topBarHost = (
    <AppHost
      matchContents={{ vertical: true }}
      style={topBarOverContent ? styles.overContent : undefined}
    >
      <Surface
        color={topBarOverContent ? 'transparent' : background}
        contentColor={theme.onBackground}
        modifiers={[fillMaxWidth()]}
      >
        {/* A Surface stacks its children; top bars can be several rows. */}
        <Column modifiers={[fillMaxWidth()]}>{topBar}</Column>
      </Surface>
    </AppHost>
  );

  return (
    <View style={[styles.fill, { backgroundColor: background }]}>
      {topBar && !topBarOverContent ? topBarHost : null}
      <View style={styles.fill}>
        {list ?? (
          <ScreenContent backgroundColor={background}>{children}</ScreenContent>
        )}
        {floatingAction ? (
          <AppHost
            matchContents
            style={[
              styles.floating,
              { right: 16 + right, bottom: 16 + aboveBottomBar },
            ]}
          >
            {floatingAction}
          </AppHost>
        ) : null}
        {snackbarRef ? (
          <AppHost
            matchContents={{ vertical: true }}
            pointerEvents="box-none"
            style={[styles.snackbar, { bottom: 16 + aboveBottomBar }]}
          >
            <SnackbarHost ref={snackbarRef}>
              <Snackbar
                containerColor={theme.inverseSurface}
                contentColor={theme.inverseOnSurface}
                actionContentColor={theme.inversePrimary}
              />
            </SnackbarHost>
          </AppHost>
        ) : null}
        {bottomBar ? (
          <AppHost matchContents={{ vertical: true }} style={styles.bottomBar}>
            {bottomBar}
          </AppHost>
        ) : null}
      </View>
      {topBar && topBarOverContent ? topBarHost : null}
      {overlays ? <OverlayHost>{overlays}</OverlayHost> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  floating: { position: 'absolute' },
  snackbar: { position: 'absolute', left: 16, right: 16 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overContent: { position: 'absolute', left: 0, right: 0, top: 0 },
});

export default Screen;
