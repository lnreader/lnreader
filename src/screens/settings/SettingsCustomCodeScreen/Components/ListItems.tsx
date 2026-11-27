import { IconButtonV2 } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import Icon from '@react-native-vector-icons/material-design-icons';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

type RuleCardProps = {
  label: string;
  match: string;
  replacement?: string;
  onDelete: () => void;
  onEdit: () => void;
  tone: 'replace' | 'remove';
};

const RuleCard = memo(
  ({ label, match, replacement, onDelete, onEdit, tone }: RuleCardProps) => {
    const theme = useTheme();
    const colorTheme = useMemo(() => ({ colors: theme }), [theme]);
    const isReplace = tone === 'replace';

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: theme.secondaryContainer },
        ]}
      >
        <View style={styles.cardContent}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: isReplace
                  ? theme.primaryContainer
                  : theme.errorContainer,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: isReplace
                    ? theme.onPrimaryContainer
                    : theme.onErrorContainer,
                },
              ]}
              theme={colorTheme}
            >
              {label}
            </Text>
          </View>
          <View style={styles.ruleContent}>
            <Text
              numberOfLines={2}
              style={[styles.ruleText, { color: theme.onSurface }]}
              theme={colorTheme}
            >
              {match}
            </Text>
            {replacement !== undefined ? (
              <>
                <Icon
                  accessible={false}
                  name="arrow-right"
                  size={20}
                  color={theme.onSurfaceVariant}
                />
                <Text
                  numberOfLines={2}
                  style={[
                    styles.ruleText,
                    styles.replacementText,
                    { color: theme.onSurface },
                  ]}
                  theme={colorTheme}
                >
                  {replacement}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <View style={styles.actions}>
          <IconButtonV2
            accessibilityLabel={getString('common.edit')}
            name="pencil-outline"
            color={theme.onSurface}
            onPress={onEdit}
            padding={12}
            theme={theme}
          />
          <IconButtonV2
            accessibilityLabel={getString('common.delete')}
            color={theme.onSurface}
            name="delete-outline"
            onPress={onDelete}
            padding={12}
            theme={theme}
          />
        </View>
      </View>
    );
  },
);

RuleCard.displayName = 'RuleCard';

export const ReplaceItem = memo(
  ({
    item,
    removeItem,
    editItem,
  }: {
    item: [string, string];
    removeItem: (identifier: string | number) => void;
    editItem: (item: string[]) => void;
  }) => (
    <RuleCard
      label={getString('customCodeSettings.replace')}
      match={item[0]}
      replacement={item[1]}
      onDelete={() => removeItem(item[0])}
      onEdit={() => editItem(item)}
      tone="replace"
    />
  ),
);

ReplaceItem.displayName = 'ReplaceItem';

export const RemoveItem = memo(
  ({
    item,
    index,
    removeItem,
    editItem,
  }: {
    item: string;
    index: number;
    removeItem: (identifier: string | number) => void;
    editItem: (item: string[]) => void;
  }) => (
    <RuleCard
      label={getString('common.remove')}
      match={item}
      onDelete={() => removeItem(index)}
      onEdit={() => editItem([item])}
      tone="remove"
    />
  ),
);

RemoveItem.displayName = 'RemoveItem';

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  card: {
    borderCurve: 'continuous',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  cardContent: {
    minHeight: 48,
  },
  replacementText: {
    textAlign: 'right',
  },
  ruleContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  ruleText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 14,
    lineHeight: 20,
  },
});
