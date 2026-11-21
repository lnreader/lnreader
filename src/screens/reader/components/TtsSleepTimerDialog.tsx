import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components/Dialog';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import type {
  TtsSleepTimerConfig,
  TtsSleepTimerState,
} from '@modules/nitro-tts';

type Props = {
  autoPageAdvance: boolean;
  onCancel(): void;
  onDismiss(): void;
  onStart(config: TtsSleepTimerConfig): void;
  timer: TtsSleepTimerState;
  visible: boolean;
};

const TtsSleepTimerDialog = ({
  autoPageAdvance,
  onCancel,
  onDismiss,
  onStart,
  timer,
  visible,
}: Props) => {
  const theme = useTheme();
  const [mode, setMode] = useState<'duration' | 'chapters'>('duration');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [chapters, setChapters] = useState('1');
  const [validation, setValidation] = useState('');

  const dismiss = () => {
    setValidation('');
    onDismiss();
  };

  const start = () => {
    if (mode === 'duration') {
      const parsedHours = Number(hours);
      const parsedMinutes = Number(minutes);
      const totalMinutes = parsedHours * 60 + parsedMinutes;
      if (
        !Number.isInteger(parsedHours) ||
        !Number.isInteger(parsedMinutes) ||
        parsedHours < 0 ||
        parsedHours > 23 ||
        parsedMinutes < 0 ||
        parsedMinutes > 59 ||
        totalMinutes < 1
      ) {
        setValidation(getString('readerScreen.ttsSleepTimer.invalidDuration'));
        return;
      }
      onStart({ mode: 'duration', durationSeconds: totalMinutes * 60 });
    } else {
      const parsedChapters = Number(chapters);
      if (
        !Number.isInteger(parsedChapters) ||
        parsedChapters < 1 ||
        parsedChapters > 999
      ) {
        setValidation(getString('readerScreen.ttsSleepTimer.invalidChapters'));
        return;
      }
      onStart({ mode: 'chapters', chapterCount: parsedChapters });
    }
    dismiss();
  };

  const cancel = () => {
    onCancel();
    dismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={dismiss}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('readerScreen.ttsSleepTimer.title')}
        </Dialog.Title>
      </Dialog.Header>
      <Dialog.Content>
        <View style={styles.modeRow}>
          {(['duration', 'chapters'] as const).map(nextMode => {
            const selected = mode === nextMode;
            return (
              <Pressable
                key={nextMode}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setMode(nextMode);
                  setValidation('');
                }}
                style={[
                  styles.modeButton,
                  {
                    backgroundColor: selected
                      ? theme.primaryContainer
                      : theme.surfaceVariant,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected
                      ? theme.onPrimaryContainer
                      : theme.onSurfaceVariant,
                  }}
                >
                  {getString(
                    nextMode === 'duration'
                      ? 'readerScreen.ttsSleepTimer.duration'
                      : 'readerScreen.ttsSleepTimer.chapters',
                  )}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {mode === 'duration' ? (
          <View style={styles.inputRow}>
            <TextInput
              label={getString('readerScreen.ttsSleepTimer.hours')}
              value={hours}
              onChangeText={setHours}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label={getString('readerScreen.ttsSleepTimer.minutes')}
              value={minutes}
              onChangeText={setMinutes}
              keyboardType="number-pad"
              mode="outlined"
              style={styles.input}
            />
          </View>
        ) : (
          <>
            <TextInput
              label={getString('readerScreen.ttsSleepTimer.chapterCount')}
              value={chapters}
              onChangeText={setChapters}
              keyboardType="number-pad"
              mode="outlined"
            />
            {!autoPageAdvance ? (
              <Text style={[styles.hint, { color: theme.onSurfaceVariant }]}>
                {getString('readerScreen.ttsSleepTimer.autoAdvanceRequired')}
              </Text>
            ) : null}
          </>
        )}
        {validation ? (
          <Text style={[styles.error, { color: theme.error }]}>
            {validation}
          </Text>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        {timer.active ? (
          <Dialog.Action onPress={cancel}>
            {getString('readerScreen.ttsSleepTimer.cancelTimer')}
          </Dialog.Action>
        ) : null}
        <Dialog.Action onPress={dismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={start}>
          {getString('readerScreen.ttsSleepTimer.start')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeButton: {
    alignItems: 'center',
    borderRadius: 20,
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputRow: { flexDirection: 'row', gap: 12 },
  input: { flex: 1 },
  hint: { fontSize: 12, marginTop: 8 },
  error: { fontSize: 12, marginTop: 8 },
});

export default TtsSleepTimerDialog;
