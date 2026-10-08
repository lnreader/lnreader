import { type ReactNode } from 'react';
import { Box, Row, Spacer } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';
import { uniqueKeys } from '@utils/uniqueKeys';

export const chunk = <T,>(items: readonly T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
};

export interface GridRowProps<T> {
  items: readonly T[];
  columns: number;
  spacing: number;
  renderCell: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
}

export function GridRow<T>({
  items,
  columns,
  spacing,
  renderCell,
  keyExtractor,
}: GridRowProps<T>) {
  const cellKeys = uniqueKeys(items, item => keyExtractor(item));
  return (
    <Row
      horizontalArrangement={{ spacedBy: spacing }}
      modifiers={[fillMaxWidth()]}
    >
      {items.map((item, index) => (
        <Box key={cellKeys[index]} modifiers={[weight(1)]}>
          {renderCell(item)}
        </Box>
      ))}
      {Array.from({ length: columns - items.length }, (_, i) => (
        <Spacer key={`pad-${i}`} modifiers={[weight(1)]} />
      ))}
    </Row>
  );
}
