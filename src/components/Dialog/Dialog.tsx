import { useState, type ReactNode } from 'react';
import {
  BasicAlertDialog,
  Column,
  HorizontalDivider,
  Row,
  Shape,
  Surface,
  TextButton,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  onSizeChanged,
  padding,
  size,
  testID as testIDModifier,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import AppText from '../AppText/AppText';
import ProgressIndicator from '../ProgressIndicator/ProgressIndicator';

interface DialogRootProps {
  visible: boolean;
  onDismiss: () => void;
  children?: ReactNode;
  testID?: string;
}

interface DialogSectionProps {
  children?: ReactNode;
  testID?: string;
}

interface DialogTextProps {
  children: ReactNode;
}

type DialogActionTone = 'primary' | 'danger';

interface DialogActionProps {
  title?: string;
  children?: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: DialogActionTone;
}

const DIALOG_PADDING = 24;
/** Taller content scrolls inside the scroll area. */
const MAX_SCROLL_AREA_HEIGHT = 420;

const DialogRoot = ({
  children,
  visible,
  onDismiss,
  testID = 'dialog',
}: DialogRootProps) => {
  const theme = useTheme();
  if (!visible) {
    return null;
  }
  return (
    <BasicAlertDialog onDismissRequest={onDismiss}>
      <Surface
        color={theme.surfaceContainerHigh}
        contentColor={theme.onSurface}
        shape={Shape.RoundedCorner({
          cornerRadii: {
            topStart: 28,
            topEnd: 28,
            bottomStart: 28,
            bottomEnd: 28,
          },
        })}
        modifiers={[fillMaxWidth(), testIDModifier(testID)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxWidth(), padding(0, DIALOG_PADDING, 0, 18)]}
        >
          {children}
        </Column>
      </Surface>
    </BasicAlertDialog>
  );
};

const sectionTestID = (id?: string) => (id ? [testIDModifier(id)] : []);

const DialogHeader = ({ children, testID }: DialogSectionProps) => (
  <Column
    verticalArrangement={{ spacedBy: 16 }}
    modifiers={[fillMaxWidth(), ...sectionTestID(testID)]}
  >
    {children}
  </Column>
);

const DialogTitle = ({ children }: DialogTextProps) => (
  <AppText
    variant="headlineSmall"
    modifiers={[padding(DIALOG_PADDING, 0, DIALOG_PADDING, 0)]}
  >
    {children}
  </AppText>
);

const DialogDescription = ({ children }: DialogTextProps) => {
  const theme = useTheme();
  return (
    <AppText
      variant="bodyMedium"
      color={theme.onSurfaceVariant}
      modifiers={[padding(DIALOG_PADDING, 0, DIALOG_PADDING, 0)]}
    >
      {children}
    </AppText>
  );
};

const DialogContent = ({ children, testID }: DialogSectionProps) => (
  <Column
    modifiers={[
      fillMaxWidth(),
      padding(DIALOG_PADDING, 0, DIALOG_PADDING, 0),
      ...sectionTestID(testID),
    ]}
  >
    {children}
  </Column>
);

// List rows bring their own 16dp inset; this lines them up with the text.
const DialogList = ({ children, testID }: DialogSectionProps) => (
  <Column
    modifiers={[fillMaxWidth(), padding(8, 0, 8, 0), ...sectionTestID(testID)]}
  >
    {children}
  </Column>
);

const DialogScrollArea = ({
  children,
  testID,
  fixed = false,
}: DialogSectionProps & {
  /** Keep the full height for content that changes, so the dialog doesn't jump. */
  fixed?: boolean;
}) => {
  const theme = useTheme();
  // Compose has no max-height modifier here: measure the content, then cap.
  const [contentHeight, setContentHeight] = useState<number>();
  return (
    <Column modifiers={[fillMaxWidth(), ...sectionTestID(testID)]}>
      <HorizontalDivider color={theme.outlineVariant} />
      <Column
        modifiers={[
          fillMaxWidth(),
          ...(fixed
            ? [height(MAX_SCROLL_AREA_HEIGHT)]
            : contentHeight === undefined
            ? []
            : [height(Math.min(contentHeight, MAX_SCROLL_AREA_HEIGHT))]),
          verticalScroll(),
        ]}
      >
        <Column
          modifiers={[
            fillMaxWidth(),
            padding(8, 0, 8, 0),
            ...(fixed
              ? []
              : [onSizeChanged(measured => setContentHeight(measured.height))]),
          ]}
        >
          {children}
        </Column>
      </Column>
      <HorizontalDivider color={theme.outlineVariant} />
    </Column>
  );
};

const DialogActions = ({ children, testID }: DialogSectionProps) => (
  <Row
    horizontalArrangement="end"
    modifiers={[
      fillMaxWidth(),
      padding(DIALOG_PADDING - 12, 0, 12, 0),
      ...sectionTestID(testID),
    ]}
  >
    {children}
  </Row>
);

const DialogAction = ({
  title,
  children,
  onPress,
  disabled,
  loading,
  tone = 'primary',
}: DialogActionProps) => {
  const theme = useTheme();
  const color =
    disabled || loading
      ? theme.onSurfaceDisabled
      : tone === 'danger'
      ? theme.error
      : theme.primary;
  return (
    <TextButton
      onClick={onPress}
      enabled={!disabled && !loading}
      colors={{
        containerColor: 'transparent',
        contentColor: color,
        disabledContentColor: theme.onSurfaceDisabled,
      }}
    >
      {loading ? (
        <ProgressIndicator circular modifiers={[size(18, 18)]} />
      ) : (
        <AppText variant="labelLarge" color={color}>
          {title || children}
        </AppText>
      )}
    </TextButton>
  );
};

export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Content: DialogContent,
  List: DialogList,
  ScrollArea: DialogScrollArea,
  Actions: DialogActions,
  Action: DialogAction,
} as const;

export type {
  DialogActionProps,
  DialogActionTone,
  DialogRootProps,
  DialogSectionProps,
  DialogTextProps,
};
