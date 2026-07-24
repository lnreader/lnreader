import React, { useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { TextInput } from 'react-native-paper';
import { updateNovelInfo } from '@database/queries/NovelQueries';

import { getString } from '@i18n/translations';
import { Dialog } from '@components';
import { ThemeColors } from '@theme/types';
import { NovelInfo } from '@database/types';
import { NovelStatus } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';

interface EditInfoModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  setNovel: (novel: NovelInfo | undefined) => void;
}

// --- Dynamic style helpers ---
const getStatusLabelColor = (theme: ThemeColors) => ({
  color: theme.onSurfaceVariant,
});
const getScrollViewStyle = () => styles.statusScrollView;
const getStatusChipContainer = () => styles.statusChipContainer;
const getStatusChipPressable = (selected: boolean, theme: ThemeColors) => ({
  backgroundColor: selected ? theme.rippleColor : 'transparent',
});
const getStatusChipText = (selected: boolean, theme: ThemeColors) => ({
  color: selected ? theme.primary : theme.onSurfaceVariant,
});
const getGenreListStyle = () => styles.genreList;

// --- Main Component ---
const EditInfoModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  setNovel,
}: EditInfoModalProps) => {
  const initialNovelInfo = { ...novel };
  const [novelInfo, setNovelInfo] = useState(novel);

  const [newGenre, setNewGenre] = useState('');

  const removeTag = (t: string) => {
    setNovelInfo({
      ...novel,
      genres: novelInfo.genres
        ?.split(',')
        .filter(item => item !== t)
        ?.join(','),
    });
  };

  const status = Object.values(NovelStatus);

  return (
    <Dialog.Root visible={modalVisible} onDismiss={hideModal}>
      <Dialog.Title>{getString('novelScreen.edit.info')}</Dialog.Title>
      <Dialog.ScrollArea>
        <ScrollView
          contentContainerStyle={styles.formContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusRow}>
            <Text style={getStatusLabelColor(theme)}>
              {getString('novelScreen.edit.status')}
            </Text>
            <ScrollView
              style={getScrollViewStyle()}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {status.map((item, index) => (
                <View
                  style={getStatusChipContainer()}
                  key={'novelInfo' + index}
                >
                  <Pressable
                    style={[
                      styles.statusChipPressable,
                      getStatusChipPressable(novelInfo.status === item, theme),
                    ]}
                    android_ripple={{
                      color: theme.rippleColor,
                    }}
                    onPress={() => setNovelInfo({ ...novel, status: item })}
                  >
                    <Text
                      style={getStatusChipText(
                        novelInfo.status === item,
                        theme,
                      )}
                    >
                      {translateNovelStatus(item)}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
          <TextInput
            defaultValue={initialNovelInfo.name}
            value={novelInfo.name}
            placeholder={getString('novelScreen.edit.title', {
              title: novel.name,
            })}
            numberOfLines={1}
            mode="outlined"
            theme={{ colors: { ...theme } }}
            onChangeText={text => setNovelInfo({ ...novel, name: text })}
            dense
            style={styles.inputWrapper}
          />
          <TextInput
            defaultValue={initialNovelInfo.author ?? undefined}
            value={novelInfo.author ?? undefined}
            placeholder={getString('novelScreen.edit.author', {
              author: novel.author,
            })}
            numberOfLines={1}
            mode="outlined"
            theme={{ colors: { ...theme } }}
            onChangeText={text => setNovelInfo({ ...novel, author: text })}
            dense
            style={styles.inputWrapper}
          />
          <TextInput
            defaultValue={initialNovelInfo.artist ?? undefined}
            value={novelInfo.artist ?? undefined}
            placeholder={'Artist: ' + novel.artist}
            numberOfLines={1}
            mode="outlined"
            theme={{ colors: { ...theme } }}
            onChangeText={text => setNovelInfo({ ...novel, artist: text })}
            dense
            style={styles.inputWrapper}
          />
          <TextInput
            defaultValue={initialNovelInfo.summary ?? undefined}
            value={novelInfo.summary ?? undefined}
            placeholder={getString('novelScreen.edit.summary', {
              summary: novel.summary?.substring(0, 16),
            })}
            numberOfLines={1}
            mode="outlined"
            onChangeText={text => setNovelInfo({ ...novel, summary: text })}
            theme={{ colors: { ...theme } }}
            dense
            style={styles.inputWrapper}
          />

          <TextInput
            value={newGenre}
            placeholder={getString('novelScreen.edit.addTag')}
            numberOfLines={1}
            mode="outlined"
            onChangeText={text => setNewGenre(text)}
            onSubmitEditing={() => {
              const newGenreTrimmed = newGenre.trim();

              if (newGenreTrimmed === '') {
                return;
              }

              setNovelInfo(prevVal => ({
                ...prevVal,
                genres: novelInfo.genres
                  ? `${novelInfo.genres},` + newGenreTrimmed
                  : newGenreTrimmed,
              }));
              setNewGenre('');
            }}
            theme={{ colors: { ...theme } }}
            dense
            style={styles.inputWrapper}
          />

          {novelInfo.genres !== undefined && novelInfo.genres !== '' ? (
            <FlatList
              style={getGenreListStyle()}
              horizontal
              data={novelInfo.genres?.split(',')}
              keyExtractor={(_, index) => 'novelTag' + index}
              renderItem={({ item }) => (
                <GenreChip theme={theme} onPress={() => removeTag(item)}>
                  {item}
                </GenreChip>
              )}
              showsHorizontalScrollIndicator={false}
            />
          ) : null}
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          title={getString('common.reset')}
          onPress={() => {
            setNovelInfo(initialNovelInfo);
            updateNovelInfo(initialNovelInfo);
          }}
        />
        <Dialog.Action title={getString('common.cancel')} onPress={hideModal} />
        <Dialog.Action
          title={getString('common.save')}
          onPress={() => {
            setNovel(novelInfo);
            updateNovelInfo(novelInfo);
            hideModal();
          }}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default EditInfoModal;

// --- GenreChip with split styles ---
const getGenreChipContainer = (theme: ThemeColors) => ({
  backgroundColor: theme.secondaryContainer,
});
const getGenreChipText = (theme: ThemeColors) => ({
  color: theme.onSecondaryContainer,
});
const getGenreChipIcon = (theme: ThemeColors) => ({
  color: theme.onSecondaryContainer,
});

const GenreChip = ({
  children,
  theme,
  onPress,
}: {
  children: React.ReactNode;
  theme: ThemeColors;
  onPress: () => void;
}) => (
  <View style={[styles.genreChipContainer, getGenreChipContainer(theme)]}>
    <Text style={[styles.genreChipText, getGenreChipText(theme)]}>
      {children}
    </Text>
    <MaterialCommunityIcons
      name="close"
      size={18}
      onPress={onPress}
      style={styles.genreChipIcon}
      {...getGenreChipIcon(theme)}
    />
  </View>
);

const styles = StyleSheet.create({
  errorText: {
    color: '#FF0033',
    paddingTop: 8,
  },
  inputWrapper: {
    fontSize: 14,
    marginBottom: 12,
  },
  formContent: {
    paddingHorizontal: 24,
  },
  statusRow: {
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusScrollView: {
    marginLeft: 8,
  },
  statusChipContainer: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  statusChipPressable: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  genreList: {
    marginVertical: 8,
  },
  genreChipContainer: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginBottom: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genreChipText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  genreChipIcon: {
    marginLeft: 4,
  },
});
