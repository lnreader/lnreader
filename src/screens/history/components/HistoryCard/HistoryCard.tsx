import React from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  defaultMinSize,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';

import { AppText, IconButtonV2, NovelCoverImage } from '@components';
import { getString } from '@i18n/translations';
import { useTheme } from '@hooks/persisted';

import { History } from '@database/types';
import { HistoryScreenProps } from '@navigators/types';
import DeleteIcon from '@expo/material-symbols/delete.xml';

interface HistoryCardProps {
  history: History;
  onRemove: (history: History) => void;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ history, onRemove }) => {
  const theme = useTheme();
  const { navigate } = useNavigation<HistoryScreenProps['navigation']>();

  return (
    <Row
      verticalAlignment="center"
      modifiers={[
        fillMaxWidth(),
        clickable(() =>
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
          }),
        ),
        padding(16, 8, 16, 8),
      ]}
    >
      <Box
        modifiers={[
          clickable(() =>
            navigate('ReaderStack', {
              screen: 'Novel',
              params: {
                name: history.novelName,
                path: history.novelPath,
                cover: history.novelCover,
                pluginId: history.pluginId,
                inLibrary: history.inLibrary,
              },
            }),
          ),
        ]}
      >
        <NovelCoverImage
          uri={history.novelCover}
          width={56}
          height={80}
          corner={4}
          theme={theme}
        />
      </Box>
      <Column
        verticalArrangement="center"
        modifiers={[
          weight(1),
          padding(16, 0, 0, 0),
          defaultMinSize({ minHeight: 80 }),
        ]}
      >
        <AppText
          maxLines={2}
          color={theme.onSurface}
          modifiers={[padding(0, 0, 0, 4)]}
        >
          {history.novelName}
        </AppText>
        <AppText color={theme.onSurfaceVariant}>
          {`${getString('historyScreen.chapter')} ${
            history.chapterNumber
          } • ${dayjs(history.readTime).format('LT').toUpperCase()}` +
            `${
              history.progress && history.progress > 0
                ? ' • ' + history.progress + '%'
                : ''
            }`}
        </AppText>
      </Column>
      <IconButtonV2
        accessibilityLabel={getString('common.remove')}
        name={DeleteIcon}
        onPress={() => onRemove(history)}
        theme={theme}
      />
    </Row>
  );
};

export default HistoryCard;
