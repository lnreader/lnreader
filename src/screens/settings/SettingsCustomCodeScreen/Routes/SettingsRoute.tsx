import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import ReplaceItemModal from '../Modals/ReplaceItemModal';
import { List, SwitchItem, IconButtonV2 } from '@components';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';

type SettingsRouteProps = {
  onEditSnippet?: (index: number, isJS: boolean) => void;
};

const defaultExtended = [false, false, false, false];

const SettingsRoute: React.FC<SettingsRouteProps> = ({ onEditSnippet }) => {
  const theme = useTheme();
  const {
    codeSnippetsJS,
    codeSnippetsCSS,
    setChapterReaderSettings: setSettings,
  } = useChapterReaderSettings();
  const [extended, setExtended] = React.useState(defaultExtended);
  const toggleExtended = React.useCallback(
    (index: number) => {
      const newExtended = [...defaultExtended];
      newExtended[index] = !extended[index];
      setExtended(newExtended);
    },
    [extended],
  );

  const toggleSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? [...codeSnippetsJS] : [...codeSnippetsCSS];
      snippets[index].active = !snippets[index].active;
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const deleteSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      const snippets = isJS ? [...codeSnippetsJS] : [...codeSnippetsCSS];
      snippets.splice(index, 1);
      setSettings({
        [isJS ? 'codeSnippetsJS' : 'codeSnippetsCSS']: snippets,
      });
    },
    [codeSnippetsJS, codeSnippetsCSS, setSettings],
  );

  const editSnippet = React.useCallback(
    (index: number, isJS: boolean) => {
      onEditSnippet?.(index, isJS);
    },
    [onEditSnippet],
  );

  return (
    <ScrollView style={styles.paddingBottom}>
      <List.Section>
        <List.SubHeader theme={theme}>{'Text manipulation'}</List.SubHeader>
        <ReplaceItemModal
          showReplace
          toggleList={() => toggleExtended(0)}
          listExpanded={extended[0]}
        />
        <ReplaceItemModal
          toggleList={() => toggleExtended(1)}
          listExpanded={extended[1]}
        />
        <List.Divider theme={theme} />
        <List.SubHeader theme={theme}>{'Code Snippets'}</List.SubHeader>
        <List.Item
          title={'Create new snippet'}
          description={'Add CSS or JavaScript code'}
          theme={theme}
          right="plus"
          onPress={() => onEditSnippet?.(-1, true)} // -1 indicates new snippet
        />

        {/* CSS Snippets */}
        {codeSnippetsCSS.length > 0 && (
          <>
            <View style={styles.subSubHeader}>
              <List.SubHeader theme={theme}>{'CSS Snippets'}</List.SubHeader>
            </View>
            {codeSnippetsCSS.map((snippet, index) => (
              <View key={`css-${index}`} style={styles.snippetRow}>
                <SwitchItem
                  value={snippet.active}
                  label={snippet.name}
                  description={
                    snippet.code.substring(0, 50) +
                    (snippet.code.length > 50 ? '...' : '')
                  }
                  onPress={() => toggleSnippet(index, false)}
                  theme={theme}
                  style={styles.switchItem}
                />
                <View style={styles.actionButtons}>
                  <IconButtonV2
                    name="pencil"
                    size={20}
                    onPress={() => editSnippet(index, false)}
                    theme={theme}
                  />
                  <IconButtonV2
                    name="delete"
                    size={20}
                    onPress={() => deleteSnippet(index, false)}
                    theme={theme}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {/* JS Snippets */}
        {codeSnippetsJS.length > 0 && (
          <>
            <View style={styles.subSubHeader}>
              <List.SubHeader theme={theme}>
                {'JavaScript Snippets'}
              </List.SubHeader>
            </View>
            {codeSnippetsJS.map((snippet, index) => (
              <View key={`js-${index}`} style={styles.snippetRow}>
                <SwitchItem
                  value={snippet.active}
                  label={snippet.name}
                  description={
                    snippet.code.substring(0, 50) +
                    (snippet.code.length > 50 ? '...' : '')
                  }
                  onPress={() => toggleSnippet(index, true)}
                  theme={theme}
                  style={styles.switchItem}
                />
                <View style={styles.actionButtons}>
                  <IconButtonV2
                    name="pencil"
                    size={20}
                    onPress={() => editSnippet(index, true)}
                    theme={theme}
                  />
                  <IconButtonV2
                    name="delete"
                    size={20}
                    onPress={() => deleteSnippet(index, true)}
                    theme={theme}
                  />
                </View>
              </View>
            ))}
          </>
        )}

        {codeSnippetsCSS.length === 0 && codeSnippetsJS.length === 0 && (
          <List.Item title={'No code snippets'} theme={theme} />
        )}
      </List.Section>
    </ScrollView>
  );
};

export default SettingsRoute;

const styles = StyleSheet.create({
  paddingBottom: { paddingBottom: 40 },
  subSubHeader: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  switchItem: {
    flex: 1,
    paddingHorizontal: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
});
