import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface ExpandableSectionProps extends PropsWithChildren {
  expanded: boolean;
}

/**
 * Smooth expand/collapse wrapper (NoveLA-style accordion). The content stays
 * mounted so nested input values are preserved while the section toggles.
 */
const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  children,
  expanded,
}) => {
  const [height, setHeight] = useState(0);
  const [animated] = useState(() => new Animated.Value(expanded ? 1 : 0));

  useEffect(() => {
    Animated.timing(animated, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [animated, expanded]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: animated.interpolate({
            inputRange: [0, 1],
            outputRange: [0, height],
          }),
          opacity: animated,
        },
      ]}
    >
      <View
        style={styles.content}
        onLayout={event => setHeight(event.nativeEvent.layout.height)}
        pointerEvents={expanded ? 'auto' : 'none'}
      >
        {children}
      </View>
    </Animated.View>
  );
};

export default ExpandableSection;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
});
