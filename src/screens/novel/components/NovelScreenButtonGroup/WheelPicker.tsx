import { useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ThemeColors } from '@theme/types';

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 3;

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  theme: ThemeColors;
}

/** A snapping list with the selected item in the middle row. Rows can also be tapped. */
const WheelPicker = ({
  items,
  selectedIndex,
  onChange,
  theme,
}: WheelPickerProps) => {
  const scrollRef = useRef<ScrollView>(null);

  const onScrollEnd = ({
    nativeEvent,
  }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.min(Math.max(index, 0), items.length - 1);
    if (clamped !== selectedIndex) onChange(clamped);
  };

  const select = (index: number) => {
    scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
    onChange(index);
  };

  return (
    <View style={styles.container}>
      <View
        pointerEvents="none"
        style={[styles.highlight, { borderColor: theme.outlineVariant }]}
      />
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: selectedIndex * ITEM_HEIGHT }}
        contentContainerStyle={styles.content}
        onMomentumScrollEnd={onScrollEnd}
      >
        {items.map((item, index) => {
          const selected = index === selectedIndex;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => select(index)}
              style={styles.item}
            >
              <Text
                style={[
                  styles.label,
                  selected
                    ? { color: theme.onSurface, fontWeight: '600' }
                    : { color: theme.onSurfaceVariant },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default WheelPicker;

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    width: '50%',
  },
  content: {
    paddingVertical: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
  },
  highlight: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    height: ITEM_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: ITEM_HEIGHT * Math.floor(VISIBLE_ITEMS / 2),
  },
  item: {
    alignItems: 'center',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  label: {
    fontSize: 18,
  },
});
