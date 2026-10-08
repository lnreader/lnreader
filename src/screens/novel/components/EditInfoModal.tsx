import { useMemo, useState } from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  background,
  fillMaxWidth,
  horizontalScroll,
  padding,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';

import { updateNovelInfo } from '@database/queries/NovelQueries';

import { getString } from '@i18n/translations';
import { AppText, Chip, Dialog, TextInput } from '@components';
import { ThemeColors } from '@theme/types';
import { NovelInfo } from '@database/types';
import { NovelStatus } from '@plugins/types';
import { translateNovelStatus } from '@utils/translateEnum';
import { showToast } from '@utils/showToast';
import { parseGenres } from '../utils/genres';

interface EditInfoModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  setNovel: (novel: NovelInfo | undefined) => void;
}

// --- Main Component ---
type EditInfoModalContentProps = Omit<EditInfoModalProps, 'modalVisible'>;

const EditInfoModalContent = ({
  theme,
  hideModal,
  novel,
  setNovel,
}: EditInfoModalContentProps) => {
  const [novelInfo, setNovelInfo] = useState(novel);
  const [saving, setSaving] = useState(false);

  const [newGenre, setNewGenre] = useState('');
  const genres = useMemo(
    () => parseGenres(novelInfo.genres),
    [novelInfo.genres],
  );

  const removeTag = (t: string) => {
    setNovelInfo(current => ({
      ...current,
      genres: parseGenres(current.genres)
        .filter(item => item !== t)
        .join(','),
    }));
  };

  const status = Object.values(NovelStatus);
  const persistNovelInfo = async (nextNovel: NovelInfo, dismiss: boolean) => {
    setSaving(true);
    try {
      await updateNovelInfo(nextNovel);
      setNovel(nextNovel);
      if (dismiss) {
        hideModal();
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root visible onDismiss={() => !saving && hideModal()}>
      <Dialog.Title>{getString('novelScreen.edit.info')}</Dialog.Title>
      <Dialog.ScrollArea>
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
        >
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <AppText color={theme.onSurfaceVariant}>
              {getString('novelScreen.edit.status')}
            </AppText>
            <Row modifiers={[padding(8, 0, 0, 0), horizontalScroll()]}>
              {status.map((item, index) => (
                <AppText
                  key={'novelInfo' + index}
                  color={
                    novelInfo.status === item
                      ? theme.primary
                      : theme.onSurfaceVariant
                  }
                  modifiers={[
                    clip(Shapes.RoundedCorner(8)),
                    background(
                      novelInfo.status === item
                        ? theme.rippleColor ?? theme.secondaryContainer
                        : 'transparent',
                    ),
                    clickable(() =>
                      setNovelInfo(current => ({ ...current, status: item })),
                    ),
                    padding(12, 6, 12, 6),
                  ]}
                >
                  {translateNovelStatus(item)}
                </AppText>
              ))}
            </Row>
          </Row>
          <TextInput
            value={novelInfo.name}
            placeholder={getString('novelScreen.edit.title', {
              title: novel.name,
            })}
            outlined
            onChangeText={name =>
              setNovelInfo(current => ({ ...current, name }))
            }
          />
          <TextInput
            value={novelInfo.author ?? ''}
            placeholder={getString('novelScreen.edit.author', {
              author: novel.author,
            })}
            outlined
            onChangeText={author =>
              setNovelInfo(current => ({ ...current, author }))
            }
          />
          <TextInput
            value={novelInfo.artist ?? ''}
            placeholder={'Artist: ' + novel.artist}
            outlined
            onChangeText={artist =>
              setNovelInfo(current => ({ ...current, artist }))
            }
          />
          <TextInput
            value={novelInfo.summary ?? ''}
            placeholder={getString('novelScreen.edit.summary', {
              summary: novel.summary?.substring(0, 16),
            })}
            outlined
            onChangeText={summary =>
              setNovelInfo(current => ({ ...current, summary }))
            }
          />

          <TextInput
            value={newGenre}
            placeholder={getString('novelScreen.edit.addTag')}
            outlined
            onChangeText={text => setNewGenre(text)}
            onSubmit={() => {
              const newGenreTrimmed = newGenre.trim();

              if (newGenreTrimmed === '') {
                return;
              }

              setNovelInfo(prevVal => ({
                ...prevVal,
                genres: [...parseGenres(prevVal.genres), newGenreTrimmed].join(
                  ',',
                ),
              }));
              setNewGenre('');
            }}
          />

          {genres.length > 0 ? (
            <Row
              horizontalArrangement={{ spacedBy: 8 }}
              modifiers={[fillMaxWidth(), horizontalScroll()]}
            >
              {genres.map((item, index) => (
                <Chip
                  key={'novelTag' + index}
                  kind="input"
                  label={item}
                  onPress={() => removeTag(item)}
                  theme={theme}
                />
              ))}
            </Row>
          ) : null}
        </Column>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          disabled={saving}
          onPress={() => {
            setNovelInfo(novel);
            void persistNovelInfo(novel, false);
          }}
        >
          {getString('common.reset')}
        </Dialog.Action>
        <Dialog.Action
          title={getString('common.cancel')}
          disabled={saving}
          onPress={hideModal}
        />
        <Dialog.Action
          disabled={saving}
          onPress={() => {
            void persistNovelInfo(novelInfo, true);
          }}
        >
          {getString('common.save')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

const EditInfoModal = ({ modalVisible, ...props }: EditInfoModalProps) =>
  modalVisible ? <EditInfoModalContent {...props} /> : null;

export default EditInfoModal;
