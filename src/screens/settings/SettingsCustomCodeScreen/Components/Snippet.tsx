import { IconButtonV2, SwitchItem } from '@components';
import { useTheme } from '@hooks/persisted';
import { CodeSnippet } from '@utils/customCode';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

function Snippet({
  delete: _delete,
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
  const isJs = snippet.lang === 'js';
  return (
    <View style={styles.snippetRow}>
      <SwitchItem
        value={snippet.active}
        label={snippet.name}
        description={snippet.code.substring(0, 50)}
        descriptionNumberOfLines={2}
        onPress={() => toggle(index, isJs)}
        onLongPress={() => rename(index, isJs, snippet.name)}
        theme={theme}
        style={styles.switchItem}
      />
      <View style={styles.actionButtons}>
        <IconButtonV2
          name="pencil"
          size={20}
          onPress={() => edit(index, isJs)}
          theme={theme}
        />
        <IconButtonV2
          name="delete"
          size={20}
          onPress={() => _delete(index, isJs)}
          theme={theme}
        />
      </View>
    </View>
  );
}
export default memo(Snippet);

const styles = StyleSheet.create({
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
