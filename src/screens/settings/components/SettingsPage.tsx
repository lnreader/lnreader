import { createContext, useContext, type ReactNode } from 'react';
import { Box, Column, Spacer } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxSize,
  height,
  padding,
  Shapes,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import Screen from '../../../components/Screen/Screen';
import Appbar from '../../../components/Appbar/Appbar';
import { useScreenInsets } from '../../../components/Screen/insets';
import {
  MAX_CONTENT_WIDTH,
  useWindowLayout,
} from '../../../hooks/common/useWindowLayout';

/** Set by the tablet list-detail layout; pages beside its pane have no top bar. */
interface SettingsPaneValue {
  offset: number;
}

const SettingsPaneContext = createContext<SettingsPaneValue | null>(null);

export const SettingsPaneProvider = SettingsPaneContext.Provider;

export const useIsSettingsPane = () => useContext(SettingsPaneContext) !== null;

export const useSettingsGutter = () => {
  const layout = useWindowLayout();
  const offset = useContext(SettingsPaneContext)?.offset ?? 0;
  return Math.max(
    0,
    Math.round((layout.width - offset - MAX_CONTENT_WIDTH) / 2),
  );
};

export interface SettingsPageProps {
  title: string;
  onBack: () => void;
  overlays?: ReactNode;
  floatingAction?: ReactNode;
  header?: ReactNode;
  /** Pages with their own lazy list pass `false` and use `useSettingsGutter`. */
  scroll?: boolean;
  children: ReactNode;
}

const SettingsPage = ({
  title,
  onBack,
  overlays,
  floatingAction,
  header,
  scroll = true,
  children,
}: SettingsPageProps) => {
  const gutter = useSettingsGutter();
  const { top, bottom } = useScreenInsets();
  const theme = useTheme();
  const pane = useContext(SettingsPaneContext);
  const topBar = pane ? (
    <Spacer modifiers={[height(top + 8)]} />
  ) : (
    <Appbar title={title} handleGoBack={onBack} theme={theme} />
  );

  const body = scroll ? (
    <Column
      modifiers={[
        fillMaxSize(),
        verticalScroll(),
        padding(gutter, 0, gutter, bottom + (floatingAction ? 96 : 16)),
      ]}
    >
      {children}
    </Column>
  ) : (
    children
  );

  return (
    <Screen
      topBar={
        header ? (
          <Column>
            {topBar}
            {header}
          </Column>
        ) : (
          topBar
        )
      }
      overlays={overlays}
      floatingAction={floatingAction}
    >
      {pane ? (
        <Box
          modifiers={[
            fillMaxSize(),
            clip(Shapes.RoundedCorner({ topStart: 28 })),
            background(theme.surfaceContainerLow),
          ]}
        >
          {body}
        </Box>
      ) : (
        body
      )}
    </Screen>
  );
};

export default SettingsPage;
