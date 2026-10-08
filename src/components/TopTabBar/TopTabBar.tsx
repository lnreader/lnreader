import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Box, RNHostView } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';
import Chip from '../Chip/Chip';
import AppHost from '../AppHost/AppHost';
import { useTheme } from '@hooks/persisted/useTheme';

export interface TopTab<K extends string | number> {
  key: K;
  label: string;
  count?: number;
}

/** A 32dp chip with the row's padding above and below it. */
const BAR_HEIGHT = 44;

/**
 * Chips in a React Native scroll view: Compose's scroll state can't be driven
 * from here, and a tab selected off screen (by swiping, say) is scrolled into
 * the middle of the row, like Material's scrollable tab row.
 */
function TopTabBar<K extends string | number>({
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
  const scroll = useRef<ScrollView>(null);
  const frames = useRef(new Map<K, { x: number; width: number }>());
  const [viewport, setViewport] = useState(0);
  const [laidOut, setLaidOut] = useState(0);

  useEffect(() => {
    const frame = frames.current.get(selectedKey);
    if (!frame || !viewport) {
      return;
    }
    scroll.current?.scrollTo({
      x: Math.max(0, frame.x + frame.width / 2 - viewport / 2),
      animated: true,
    });
  }, [selectedKey, viewport, laidOut]);

  return (
    // RNHostView fills whatever it is given, so a Box sets its size.
    <Box modifiers={[fillMaxWidth(), height(BAR_HEIGHT)]}>
      <RNHostView>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={event => setViewport(event.nativeEvent.layout.width)}
          contentContainerStyle={styles.content}
        >
          {tabs.map(tab => (
            <View
              key={String(tab.key)}
              onLayout={event => {
                const { x, width } = event.nativeEvent.layout;
                frames.current.set(tab.key, { x, width });
                if (tab.key === selectedKey) {
                  setLaidOut(count => count + 1);
                }
              }}
            >
              <AppHost matchContents>
                <Chip
                  label={
                    showCounts && tab.count !== undefined
                      ? `${tab.label}  ${tab.count}`
                      : tab.label
                  }
                  selected={tab.key === selectedKey}
                  onPress={() => onSelect(tab.key)}
                  theme={theme}
                />
              </AppHost>
            </View>
          ))}
        </ScrollView>
      </RNHostView>
    </Box>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
});

export default TopTabBar;
