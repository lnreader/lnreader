import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput } from 'react-native';

import { Dialog } from '@components';
import { useAppSettings } from '@hooks/persisted';
import { DEFAULT_CHAPTER_DOWNLOAD_COOLDOWN_MS } from '@hooks/persisted/useSettings';
import { getString } from '@i18n/translations';
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
    <Dialog.Root visible={visible} onDismiss={hideModal}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('generalSettingsScreen.chapterDownloadCooldown')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('generalSettingsScreen.chapterDownloadCooldownDesc')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.Content>
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
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action title={getString('common.reset')} onPress={reset} />
        <Dialog.Action title={getString('common.ok')} onPress={save} />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default DownloadCooldownModal;

const styles = StyleSheet.create({
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
});
