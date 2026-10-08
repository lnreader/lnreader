import { useCallback, useMemo, useState } from 'react';
import { Column, FlowRow, ListItem, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { useFocusEffect } from '@react-navigation/native';

import {
  AppIcon,
  AppText,
  Chip,
  Dialog,
  Fab,
  IconButtonV2,
  List,
  TextInput,
  listItemColors,
} from '@components';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import { useTheme } from '@hooks/persisted/useTheme';
import { useGenreTaxonomy } from '@hooks/persisted/useGenreTaxonomy';
import { getNovelsWithGenresFromDb } from '@database/queries/StatsQueries';
import { normalizeGenre } from '@screens/GenreStatsScreen/utils';
import { getString } from '@i18n/translations';
import type { GenreTaxonomyScreenProps } from '@navigators/types';
import SettingsPage from '../components/SettingsPage';
import AddIcon from '@expo/material-symbols/add.xml';
import ChevronRightIcon from '@expo/material-symbols/chevron_right.xml';

const SettingsTaxonomyScreen = ({ navigation }: GenreTaxonomyScreenProps) => {
  const theme = useTheme();
  const { taxonomy, setTaxonomy } = useGenreTaxonomy();

  const [dialog, setDialog] = useState<
    | { type: 'addParent' }
    | { type: 'editParent'; parentName: string }
    | { type: 'none' }
  >({ type: 'none' });

  // Form fields
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');
  const [libraryGenres, setLibraryGenres] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getNovelsWithGenresFromDb()
        .then(novels => {
          if (!active) return;
          const genres = new Map<string, string>();
          novels.forEach(novel =>
            novel.genres?.split(',').forEach(part => {
              const name = part.trim();
              if (name && !genres.has(normalizeGenre(name))) {
                genres.set(normalizeGenre(name), name);
              }
            }),
          );
          setLibraryGenres(
            [...genres.values()].sort((a, b) => a.localeCompare(b)),
          );
        })
        .catch(() => {
          if (active) setLibraryGenres([]);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const suggestions = useMemo(() => {
    const grouped = new Set(
      taxonomy
        .flatMap(node => [node.parent, ...node.children])
        .map(normalizeGenre),
    );
    return libraryGenres.filter(name => !grouped.has(normalizeGenre(name)));
  }, [libraryGenres, taxonomy]);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'parent';
    name: string;
  } | null>(null);

  const resetForm = () => {
    setParentName('');
    setChildName('');
  };

  const openDialog = (
    d: { type: 'addParent' } | { type: 'editParent'; parentName: string },
  ) => {
    resetForm();
    if (d.type === 'editParent') setParentName(d.parentName);
    setDialog(d);
  };

  const handleAddParent = () => {
    const name = parentName.trim();
    if (!name) return;
    if (taxonomy.some(t => normalizeGenre(t.parent) === normalizeGenre(name))) {
      return;
    }
    setTaxonomy([...taxonomy, { parent: name, children: [] }]);
    // Stay in the same dialog, now in edit mode, so subgenres can be added
    // directly without reopening.
    setDialog({ type: 'editParent', parentName: name });
  };

  const handleEditParent = () => {
    const name = parentName.trim();
    if (!name || dialog.type !== 'editParent') return;
    const oldName = dialog.parentName;
    if (
      taxonomy.some(
        t =>
          t.parent !== oldName &&
          normalizeGenre(t.parent) === normalizeGenre(name),
      )
    ) {
      return;
    }
    const updated = taxonomy.map(t =>
      t.parent === oldName ? { ...t, parent: name } : t,
    );
    setTaxonomy(updated);
    setDialog({ type: 'none' });
  };

  const handleAddChild = (value = childName) => {
    const name = value.trim();
    if (!name || dialog.type !== 'editParent') return;
    const node = taxonomy.find(t => t.parent === dialog.parentName);
    if (
      !node ||
      node.children.some(c => normalizeGenre(c) === normalizeGenre(name))
    ) {
      return;
    }
    const updated = taxonomy.map(t =>
      t.parent === dialog.parentName
        ? { ...t, children: [...t.children, name] }
        : t,
    );
    setTaxonomy(updated);
    setChildName('');
  };

  const handleDeleteParent = (name: string) => {
    setTaxonomy(taxonomy.filter(t => t.parent !== name));
    setDeleteTarget(null);
  };

  const handleDeleteChild = (pName: string, cName: string) => {
    const updated = taxonomy.map(t =>
      t.parent === pName
        ? { ...t, children: t.children.filter(c => c !== cName) }
        : t,
    );
    setTaxonomy(updated);
    setDeleteTarget(null);
  };

  const hasTaxonomy = taxonomy.length > 0;

  return (
    <SettingsPage
      title={getString('genreStats.taxonomyTitle')}
      onBack={navigation.goBack}
      floatingAction={
        <Fab
          extended
          icon={AddIcon}
          label={getString('genreStats.newGroup')}
          onPress={() => openDialog({ type: 'addParent' })}
        />
      }
      overlays={
        <>
          {(dialog.type === 'addParent' || dialog.type === 'editParent') && (
            <Dialog.Root visible onDismiss={() => setDialog({ type: 'none' })}>
              <Dialog.Header>
                <Dialog.Title>
                  {dialog.type === 'addParent'
                    ? getString('genreStats.newGroup')
                    : getString('genreStats.editGenreGroup')}
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.ScrollArea>
                <Column
                  verticalArrangement={{ spacedBy: 16 }}
                  modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
                >
                  <TextInput
                    testID="taxonomy-group-name"
                    label={getString('genreStats.parentNamePlaceholder')}
                    value={parentName}
                    onChangeText={setParentName}
                    singleLine
                  />

                  {dialog.type === 'editParent' &&
                    (() => {
                      const node = taxonomy.find(
                        t => t.parent === dialog.parentName,
                      );
                      if (!node) return null;
                      return (
                        <>
                          <AppText variant="titleSmall">
                            {getString('genreStats.genresInGroup')}
                          </AppText>
                          {node.children.length > 0 ? (
                            <FlowRow
                              horizontalArrangement={{ spacedBy: 8 }}
                              verticalArrangement={{ spacedBy: 8 }}
                              modifiers={[fillMaxWidth()]}
                            >
                              {node.children.map(item => (
                                <Chip
                                  key={item}
                                  kind="input"
                                  label={item}
                                  onRemove={() =>
                                    handleDeleteChild(dialog.parentName, item)
                                  }
                                  theme={theme}
                                />
                              ))}
                            </FlowRow>
                          ) : (
                            <AppText
                              variant="bodyMedium"
                              color={theme.onSurfaceVariant}
                            >
                              {getString('genreStats.noGenresInGroup')}
                            </AppText>
                          )}
                          <TextInput
                            testID="taxonomy-genre-name"
                            label={getString('genreStats.childNamePlaceholder')}
                            value={childName}
                            onChangeText={setChildName}
                            onSubmit={() => handleAddChild()}
                            singleLine
                            trailing={
                              <IconButtonV2
                                name={AddIcon}
                                accessibilityLabel={getString('common.add')}
                                disabled={!childName.trim()}
                                onPress={() => handleAddChild()}
                                theme={theme}
                              />
                            }
                          />
                          {suggestions.length > 0 && (
                            <Column verticalArrangement={{ spacedBy: 8 }}>
                              <AppText variant="titleSmall">
                                {getString('genreStats.foundInLibrary')}
                              </AppText>
                              <AppText
                                variant="bodyMedium"
                                color={theme.onSurfaceVariant}
                              >
                                {getString(
                                  'genreStats.ungroupedGenresDescription',
                                )}
                              </AppText>
                              <FlowRow
                                horizontalArrangement={{ spacedBy: 8 }}
                                verticalArrangement={{ spacedBy: 8 }}
                                modifiers={[fillMaxWidth()]}
                              >
                                {suggestions.map(name => (
                                  <Chip
                                    key={name}
                                    kind="assist"
                                    icon={AddIcon}
                                    label={name}
                                    onPress={() => handleAddChild(name)}
                                    theme={theme}
                                  />
                                ))}
                              </FlowRow>
                            </Column>
                          )}
                        </>
                      );
                    })()}
                </Column>
              </Dialog.ScrollArea>
              <Dialog.Actions>
                {dialog.type === 'editParent' && (
                  <Dialog.Action
                    onPress={() => {
                      setDialog({ type: 'none' });
                      setDeleteTarget({
                        type: 'parent',
                        name: dialog.parentName,
                      });
                    }}
                  >
                    {getString('common.delete')}
                  </Dialog.Action>
                )}
                <Dialog.Action onPress={() => setDialog({ type: 'none' })}>
                  {getString('common.cancel')}
                </Dialog.Action>
                <Dialog.Action
                  onPress={
                    dialog.type === 'addParent'
                      ? handleAddParent
                      : handleEditParent
                  }
                >
                  {getString('common.ok')}
                </Dialog.Action>
              </Dialog.Actions>
            </Dialog.Root>
          )}

          {deleteTarget?.type === 'parent' && (
            <ConfirmationDialog
              visible
              title={getString('genreStats.deleteConfirmTitle')}
              message={getString('genreStats.deleteGroupConfirm')}
              confirmLabel={getString('common.delete')}
              onConfirm={() => handleDeleteParent(deleteTarget.name)}
              onDismiss={() => setDeleteTarget(null)}
            />
          )}
        </>
      }
    >
      <AppText
        variant="bodyMedium"
        color={theme.onSurfaceVariant}
        modifiers={[padding(16, 16, 16, 0)]}
      >
        {getString('genreStats.taxonomyDescription')}
      </AppText>
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('genreStats.genreGroups')}
        </List.SubHeader>
        {hasTaxonomy ? (
          taxonomy.map(node => (
            <ListItem
              key={node.parent}
              colors={listItemColors(theme)}
              modifiers={[
                fillMaxWidth(),
                clickable(() =>
                  openDialog({ type: 'editParent', parentName: node.parent }),
                ),
              ]}
            >
              <ListItem.HeadlineContent>
                <AppText variant="bodyLarge" maxLines={1}>
                  {node.parent}
                </AppText>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <AppText
                  variant="bodyMedium"
                  color={theme.onSurfaceVariant}
                  maxLines={1}
                >
                  {node.children.length
                    ? node.children.join(', ')
                    : getString('genreStats.noGenresInGroup')}
                </AppText>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement={{ spacedBy: 8 }}
                >
                  {node.children.length > 0 ? (
                    <AppText
                      variant="labelLarge"
                      color={theme.onSurfaceVariant}
                    >
                      {String(node.children.length)}
                    </AppText>
                  ) : null}
                  <AppIcon
                    source={ChevronRightIcon}
                    tint={theme.onSurfaceVariant}
                  />
                </Row>
              </ListItem.TrailingContent>
            </ListItem>
          ))
        ) : (
          <List.Item
            title={getString('genreStats.noCategories')}
            theme={theme}
          />
        )}
      </List.Section>
    </SettingsPage>
  );
};

export default SettingsTaxonomyScreen;
