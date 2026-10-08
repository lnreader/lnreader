import { useCallback, type ReactNode, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { Box, Card, Column, LazyColumn, Row } from '@expo/ui/jetpack-compose';
import {
  background,
  clip,
  fillMaxHeight,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import { getDonutPalette } from './DonutChart';
import DonutChartWithLegend from './DonutChartWithLegend';
import {
  AppHost,
  AppText,
  GridRow,
  RNContent,
  useScreenInsets,
} from '@components';
import {
  MAX_CONTENT_WIDTH,
  useWindowLayout,
} from '@hooks/common/useWindowLayout';

export interface ChartEntry {
  key: string;
  value: number;
}

export const StatsCard = ({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) => {
  const theme = useTheme();
  return (
    <Card
      colors={{
        containerColor: theme.surfaceContainerLow,
        contentColor: theme.onSurface,
      }}
      modifiers={[fillMaxWidth()]}
    >
      <Column
        verticalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
      >
        {title || action ? (
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <AppText variant="titleMedium" modifiers={[weight(1)]}>
              {title ?? ''}
            </AppText>
            {action}
          </Row>
        ) : null}
        {children}
      </Column>
    </Card>
  );
};

export const MeterBar = ({
  value,
  max,
  color,
  barHeight = 8,
}: {
  value: number;
  max: number;
  color?: string;
  barHeight?: number;
}) => {
  const theme = useTheme();
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <Row
      modifiers={[
        fillMaxWidth(),
        height(barHeight),
        clip(Shapes.RoundedCorner(barHeight / 2)),
        background(theme.surfaceContainerHighest),
      ]}
    >
      {share > 0 ? (
        <Box
          modifiers={[
            weight(share),
            fillMaxHeight(),
            clip(Shapes.RoundedCorner(barHeight / 2)),
            background(color ?? theme.primary),
          ]}
        />
      ) : null}
      {share < 1 ? <Box modifiers={[weight(1 - share)]} /> : null}
    </Row>
  );
};

export const DistributionCard = ({
  title,
  entries,
  centerLabel,
  getLabel,
}: {
  title: string;
  entries: readonly ChartEntry[];
  centerLabel?: string;
  getLabel?: (key: string) => string;
}) => {
  const theme = useTheme();
  const shown = entries.filter(entry => entry.value > 0);
  if (!shown.length) {
    return null;
  }
  return (
    <StatsCard>
      <RNContent>
        <DonutChartWithLegend
          title={title}
          entries={shown}
          colors={getDonutPalette(
            shown.map(entry => entry.key),
            theme,
          )}
          theme={theme}
          centerLabel={centerLabel}
          getLabel={getLabel}
        />
      </RNContent>
    </StatsCard>
  );
};

export interface StatsRow {
  key: string;
  render: () => ReactElement;
}

/** Cards pair up side by side on wide screens. */
export const useCardRows = () => {
  const layout = useWindowLayout();
  const columns = layout.isCompact ? 1 : 2;
  return useCallback(
    (items: StatsRow[]): StatsRow[] =>
      columns === 1
        ? items
        : [
            {
              key: items.map(item => item.key).join('|'),
              render: () => (
                <GridRow
                  items={items}
                  columns={columns}
                  spacing={12}
                  keyExtractor={item => item.key}
                  renderCell={item => item.render()}
                />
              ),
            },
          ],
    [columns],
  );
};

export const StatsList = ({ rows }: { rows: StatsRow[] }) => {
  const layout = useWindowLayout();
  const { bottom } = useScreenInsets();
  const gutter = Math.max(
    16,
    Math.round((layout.width - MAX_CONTENT_WIDTH) / 2),
  );
  // One host for the whole list: the rows are few, and a host per row made
  // opening the screen stall while every row set up its own composition.
  return (
    <AppHost style={styles.fill}>
      <LazyColumn
        verticalArrangement={{ spacedBy: 12 }}
        contentPadding={{
          top: 8,
          bottom: bottom + 16,
          start: gutter,
          end: gutter,
        }}
        modifiers={[fillMaxSize()]}
      >
        {rows.map(row => (
          <Box key={row.key} modifiers={[fillMaxWidth()]}>
            {row.render()}
          </Box>
        ))}
      </LazyColumn>
    </AppHost>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
