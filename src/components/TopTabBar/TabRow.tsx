import { Box, Column, HorizontalDivider, Row } from '@expo/ui/jetpack-compose';
import {
  animated,
  background,
  clickable,
  clip,
  fillMaxWidth,
  graphicsLayer,
  height,
  matchParentSize,
  padding,
  Shapes,
  tween,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import AppText from '../AppText/AppText';
import type { TopTab } from './TopTabBar';

const TAB_HEIGHT = 48;

const INDICATOR_HEIGHT = 3;

/**
 * Material 3's primary tab row for a few tabs that always fit: equal widths,
 * the indicator under the selected label.
 */
function TabRow<K extends string | number>({
  tabs,
  selectedKey,
  onSelect,
  showCounts,
}: {
  tabs: readonly TopTab<K>[];
  selectedKey: K;
  onSelect: (key: K) => void;
  showCounts?: boolean;
}) {
  const theme = useTheme();
  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Row modifiers={[fillMaxWidth()]}>
        {tabs.map(tab => {
          const selected = tab.key === selectedKey;
          return (
            <Box
              key={String(tab.key)}
              contentAlignment="bottomCenter"
              modifiers={[
                weight(1),
                height(TAB_HEIGHT),
                clickable(() => onSelect(tab.key)),
              ]}
            >
              {/* The indicator spans the label, matched to its box. */}
              <Box>
                <AppText
                  variant="titleSmall"
                  weight="500"
                  maxLines={1}
                  color={selected ? theme.primary : theme.onSurfaceVariant}
                  modifiers={[padding(16, 0, 16, 14)]}
                >
                  {showCounts && tab.count !== undefined
                    ? `${tab.label}  ${tab.count}`
                    : tab.label}
                </AppText>
                <Box
                  contentAlignment="bottomCenter"
                  modifiers={[matchParentSize()]}
                >
                  <Box
                    modifiers={[
                      fillMaxWidth(),
                      padding(16, 0, 16, 0),
                      height(INDICATOR_HEIGHT),
                      graphicsLayer({
                        alpha: animated(
                          selected ? 1 : 0,
                          tween({ durationMillis: 150 }),
                        ),
                      }),
                      clip(Shapes.RoundedCorner(INDICATOR_HEIGHT)),
                      background(theme.primary),
                    ]}
                  />
                </Box>
              </Box>
            </Box>
          );
        })}
      </Row>
      <HorizontalDivider color={theme.outlineVariant} />
    </Column>
  );
}

export default TabRow;
