import React, { useEffect } from 'react';
import { Modal, ModalProps, overlay, Portal } from 'react-native-paper';
import { StyleSheet, Text, View } from 'react-native';
import Button from '@components/Button/Button';
import { ThemeColors } from '@theme/types';
import { getString } from '@strings/translations';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { WINDOW_HEIGHT } from '@gorhom/bottom-sheet';
import SafeAreaView from '@components/SafeAreaView/SafeAreaView';
import { getRuntimeKind } from 'react-native-worklets';
import { useTheme } from '@hooks/persisted';
import { useKeyboardHeight } from '@hooks/common/useKeyboardHeight';

// --- Dynamic style helpers ---
const getModalTitleColor = (theme: ThemeColors) => ({ color: theme.onSurface });

export type DefaultModalProps = {
  /**
   * Title of the modal
   */
  title: string;
  /**
   * Dismisses the modal with onDismiss and calls onSave.
   * If onSave returns false, the modal will not be dismissed.
   */
  onSave: () => void | boolean;
  /**
   * The function to dismiss the modal
   */
  onDismiss: () => void;
  /**
   * Dismisses the modal with onDismiss and calls onCancel
   */
  onCancel?: () => void;
  /**
   * The function to reset the values
   */
  onReset?: () => void;
} & Omit<ModalProps, 'theme' | 'onDismiss' | 'contentContainerStyle'>;

const KeyboardAvoidingModal: React.FC<DefaultModalProps> = ({
  visible,
  onDismiss,
  onSave,
  onCancel,
  onReset,
  title,
  children,
  ...props
}) => {
  const theme = useTheme();
  const kH = useKeyboardHeight();

  const animatedRef = useAnimatedRef();

  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    if (!kH) {
      keyboardHeight.value = 0;
    } else {
      keyboardHeight.value = kH;
    }
  }, [kH, keyboardHeight]);

  const AvoidKeyboard = useAnimatedStyle(() => {
    let m: { height: number; pageY: number } | null = null;
    if (getRuntimeKind() !== 1) {
      try {
        m = measure(animatedRef);
      } catch {}
    }

    if (!m) {
      m = {
        height: 0,
        pageY: 0,
      };
    }
    const newWindowHeight = WINDOW_HEIGHT - keyboardHeight.value;
    const dif = Math.min(newWindowHeight - (m.height + m.pageY), 0);

    return {
      maxHeight: withTiming(newWindowHeight, {
        duration: 150,
      }),
      transform: [
        {
          translateY: withTiming(dif, { duration: 150 }),
        },
      ],
    };
  });

  const dismiss = (op?: () => void | boolean) => {
    if (op?.() === false) return;
    onDismiss();
  };
  const save = () => dismiss(onSave);
  const cancel = () => dismiss(onCancel);

  return (
    <Portal>
      <SafeAreaView>
        <Modal
          visible={visible}
          onDismiss={onDismiss}
          {...props}
          style={styles.contentContainer}
        >
          <Animated.View
            ref={animatedRef}
            style={[
              styles.modalContainer,
              { backgroundColor: overlay(2, theme.surface) },
              AvoidKeyboard,
            ]}
          >
            <Text style={[styles.modalTitle, getModalTitleColor(theme)]}>
              {title}
            </Text>
            {children}
            <View style={styles.buttonRow}>
              {!onReset ? null : (
                <Button onPress={onReset}>{getString('common.reset')}</Button>
              )}
              <View style={styles.flex} />
              <Button onPress={cancel}>{getString('common.cancel')}</Button>
              <Button onPress={save}>{getString('common.save')}</Button>
            </View>
          </Animated.View>
        </Modal>
      </SafeAreaView>
    </Portal>
  );
};

export default KeyboardAvoidingModal;

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 24,
  },
  modalContainer: {
    maxHeight: WINDOW_HEIGHT,
    borderRadius: 28,
    padding: 24,
    shadowColor: 'transparent', // Modal weird shadow fix
  },
  modalTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
});
