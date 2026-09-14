import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '@react-native-vector-icons/material-design-icons';
import { Dialog, List, SwitchItem, TextInput } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { RegexCleanupRule } from '@api/translation/types';

interface RegexRulesEditorProps {
  rules: RegexCleanupRule[];
  onChange: (rules: RegexCleanupRule[]) => void;
}

type DraftRule = Omit<RegexCleanupRule, 'pattern'> & { pattern: string };

const emptyDraft = (): DraftRule => ({
  pattern: '',
  replacement: '',
  enabled: true,
});

const RegexRulesEditor: React.FC<RegexRulesEditorProps> = ({
  rules,
  onChange,
}) => {
  const theme = useTheme();
  const [editingIndex, setEditingIndex] = useState(-2); // -2 closed, -1 new
  const [draft, setDraft] = useState<DraftRule>(emptyDraft());

  const openEditor = (index: number) => {
    setDraft(
      index >= 0 && index < rules.length ? { ...rules[index] } : emptyDraft(),
    );
    setEditingIndex(index);
  };

  const close = () => {
    setEditingIndex(-2);
    setDraft(emptyDraft());
  };

  const save = () => {
    const pattern = draft.pattern.trim();
    if (pattern.length > 0) {
      const nextRule = {
        pattern,
        replacement: draft.replacement,
        enabled: draft.enabled,
      };
      onChange(
        editingIndex >= 0 && editingIndex < rules.length
          ? rules.map((rule, index) =>
              index === editingIndex ? nextRule : rule,
            )
          : [...rules, nextRule],
      );
    }
    close();
  };

  const remove = (index: number) => {
    onChange(rules.filter((_, ruleIndex) => ruleIndex !== index));
  };

  return (
    <>
      {rules.length === 0 ? (
        <List.InfoItem
          title={getString('translationSettings.noRules')}
          theme={theme}
        />
      ) : (
        rules.map((rule, index) => (
          <Pressable
            key={`${rule.pattern}-${index}`}
            style={styles.row}
            android_ripple={{ color: theme.rippleColor }}
            onPress={() => openEditor(index)}
          >
            <View style={styles.rowText}>
              <Text
                numberOfLines={1}
                style={[
                  styles.pattern,
                  {
                    color: rule.enabled
                      ? theme.onSurface
                      : theme.onSurfaceDisabled,
                  },
                ]}
              >
                {rule.pattern}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.replacement, { color: theme.onSurfaceVariant }]}
              >
                {rule.replacement
                  ? `→ ${rule.replacement}`
                  : getString('translationSettings.ruleRemoveText')}
              </Text>
            </View>
            <Icon
              name="pencil-outline"
              size={20}
              color={theme.onBackground}
              onPress={event => {
                event.stopPropagation();
                openEditor(index);
              }}
            />
            <Icon
              name="trash-can-outline"
              size={20}
              color={theme.onBackground}
              style={styles.deleteIcon}
              onPress={event => {
                event.stopPropagation();
                remove(index);
              }}
            />
          </Pressable>
        ))
      )}
      <List.Item
        title={getString('translationSettings.addRule')}
        icon="plus"
        onPress={() => openEditor(-1)}
        theme={theme}
      />

      <Dialog.Root visible={editingIndex !== -2} onDismiss={close}>
        <Dialog.Header>
          <Dialog.Title>
            {editingIndex === -1
              ? getString('translationSettings.addRule')
              : getString('translationSettings.editRule')}
          </Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <TextInput
            placeholder={getString('translationSettings.rulePattern')}
            defaultValue={draft.pattern}
            onChangeText={text => setDraft({ ...draft, pattern: text })}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.field}
          />
          <TextInput
            placeholder={getString('translationSettings.ruleReplacement')}
            defaultValue={draft.replacement}
            onChangeText={text => setDraft({ ...draft, replacement: text })}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.field}
          />
          <SwitchItem
            theme={theme}
            value={draft.enabled}
            label={getString('translationSettings.ruleEnabled')}
            onPress={() => setDraft({ ...draft, enabled: !draft.enabled })}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={close}>
            {getString('common.cancel')}
          </Dialog.Action>
          <Dialog.Action onPress={save}>
            {getString('common.save')}
          </Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>
    </>
  );
};

export default React.memo(RegexRulesEditor);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 4,
    flexDirection: 'row',
    marginHorizontal: 12,
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    paddingRight: 8,
  },
  pattern: {
    fontSize: 14,
  },
  replacement: {
    fontSize: 12,
    marginTop: 2,
  },
  deleteIcon: {
    marginStart: 12,
  },
  field: {
    marginTop: 12,
  },
});
