import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';

import { IconButtonV2, NovelCoverImage, Checkbox } from '@components';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted';

import { History } from '@database/types';
import { HistoryScreenProps } from '@navigators/types';

import { useHistorySelectionContext } from '../../HistorySelectionContext';

interface HistoryCardProps {
  history: History;
  onRemove: (history: History) => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ history, onRemove }) => {
  const theme = useTheme();
  const { navigate } = useNavigation<HistoryScreenProps['navigation']>();

  const { selectedIdsSet, hasSelection, toggleSelection } =
    useHistorySelectionContext();
  const isSelected = selectedIdsSet.has(history.novelId);

  const handleLongPress = () => toggleSelection(history.novelId);

  const handlePress = () => {
    if (hasSelection) {
      handleLongPress();
      return;
    }
    navigate('ReaderStack', {
      screen: 'Chapter',
      params: {
        novel: {
          id: history.novelId,
          path: history.novelPath,
          name: history.novelName,
          pluginId: history.pluginId,
          cover: history.novelCover,
          inLibrary: history.inLibrary,
        },
        chapter: history,
      },
    });
  };

  return (
    <View>
      <Pressable
        style={[
          styles.row,
          isSelected && { backgroundColor: theme.rippleColor },
        ]}
        android_ripple={{ color: theme.rippleColor }}
        onLongPress={handleLongPress}
        onPress={handlePress}
      >
        <Pressable
          onPress={event => {
            event.stopPropagation();
            if (hasSelection) {
              handleLongPress();
              return;
            }
            navigate('ReaderStack', {
              screen: 'Novel',
              params: {
                name: history.novelName,
                path: history.novelPath,
                cover: history.novelCover,
                pluginId: history.pluginId,
                inLibrary: history.inLibrary,
              },
            });
          }}
        >
          <NovelCoverImage
            uri={history.novelCover}
            theme={theme}
            iconSize={24}
            style={styles.cover}
          />
        </Pressable>
        <View style={styles.detailsContainer}>
          <Text
            numberOfLines={2}
            style={[{ color: theme.onSurface }, styles.novelName]}
          >
            {history.novelName}
          </Text>
          <Text style={{ color: theme.onSurfaceVariant }}>
            {`${getString('historyScreen.chapter')} ${
              history.chapterNumber
            } • ${dayjs(history.readTime).format('LT').toUpperCase()}` +
              `${
                history.progress && history.progress > 0
                  ? ' • ' + history.progress + '%'
                  : ''
              }`}
          </Text>
        </View>
        {hasSelection ? (
          <View style={styles.buttonContainer}>
            <Checkbox
              label=""
              status={isSelected}
              theme={theme}
              viewStyle={{ paddingHorizontal: 0 }}
            />
          </View>
        ) : (
          <>
            <View style={styles.buttonSpacer} />
            <View style={styles.buttonContainer}>
              <IconButtonV2
                accessibilityLabel={getString('common.remove')}
                name="delete-outline"
                theme={theme}
                onPress={() => onRemove(history)}
              />
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
};

export default HistoryCard;

const styles = StyleSheet.create({
  buttonContainer: {
    bottom: 8,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 8,
  },
  buttonSpacer: {
    width: 40,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cover: {
    borderRadius: 4,
    height: 80,
    width: 56,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
    marginStart: 16,
    minHeight: 80,
  },
  novelName: {
    marginBottom: 4,
  },
});
