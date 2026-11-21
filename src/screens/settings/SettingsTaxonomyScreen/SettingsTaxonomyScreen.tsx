import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { FAB, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Appbar, Dialog, List, SafeAreaView } from '@components';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import { useTheme } from '@hooks/persisted';
import { useGenreTaxonomy } from '@hooks/persisted/useGenreTaxonomy';
import { getNovelsWithGenresFromDb } from '@database/queries/StatsQueries';
import { normalizeGenre } from '@screens/GenreStatsScreen/utils';
import { getString } from '@i18n/translations';
import type { GenreTaxonomyScreenProps } from '@navigators/types';

const SettingsTaxonomyScreen = ({ navigation }: GenreTaxonomyScreenProps) => {
  const theme = useTheme();
  const { bottom, right } = useSafeAreaInsets();
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
    <SafeAreaView excludeTop>
      <Appbar
        mode="small"
        title={getString('genreStats.taxonomyTitle')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        style={[{ backgroundColor: theme.background }, styles.flex]}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
          {getString('genreStats.taxonomyDescription')}
        </Text>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('genreStats.genreGroups')}
          </List.SubHeader>
          {hasTaxonomy ? (
            taxonomy.map(node => (
              <Pressable
                key={node.parent}
                onPress={() =>
                  openDialog({ type: 'editParent', parentName: node.parent })
                }
                android_ripple={{ color: theme.rippleColor }}
              >
                <View
                  style={[
                    styles.row,
                    { borderBottomColor: theme.outlineVariant },
                  ]}
                >
                  <View style={styles.rowTextContainer}>
                    <Text
                      style={[styles.rowText, { color: theme.onSurface }]}
                      numberOfLines={1}
                    >
                      {node.parent}
                    </Text>
                    <Text
                      style={[
                        styles.rowSubText,
                        { color: theme.onSurfaceVariant },
                      ]}
                      numberOfLines={1}
                    >
                      {node.children.length
                        ? node.children.join(', ')
                        : getString('genreStats.noGenresInGroup')}
                    </Text>
                  </View>
                  {node.children.length > 0 && (
                    <Text style={{ color: theme.onSurfaceVariant }}>
                      {node.children.length}
                    </Text>
                  )}
                  <MaterialCommunityIcons
                    name="chevron-right"
                    color={theme.onSurfaceVariant}
                    size={24}
                  />
                </View>
              </Pressable>
            ))
          ) : (
            <List.Item
              title={getString('genreStats.noCategories')}
              theme={theme}
            />
          )}
        </List.Section>
      </ScrollView>

      <FAB
        style={[styles.fab, { backgroundColor: theme.primary, right, bottom }]}
        color={theme.onPrimary}
        icon="plus"
        label={getString('genreStats.newGroup')}
        uppercase={false}
        onPress={() => openDialog({ type: 'addParent' })}
      />

      {/* Add / Edit Parent Dialog */}
      {(dialog.type === 'addParent' || dialog.type === 'editParent') && (
        <Dialog.Root visible onDismiss={() => setDialog({ type: 'none' })}>
          <Dialog.Header>
            <Dialog.Title>
              {dialog.type === 'addParent'
                ? getString('genreStats.newGroup')
                : getString('genreStats.editGenreGroup')}
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Content>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={styles.dialogScroll}
              contentContainerStyle={styles.dialogContent}
            >
              <TextInput
                label={getString('genreStats.parentNamePlaceholder')}
                value={parentName}
                onChangeText={setParentName}
                mode="outlined"
              />

              {dialog.type === 'editParent' &&
                (() => {
                  const node = taxonomy.find(
                    t => t.parent === dialog.parentName,
                  );
                  if (!node) return null;
                  return (
                    <>
                      <Text
                        style={[styles.fieldLabel, { color: theme.onSurface }]}
                      >
                        {getString('genreStats.genresInGroup')}
                      </Text>
                      {node.children.length > 0 ? (
                        <View style={styles.chips}>
                          {node.children.map(item => (
                            <Pressable
                              key={item}
                              accessibilityRole="button"
                              accessibilityLabel={`${getString(
                                'common.remove',
                              )} ${item}`}
                              onPress={() =>
                                handleDeleteChild(dialog.parentName, item)
                              }
                              style={[
                                styles.chip,
                                { backgroundColor: theme.secondaryContainer },
                              ]}
                            >
                              <Text
                                style={{ color: theme.onSecondaryContainer }}
                              >
                                {item}
                              </Text>
                              <MaterialCommunityIcons
                                name="close"
                                size={16}
                                color={theme.onSecondaryContainer}
                              />
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={{ color: theme.onSurfaceVariant }}>
                          {getString('genreStats.noGenresInGroup')}
                        </Text>
                      )}
                      <TextInput
                        label={getString('genreStats.childNamePlaceholder')}
                        value={childName}
                        onChangeText={setChildName}
                        onSubmitEditing={() => handleAddChild()}
                        returnKeyType="done"
                        mode="outlined"
                        right={
                          <TextInput.Icon
                            icon="plus"
                            disabled={!childName.trim()}
                            onPress={() => handleAddChild()}
                          />
                        }
                      />
                      {suggestions.length > 0 && (
                        <View style={styles.suggestions}>
                          <Text
                            style={[
                              styles.fieldLabel,
                              { color: theme.onSurface },
                            ]}
                          >
                            {getString('genreStats.foundInLibrary')}
                          </Text>
                          <Text style={{ color: theme.onSurfaceVariant }}>
                            {getString('genreStats.ungroupedGenresDescription')}
                          </Text>
                          <View style={styles.chips}>
                            {suggestions.map(name => (
                              <Pressable
                                key={name}
                                accessibilityRole="button"
                                onPress={() => handleAddChild(name)}
                                style={[
                                  styles.suggestionChip,
                                  { borderColor: theme.outlineVariant },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name="plus"
                                  size={18}
                                  color={theme.primary}
                                />
                                <Text style={{ color: theme.onSurface }}>
                                  {name}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      )}
                    </>
                  );
                })()}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            {dialog.type === 'editParent' && (
              <Dialog.Action
                onPress={() => {
                  setDialog({ type: 'none' });
                  setDeleteTarget({ type: 'parent', name: dialog.parentName });
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
                dialog.type === 'addParent' ? handleAddParent : handleEditParent
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
    </SafeAreaView>
  );
};

export default SettingsTaxonomyScreen;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  dialogScroll: { flexShrink: 1 },
  dialogContent: { gap: 16 },
  scrollContent: {
    paddingBottom: 104,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  fab: { position: 'absolute', margin: 16, right: 0 },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 48,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowText: {
    fontSize: 16,
  },
  rowSubText: {
    fontSize: 13,
    marginTop: 2,
  },
  fieldLabel: { fontSize: 14, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  suggestions: { gap: 8, marginTop: 8 },
  suggestionChip: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
});
