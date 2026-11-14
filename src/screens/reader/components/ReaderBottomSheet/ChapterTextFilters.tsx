import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { Chip, IconButton, TextInput } from 'react-native-paper';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

export interface ChapterTextFiltersProps {
  chapterTextFilters: string[];
  setChapterTextFilters: (filters: string[]) => void;
}

export default function ChapterTextFilters({
  chapterTextFilters,
  setChapterTextFilters,
}: ChapterTextFiltersProps) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim() || chapterTextFilters.includes(text)) return;
    setChapterTextFilters([...chapterTextFilters, text]);
    setText('');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.description, { color: theme.onSurfaceVariant }]}>
        {getString('readerScreen.bottomSheet.chapterTextFiltersDescription')}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          mode="outlined"
          dense
          accessibilityLabel={getString('readerScreen.bottomSheet.filterText')}
          placeholder={getString('readerScreen.bottomSheet.filterText')}
          style={[
            styles.input,
            { backgroundColor: theme.surfaceContainerLow ?? theme.surface },
          ]}
          theme={{ colors: theme }}
          render={props => <BottomSheetTextInput {...props} />}
          value={text}
          onChangeText={setText}
          autoCorrect={false}
          autoCapitalize="none"
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <IconButton
          icon="plus"
          mode="contained-tonal"
          accessibilityLabel={getString('common.add')}
          onPress={add}
          disabled={!text.trim() || chapterTextFilters.includes(text)}
          style={styles.addButton}
          theme={{ colors: theme }}
        />
      </View>
      {chapterTextFilters.length > 0 && (
        <View style={styles.chips}>
          {chapterTextFilters.map(filter => (
            <Chip
              key={filter}
              compact
              style={[
                styles.chip,
                { backgroundColor: theme.secondaryContainer },
              ]}
              textStyle={[
                styles.chipText,
                { color: theme.onSecondaryContainer },
              ]}
              theme={{ colors: theme }}
              accessibilityLabel={filter}
              closeIconAccessibilityLabel={`${getString(
                'common.remove',
              )}: ${filter}`}
              onClose={() =>
                setChapterTextFilters(
                  chapterTextFilters.filter(value => value !== filter),
                )
              }
            >
              {filter}
            </Chip>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, gap: 12 },
  description: { fontSize: 12, lineHeight: 18 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, fontSize: 14 },
  addButton: { margin: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { maxWidth: '100%' },
  chipText: { fontSize: 12 },
});
