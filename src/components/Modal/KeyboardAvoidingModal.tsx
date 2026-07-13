import React from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Modal, ModalProps, overlay, Portal } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withClamp,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@components/Button/Button';
import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';

const MODAL_MARGIN = 24;
const BORDER_RADIUS = 28;

const getModalTitleColor = (theme: ThemeColors) => ({
  color: theme.onSurface,
});

export type DefaultModalProps = {
  title: string;
  onSave: () => boolean;
  onDismiss: () => void;
  onCancel?: () => void;
  onReset?: () => void;
} & Omit<ModalProps, 'theme' | 'onDismiss' | 'contentContainerStyle'>;

const KeyboardAvoidingModal: React.FC<DefaultModalProps> = ({
  visible,
  onDismiss: _onDismiss,
  onSave,
  onCancel,
  onReset,
  title,
  children,
  ...props
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const keyboard = useAnimatedKeyboard();

  const onDismiss = () => {
    Keyboard.dismiss();
    _onDismiss?.();
  };

  const dismiss = (cb?: () => void | boolean) => {
    if (cb?.() === false) return;
    onDismiss();
  };

  const default_availableHeight = windowHeight - insets.top;
  const animatedContainerStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;

    const availableHeight =
      default_availableHeight - Math.max(insets.bottom, kb);
    return {
      maxHeight: withClamp(
        { min: 200 },
        withTiming(availableHeight, { duration: 0 }),
      ),
      marginBottom: kb,
    };
  }, [insets.bottom, default_availableHeight]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        {...props}
        style={styles.modalWrapper}
      >
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.modalContainer,
            { backgroundColor: overlay(2, theme.surface) },
            animatedContainerStyle,
          ]}
        >
          <Text style={[styles.modalTitle, getModalTitleColor(theme)]}>
            {title}
          </Text>

          <View style={styles.body}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
              nestedScrollEnabled
            >
              {children}
            </ScrollView>
          </View>

          <View style={styles.buttonRow}>
            {onReset ? (
              <Button onPress={onReset}>{getString('common.reset')}</Button>
            ) : null}

            <View style={styles.flex} />

            <Button onPress={() => dismiss(onCancel)}>
              {getString('common.cancel')}
            </Button>
            <Button onPress={() => dismiss(onSave)}>
              {getString('common.save')}
            </Button>
          </View>
        </Animated.View>
      </Modal>
    </Portal>
  );
};

export default KeyboardAvoidingModal;

const styles = StyleSheet.create({
  modalWrapper: {
    justifyContent: 'center',
    paddingHorizontal: MODAL_MARGIN,
  },
  modalContainer: {
    borderRadius: BORDER_RADIUS,
    shadowColor: 'transparent',
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 24,
    padding: 24,
  },
  body: {
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: -8,
    marginHorizontal: -8,
    padding: 24,
    paddingTop: 8,
  },
  flex: {
    flex: 1,
  },
});
