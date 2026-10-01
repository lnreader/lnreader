import React from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText } from '@components';
import { useTheme } from '@hooks/persisted/useTheme';
import { MeterBar } from '@screens/StatsScreen/components/StatsCard';

interface GenreRowProps {
  name: string;
  count: number;
  maxCount: number; // global max across all genres
}

const GenreRow: React.FC<GenreRowProps> = ({ name, count, maxCount }) => {
  const theme = useTheme();
  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
    >
      <AppText variant="bodyMedium" maxLines={1} modifiers={[weight(0.4)]}>
        {name}
      </AppText>
      <Column modifiers={[weight(0.6)]}>
        <MeterBar value={count} max={maxCount} />
      </Column>
      <AppText variant="labelMedium" color={theme.onSurfaceVariant}>
        {String(count)}
      </AppText>
    </Row>
  );
};

export default GenreRow;
