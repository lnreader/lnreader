import { IconButtonV2, AppText } from '@components';
import Switch from '@components/Switch/Switch';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { CodeSnippet } from '@utils/customCode';
import { memo } from 'react';
import { Box, Card, Column, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  combinedClickable,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import DeleteIcon from '@expo/material-symbols/delete.xml';
import EditIcon from '@expo/material-symbols/edit.xml';

function Snippet({
  delete: deleteSnippet,
  edit,
  rename,
  snippet,
  index,
  toggle,
}: {
  delete: (index: number, isJS: boolean) => void;
  edit: (index: number, isJS: boolean) => void;
  rename: (index: number, isJS: boolean, name: string) => void;
  toggle: (index: number, isJS: boolean) => void;
  index: number;
  snippet: CodeSnippet;
}) {
  const theme = useTheme();
  const isJS = snippet.lang === 'js';

  return (
    <Card
      colors={{
        // Not a primary-tinted container: some themes (Midnight Dusk) make it
        // the same colour as an enabled switch's track.
        containerColor: theme.surfaceContainerHigh,
        contentColor: theme.onSurface,
      }}
      modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
    >
      <Column
        modifiers={[
          fillMaxWidth(),
          combinedClickable({
            onClick: () => undefined,
            onLongClick: () => rename(index, isJS, snippet.name),
          }),
          padding(16, 12, 16, 0),
        ]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <Box
            modifiers={[
              clip(Shapes.RoundedCorner(8)),
              background(
                isJS ? theme.tertiaryContainer : theme.primaryContainer,
              ),
              padding(8, 2, 8, 2),
            ]}
          >
            <AppText
              variant="labelMedium"
              weight="700"
              color={
                isJS ? theme.onTertiaryContainer : theme.onPrimaryContainer
              }
            >
              {isJS ? 'JS' : 'CSS'}
            </AppText>
          </Box>
          <AppText variant="titleMedium" maxLines={2} modifiers={[weight(1)]}>
            {snippet.name}
          </AppText>
        </Row>
        <AppText
          variant="bodySmall"
          color={theme.onSurfaceVariant}
          maxLines={2}
          modifiers={[padding(0, 8, 0, 0)]}
        >
          {snippet.code}
        </AppText>
      </Column>
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(16, 0, 4, 4)]}
      >
        <Row modifiers={[weight(1)]}>
          <Switch
            value={snippet.active}
            onValueChange={() => toggle(index, isJS)}
          />
        </Row>
        <IconButtonV2
          accessibilityLabel={getString('common.edit')}
          name={EditIcon}
          color={theme.onSurface}
          onPress={() => edit(index, isJS)}
          theme={theme}
        />
        <IconButtonV2
          accessibilityLabel={getString('common.delete')}
          color={theme.onSurface}
          name={DeleteIcon}
          onPress={() => deleteSnippet(index, isJS)}
          theme={theme}
        />
      </Row>
    </Card>
  );
}

export default memo(Snippet);
