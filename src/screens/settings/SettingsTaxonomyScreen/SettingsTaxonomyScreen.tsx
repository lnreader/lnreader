import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconButton, TextInput } from 'react-native-paper';

import { Appbar, Dialog, List, SafeAreaView } from '@components';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import { useTheme } from '@hooks/persisted';
import { useGenreTaxonomy } from '@hooks/persisted/useGenreTaxonomy';
import { normalizeGenre } from '@screens/GenreStatsScreen/utils';
import { getString } from '@i18n/translations';
import type { GenreTaxonomyScreenProps } from '@navigators/types';

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

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: 'parent'; name: string }
    | null
  >(null);

  const resetForm = () => {
    setParentName('');
    setChildName('');
  };

  const openDialog = (
    d:
      | { type: 'addParent' }
      | { type: 'editParent'; parentName: string },
  ) => {
    resetForm();
    if (d.type === 'editParent') setParentName(d.parentName);
    setDialog(d);
  };

  const handleAddParent = () => {
    const name = parentName.trim();
    if (!name) return;
    if (
      taxonomy.some(
        t => normalizeGenre(t.parent) === normalizeGenre(name),
      )
    ) return;
    setTaxonomy([...taxonomy, { parent: name, children: [] }]);
    setDialog({ type: 'none' });
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
    ) return;
    const updated = taxonomy.map(t =>
      t.parent === oldName ? { ...t, parent: name } : t,
    );
    setTaxonomy(updated);
    setDialog({ type: 'none' });
  };

  const handleAddChild = () => {
    const name = childName.trim();
    if (!name || dialog.type !== 'editParent') return;
    const node = taxonomy.find(t => t.parent === dialog.parentName);
    if (
      !node ||
      node.children.some(c => normalizeGenre(c) === normalizeGenre(name))
    ) return;
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
        title={getString('genreStats.taxonomyTitle')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        style={[{ backgroundColor: theme.background }, styles.flex]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Parent categories section */}
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('genreStats.parentCategories')}
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
                <View style={styles.row}>
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
                    >
                      {getString('genreStats.subgenres', {
                        count: node.children.length,
                      })}
                    </Text>
                  </View>
                  <View style={styles.rowActions}>
                    <IconButton
                      icon="close"
                      iconColor={theme.onSurfaceVariant}
                      size={20}
                      onPress={() =>
                        setDeleteTarget({
                          type: 'parent',
                          name: node.parent,
                        })
                      }
                    />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <List.Item
              title={getString('genreStats.noCategories')}
              theme={theme}
            />
          )}
          <List.Item
            title={getString('genreStats.addCategory')}
            icon="plus"
            onPress={() => openDialog({ type: 'addParent' })}
            theme={theme}
          />
        </List.Section>
      </ScrollView>

      {/* Add / Edit Parent Dialog */}
      {(dialog.type === 'addParent' || dialog.type === 'editParent') && (
        <Dialog.Root
          visible
          onDismiss={() => setDialog({ type: 'none' })}
        >
          <Dialog.Header>
            <Dialog.Title>
              {dialog.type === 'addParent'
                ? getString('genreStats.addCategory')
                : dialog.parentName}
            </Dialog.Title>
          </Dialog.Header>
          <Dialog.Content>
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
                    {node.children.length > 0 && (
                      <FlatList
                        data={node.children}
                        keyExtractor={item => item}
                        renderItem={({ item }) => (
                          <View style={styles.childRow}>
                            <Text
                              style={[
                                styles.childText,
                                { color: theme.onSurface },
                              ]}
                              numberOfLines={1}
                            >
                              {item}
                            </Text>
                            <Pressable
                              onPress={() =>
                                handleDeleteChild(dialog.parentName, item)
                              }
                              hitSlop={8}
                            >
                              <IconButton
                                icon="close"
                                iconColor={theme.onSurfaceVariant}
                                size={18}
                              />
                            </Pressable>
                          </View>
                        )}
                        style={styles.childList}
                      />
                    )}
                    <View style={styles.inlineAddChild}>
                      <TextInput
                        label={getString('genreStats.childNamePlaceholder')}
                        value={childName}
                        onChangeText={setChildName}
                        mode="outlined"
                        style={styles.inlineInput}
                      />
                      <IconButton
                        icon="plus"
                        iconColor={theme.primary}
                        size={24}
                        disabled={!childName.trim()}
                        onPress={handleAddChild}
                      />
                    </View>
                  </>
                );
              })()}
          </Dialog.Content>
          <Dialog.Actions>
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


      {/* Delete confirmations */}
      {deleteTarget?.type === 'parent' && (
        <ConfirmationDialog
          visible
          title={getString('genreStats.deleteConfirmTitle')}
          message={getString('genreStats.deleteCategoryConfirm')}
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
  scrollContent: {
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childList: {
    marginTop: 16,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingLeft: 8,
  },
  childText: {
    fontSize: 14,
    flex: 1,
  },
  inlineAddChild: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  inlineInput: {
    flex: 1,
    marginRight: 8,
  },
});
