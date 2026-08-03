import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import {
  Button as ComposeButton,
  FilledTonalButton,
  OutlinedButton,
  ElevatedButton,
  TextButton,
} from '@expo/ui/jetpack-compose';

import { useTheme } from '@hooks/persisted';
import { ButtonVariant, ExpoHost, getButtonColors } from '@components/ExpoUI';

interface ButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  mode?: ButtonVariant;
  disabled?: boolean;
  /** Overrides the resolved variant's content (label) color. */
  textColor?: string;
  /** Reduces the button's internal content padding. */
  compact?: boolean;
  /**
   * Accepted for Paper-API compatibility; Compose's Button has no matching
   * per-instance content-style prop, so this isn't applied.
   */
  contentStyle?: StyleProp<ViewStyle>;
  accessible?: boolean;
  pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
  /**
   * Expo UI's Button has no built-in loading slot, so a loading button keeps
   * a plain React Native fallback (Pressable + ActivityIndicator) rather than
   * composing a custom spinner inside the Compose button's content.
   */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COMPONENTS: Record<ButtonVariant, typeof ComposeButton> = {
  contained: ComposeButton,
  'contained-tonal': FilledTonalButton,
  outlined: OutlinedButton,
  elevated: ElevatedButton,
  text: TextButton,
};

const COMPACT_CONTENT_PADDING = { start: 12, top: 4, end: 12, bottom: 4 };

const Button: React.FC<ButtonProps> = ({
  title,
  children,
  onPress,
  mode = 'text',
  disabled,
  textColor,
  compact,
  loading,
  pointerEvents,
  style,
}) => {
  const theme = useTheme();
  const colors = getButtonColors(theme, mode);
  const resolvedTextColor = textColor ?? colors.contentColor;

  if (loading) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[styles.loadingButton, style]}
      >
        <ActivityIndicator
          size="small"
          color={resolvedTextColor as string}
          style={styles.loadingIndicator}
        />
        <Text style={{ color: resolvedTextColor as string }}>
          {title ?? children}
        </Text>
      </Pressable>
    );
  }

  const Variant = VARIANT_COMPONENTS[mode];

  return (
    <ExpoHost
      theme={theme}
      style={style}
      matchContents
      pointerEvents={pointerEvents}
    >
      <Variant
        onClick={onPress}
        enabled={!disabled}
        colors={{ ...colors, contentColor: resolvedTextColor }}
        contentPadding={compact ? COMPACT_CONTENT_PADDING : undefined}
      >
        {title ?? children}
      </Variant>
    </ExpoHost>
  );
};

export default React.memo(Button);

const styles = StyleSheet.create({
  loadingButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  loadingIndicator: {
    marginEnd: 8,
  },
});
