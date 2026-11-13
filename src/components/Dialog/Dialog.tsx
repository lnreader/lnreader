import React, { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Modal as NativeModal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextProps,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Color from 'color';

import { useAppSettings, useTheme } from '@hooks/persisted';

import Button from '../Button/Button';

interface DialogRootProps extends PropsWithChildren {
  visible: boolean;
  onDismiss: () => void;
  surfaceStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

interface DialogSectionProps extends ViewProps {
  children: React.ReactNode;
}

interface DialogTextProps extends TextProps {
  children: React.ReactNode;
}

type DialogActionTone = 'primary' | 'danger';

interface DialogActionProps extends React.ComponentProps<typeof Button> {
  tone?: DialogActionTone;
}

const DialogRoot = ({
  children,
  visible,
  onDismiss,
  surfaceStyle,
  testID = 'dialog',
}: DialogRootProps) => {
  const theme = useTheme();
  const { reduceAppAnimations = false } = useAppSettings();
  const backdropColor = Color(theme.scrim ?? '#000000')
    .alpha(0.32)
    .string();

  return (
    <NativeModal
      animationType={reduceAppAnimations ? 'none' : 'fade'}
      hardwareAccelerated
      navigationBarTranslucent
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={[styles.modal, { backgroundColor: backdropColor }]}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
          testID={`${testID}-backdrop`}
        />
        <SafeAreaView pointerEvents="box-none" style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={styles.keyboardAvoidingView}
          >
            <View
              pointerEvents="box-none"
              style={styles.viewport}
              testID={`${testID}-viewport`}
            >
              <View
                accessibilityViewIsModal
                style={[
                  styles.surface,
                  {
                    backgroundColor:
                      theme.surfaceContainerHigh ?? theme.surface,
                  },
                  surfaceStyle,
                ]}
                testID={testID}
              >
                {children}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </NativeModal>
  );
};

const DialogHeader = ({ children, style, ...props }: DialogSectionProps) => (
  <View style={[styles.header, style]} {...props}>
    {children}
  </View>
);

const DialogTitle = ({ children, style, ...props }: DialogTextProps) => {
  const theme = useTheme();

  return (
    <Text
      accessibilityRole="header"
      style={[styles.title, { color: theme.onSurface }, style]}
      {...props}
    >
      {children}
    </Text>
  );
};

const DialogDescription = ({ children, style, ...props }: DialogTextProps) => {
  const theme = useTheme();

  return (
    <Text
      style={[styles.description, { color: theme.onSurfaceVariant }, style]}
      {...props}
    >
      {children}
    </Text>
  );
};

const DialogContent = ({ children, style, ...props }: DialogSectionProps) => (
  <View style={[styles.content, style]} {...props}>
    {children}
  </View>
);

const DialogList = ({ children, style, ...props }: DialogSectionProps) => (
  <View style={[styles.list, style]} {...props}>
    {children}
  </View>
);

const DialogScrollArea = ({
  children,
  style,
  testID = 'dialog-scroll-area',
  ...props
}: DialogSectionProps) => {
  const theme = useTheme();
  const dividerStyle = { backgroundColor: theme.outlineVariant };

  return (
    <View style={[styles.scrollArea, style]} testID={testID} {...props}>
      <View
        importantForAccessibility="no"
        style={[styles.divider, dividerStyle]}
        testID={`${testID}-top-divider`}
      />
      {children}
      <View
        importantForAccessibility="no"
        style={[styles.divider, dividerStyle]}
        testID={`${testID}-bottom-divider`}
      />
    </View>
  );
};

const DialogActions = ({ children, style, ...props }: DialogSectionProps) => (
  <View style={[styles.actions, style]} {...props}>
    {children}
  </View>
);

const DialogAction = ({
  tone = 'primary',
  textColor,
  ...props
}: DialogActionProps) => {
  const theme = useTheme();

  return (
    <Button
      textColor={textColor ?? (tone === 'danger' ? theme.error : theme.primary)}
      {...props}
    />
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

const styles = StyleSheet.create({
  modal: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  viewport: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  surface: {
    borderCurve: 'continuous',
    borderRadius: 28,
    gap: 16,
    maxHeight: '90%',
    maxWidth: 560,
    minWidth: 280,
    padding: 24,
    width: '100%',
  },
  header: {
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 32,
  },
  description: {
    fontSize: 14,
    letterSpacing: 0,
    lineHeight: 20,
  },
  content: {
    flexShrink: 1,
    gap: 16,
  },
  list: {
    flexShrink: 1,
    marginHorizontal: -24,
  },
  scrollArea: {
    flexShrink: 1,
    marginHorizontal: -24,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
});
