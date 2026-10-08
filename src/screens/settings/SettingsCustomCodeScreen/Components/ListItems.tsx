import { AppIcon, AppText, IconButtonV2 } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { memo } from 'react';
import { Box, Card, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import ArrowForwardIcon from '@expo/material-symbols/arrow_forward.xml';
import DeleteIcon from '@expo/material-symbols/delete.xml';
import EditIcon from '@expo/material-symbols/edit.xml';

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
    const isReplace = tone === 'replace';

    return (
      <Card
        colors={{
          containerColor: theme.secondaryContainer,
          contentColor: theme.onSurface,
        }}
        modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(16, 8, 4, 8)]}
        >
          <Box
            modifiers={[
              clip(Shapes.RoundedCorner(8)),
              background(
                isReplace ? theme.primaryContainer : theme.errorContainer,
              ),
              padding(8, 2, 8, 2),
            ]}
          >
            <AppText
              variant="labelMedium"
              weight="700"
              color={
                isReplace ? theme.onPrimaryContainer : theme.onErrorContainer
              }
            >
              {label}
            </AppText>
          </Box>
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 6 }}
            modifiers={[weight(1)]}
          >
            <AppText variant="bodyMedium" maxLines={2} modifiers={[weight(1)]}>
              {match}
            </AppText>
            {replacement !== undefined ? (
              <>
                <AppIcon
                  source={ArrowForwardIcon}
                  size={20}
                  tint={theme.onSurfaceVariant}
                />
                <AppText
                  variant="bodyMedium"
                  maxLines={2}
                  modifiers={[weight(1)]}
                >
                  {replacement}
                </AppText>
              </>
            ) : null}
          </Row>
          <IconButtonV2
            accessibilityLabel={getString('common.edit')}
            name={EditIcon}
            color={theme.onSurface}
            onPress={onEdit}
            theme={theme}
          />
          <IconButtonV2
            accessibilityLabel={getString('common.delete')}
            color={theme.onSurface}
            name={DeleteIcon}
            onPress={onDelete}
            theme={theme}
          />
        </Row>
      </Card>
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
