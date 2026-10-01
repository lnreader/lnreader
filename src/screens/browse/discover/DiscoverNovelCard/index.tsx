import React from 'react';
import { Card, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText, NovelCoverImage } from '@components';
import { ThemeColors } from '@theme/types';

interface Props {
  novel: {
    novelName: string;
    novelCover: string;
    score: string;
    info: string[];
  };
  onPress: () => void;
  theme: ThemeColors;
}

const Detail = ({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ThemeColors;
}) => (
  <Row>
    <AppText variant="bodySmall">{`${label}: `}</AppText>
    <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
      {value}
    </AppText>
  </Row>
);

const DiscoverNovelCard: React.FC<Props> = ({ novel, onPress, theme }) => {
  return (
    <Card
      colors={{
        containerColor: theme.surfaceContainerHigh,
        contentColor: theme.onSurface,
      }}
      modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}
    >
      <Row
        horizontalArrangement={{ spacedBy: 16 }}
        modifiers={[fillMaxWidth(), clickable(onPress)]}
      >
        <NovelCoverImage
          uri={novel.novelCover}
          width={100}
          height={150}
          corner={12}
          label={novel.novelName}
          theme={theme}
        />
        <Column
          verticalArrangement={{ spacedBy: 4 }}
          modifiers={[weight(1), padding(0, 16, 16, 16)]}
        >
          <AppText variant="titleMedium" maxLines={2}>
            {novel.novelName}
          </AppText>
          <Detail label="Score" value={novel.score} theme={theme} />
          {novel?.info?.[1] ? (
            <Detail label="Type" value={novel.info[1]} theme={theme} />
          ) : null}
          {novel?.info?.[2] ? (
            <Detail label="Published" value={novel.info[2]} theme={theme} />
          ) : null}
        </Column>
      </Row>
    </Card>
  );
};

export default DiscoverNovelCard;
