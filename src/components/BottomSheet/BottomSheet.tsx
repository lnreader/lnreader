import { type ReactNode } from 'react';
import { Column, ModalBottomSheet } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import AppText from '../AppText/AppText';
import { useScreenInsets } from '../Screen/insets';

export interface BottomSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: ReactNode;
  expanded?: boolean;
  /** Disable for lazy lists. */
  scrollable?: boolean;
  /** Leave what's behind undimmed, e.g. a page whose colors are being set. */
  transparentScrim?: boolean;
}

const BottomSheet = ({
  visible,
  onDismiss,
  title,
  children,
  expanded,
  scrollable = true,
  transparentScrim = false,
}: BottomSheetProps) => {
  const theme = useTheme();
  const { bottom } = useScreenInsets();
  if (!visible) {
    return null;
  }
  return (
    <ModalBottomSheet
      onDismissRequest={onDismiss}
      skipPartiallyExpanded={expanded}
      containerColor={theme.surfaceContainerLow}
      contentColor={theme.onSurface}
      scrimColor={transparentScrim ? 'transparent' : theme.backdrop}
    >
      <Column
        modifiers={[
          fillMaxWidth(),
          padding(0, 0, 0, bottom + 16),
          ...(scrollable ? [verticalScroll()] : []),
        ]}
      >
        {title ? (
          <AppText variant="titleLarge" modifiers={[padding(24, 0, 24, 12)]}>
            {title}
          </AppText>
        ) : null}
        {children}
      </Column>
    </ModalBottomSheet>
  );
};

export default BottomSheet;
