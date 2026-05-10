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
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '@components/Button/Button';
import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';

const MODAL_MARGIN = 24;

const getModalTitleColor = (theme: ThemeColors) => ({
  color: theme.onSurface,
});

export type DefaultModalProps = {
  title: string;
  onSave: () => void | boolean;
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

  const default_availableHeight = windowHeight - insets.top - MODAL_MARGIN * 2;
  const animatedContainerStyle = useAnimatedStyle(() => {
    const kb = keyboard.height.value;

    const availableHeight =
      default_availableHeight - Math.max(insets.bottom, kb);

    return {
      maxHeight: availableHeight,
      transform: [
        {
          translateY: -(kb / 2),
        },
      ],
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
    borderRadius: 28,
    padding: 24,
    shadowColor: 'transparent',
  },
  modalTitle: {
    fontSize: 24,
    lineHeight: 24,
    marginBottom: 24,
  },
  body: {
    flexShrink: 1,
    minHeight: 0,
  },
  content: {
    paddingBottom: 16,
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 8,
    marginBottom: -8,
    marginHorizontal: -8,
  },
  flex: {
    flex: 1,
  },
});
