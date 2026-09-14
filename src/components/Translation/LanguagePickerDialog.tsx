import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Dialog, TextInput } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { TRANSLATION_LANGUAGES } from '@api/translation/languages';

interface LanguagePickerDialogProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  current?: string;
  onSelect: (code: string) => void;
}

/**
 * Searchable language list for the source/target pickers. The list lives in a
 * ScrollView so long results scroll instead of clipping under the dialog cap.
 */
const LanguagePickerDialog: React.FC<LanguagePickerDialogProps> = ({
  visible,
  onDismiss,
  title,
  current,
  onSelect,
}) => {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return TRANSLATION_LANGUAGES;
    return TRANSLATION_LANGUAGES.filter(
      language =>
        language.name.toLowerCase().includes(needle) ||
        language.code.toLowerCase().includes(needle),
    );
  }, [query]);

  const select = (code: string) => {
    onSelect(code);
    onDismiss();
    setQuery('');
    setResetKey(key => key + 1);
  };

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Header>
        <Dialog.Title>{title}</Dialog.Title>
      </Dialog.Header>
      <Dialog.Content style={styles.content}>
        <TextInput
          key={resetKey}
          defaultValue={query}
          onChangeText={setQuery}
          placeholder={getString(
            'translationSettings.languageSearchPlaceholder',
          )}
          autoFocus
          autoCorrect={false}
        />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.options}
        >
          {filtered.map(language => {
            const active = language.code === current;
            return (
              <Pressable
                key={language.code}
                style={[
                  styles.option,
                  active && { backgroundColor: theme.secondaryContainer },
                ]}
                android_ripple={{ color: theme.rippleColor }}
                onPress={() => select(language.code)}
              >
                <Text style={[styles.label, { color: theme.onSurface }]}>
                  {language.name}
                </Text>
                {active ? (
                  <Text style={[styles.check, { color: theme.primary }]}>
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {filtered.length === 0 ? (
            <Text style={[styles.empty, { color: theme.onSurfaceVariant }]}>
              {getString('translationSettings.noLanguageMatch')}
            </Text>
          ) : null}
        </ScrollView>
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default React.memo(LanguagePickerDialog);

const styles = StyleSheet.create({
  content: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  scroll: {
    flexShrink: 1,
    maxHeight: 360,
    marginVertical: 8,
  },
  options: {
    paddingBottom: 8,
  },
  option: {
    alignItems: 'center',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    padding: 12,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  check: {
    fontSize: 16,
  },
  empty: {
    fontSize: 14,
    padding: 16,
  },
});
