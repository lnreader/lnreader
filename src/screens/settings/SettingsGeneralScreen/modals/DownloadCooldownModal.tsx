import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Portal, TouchableRipple } from 'react-native-paper';

import { Modal } from '@components';
import { useAppSettings } from '@hooks/persisted';
import { DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS } from '@hooks/persisted/useSettings';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';

interface DownloadCooldownModalProps {
  visible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const msToSeconds = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) {
    return msToSeconds(DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS);
  }
  const seconds = ms / 1000;
  return Number.isInteger(seconds) ? seconds.toString() : seconds.toFixed(2);
};

const parseSecondsToMs = (input: string): number | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds * 1000);
};

/** Allow only digits and a single optional decimal point. */
const sanitizeNumericInput = (input: string): string => {
  const stripped = input.replace(/[^0-9.]/g, '');
  const firstDot = stripped.indexOf('.');
  if (firstDot === -1) return stripped;
  return (
    stripped.slice(0, firstDot + 1) +
    stripped.slice(firstDot + 1).replace(/\./g, '')
  );
};

const DownloadCooldownModal: React.FC<DownloadCooldownModalProps> = ({
  visible,
  hideModal,
  theme,
}) => {
  const { chapterDownloadCooldownMs, setAppSettings } = useAppSettings();
  const currentMs =
    chapterDownloadCooldownMs ?? DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS;
  const [draft, setDraft] = useState(msToSeconds(currentMs));

  useEffect(() => {
    if (visible) {
      setDraft(msToSeconds(currentMs));
    }
  }, [visible, currentMs]);

  const save = () => {
    const ms = parseSecondsToMs(draft);
    if (ms == null) {
      hideModal();
      return;
    }
    setAppSettings({ chapterDownloadCooldownMs: ms });
    hideModal();
  };

  const reset = () => {
    setAppSettings({
      chapterDownloadCooldownMs: DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS,
    });
    hideModal();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={hideModal}>
        <Text style={[styles.modalHeader, { color: theme.onSurface }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldown')}
        </Text>
        <Text style={[styles.modalDesc, { color: theme.onSurfaceVariant }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldownDesc')}
        </Text>
        <TextInput
          value={draft}
          onChangeText={text => setDraft(sanitizeNumericInput(text))}
          onSubmitEditing={save}
          keyboardType="decimal-pad"
          placeholder={getString(
            'generalSettingsScreen.chapterDownloadCooldownPlaceholder',
          )}
          placeholderTextColor={theme.onSurfaceVariant}
          style={[
            styles.input,
            { color: theme.onSurface, borderColor: theme.outline },
          ]}
          autoFocus
        />
        <Text style={[styles.warning, { color: theme.error }]}>
          {getString('generalSettingsScreen.chapterDownloadCooldownWarning')}
        </Text>
        <View style={styles.actions}>
          <TouchableRipple
            onPress={reset}
            borderless
            style={styles.actionButton}
            rippleColor={theme.rippleColor}
          >
            <Text style={[styles.actionLabel, { color: theme.primary }]}>
              {getString('common.reset')}
            </Text>
          </TouchableRipple>
          <TouchableRipple
            onPress={save}
            borderless
            style={styles.actionButton}
            rippleColor={theme.rippleColor}
          >
            <Text style={[styles.actionLabel, { color: theme.primary }]}>
              {getString('common.ok')}
            </Text>
          </TouchableRipple>
        </View>
      </Modal>
    </Portal>
  );
};

export default DownloadCooldownModal;

const styles = StyleSheet.create({
  modalHeader: {
    fontSize: 24,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
  },
  warning: {
    fontSize: 12,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 16,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
