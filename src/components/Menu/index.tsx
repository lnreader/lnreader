import { useTheme } from '@hooks/persisted';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  StyleProp,
  ViewStyle,
  TextStyle,
  LayoutRectangle,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Portal } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeOut,
  withTiming,
  ExitAnimationsValues,
  EntryAnimationsValues,
  withDelay,
} from 'react-native-reanimated';

interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  fullWidth?: boolean; // Full width of the anchor
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
}

const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  contentStyle,
  children,
  fullWidth,
}) => {
  const theme = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const anchorRef = useRef<View>(null);
  const duration = 250;

  const [menuLayout, setMenuLayout] = useState<LayoutRectangle | null>(null);
  const [anchorLayout, setAnchorLayout] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const backdropEntering = FadeIn.duration(duration);
  const menuEntering = (values: EntryAnimationsValues) => {
    'worklet';
    const animations = {
      height: withTiming(values.targetHeight, { duration }),
      opacity: withTiming(1, { duration: duration - 100 }),
    };
    const initialValues = {
      height: 0,
      opacity: 0,
    };
    return {
      initialValues,
      animations,
    };
  };

  const backdropExiting = FadeOut.duration(duration);
  const menuExiting = (values: ExitAnimationsValues) => {
    'worklet';
    const initialValues = {
      height: values.currentHeight,
      opacity: 1,
    };
    const animations = {
      height: withTiming(0, { duration }),
      opacity: withDelay(100, withTiming(0, { duration: duration - 100 })),
    };
    return {
      initialValues,
      animations,
    };
  };
  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorLayout({ x, y, width, height });
    });
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      measureAnchor();
    } else {
      setMenuLayout(null); // Reset layout when closed
    }
  }, [measureAnchor, visible]);

  const menuPosition = useMemo(() => {
    if (!menuLayout) return { opacity: 0 };
    const leftPos = Math.max(
      16,
      Math.min(anchorLayout.x, screenWidth - menuLayout.width - 16),
    );

    let topPos = anchorLayout.y + anchorLayout.height + 24;

    const showAbove = topPos + menuLayout.height > screenHeight;
    if (showAbove) {
      topPos -= anchorLayout.height + menuLayout.height;
    }

    const maxWidth = fullWidth
      ? anchorLayout.width
      : Math.min(250, screenWidth - 32);

    return {
      left: leftPos,
      top: topPos,
      shadowColor: theme.isDark ? '#000' : theme.shadow,
      [fullWidth ? 'width' : 'maxWidth']: maxWidth,
    };
  }, [
    anchorLayout.height,
    anchorLayout.width,
    anchorLayout.x,
    anchorLayout.y,
    fullWidth,
    menuLayout,
    screenHeight,
    screenWidth,
    theme.isDark,
    theme.shadow,
  ]);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {anchor}
      </View>

      {visible && (
        <Portal>
          {/* Backdrop */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss}>
            <Animated.View
              style={[
                styles.backdrop,
                theme.isDark ? styles.backdropDark : styles.backdropLight,
              ]}
              entering={backdropEntering}
              exiting={backdropExiting}
            />
          </Pressable>

          {/* Menu */}
          <Animated.View
            key={menuLayout ? 'ready' : 'measuring'}
            style={[
              styles.menuContainer,
              { backgroundColor: theme.surface },
              contentStyle,
              menuPosition,
            ]}
            onLayout={e => {
              setMenuLayout(e.nativeEvent.layout);
            }}
            entering={menuLayout ? menuEntering : undefined}
            exiting={menuLayout ? menuExiting : undefined}
          >
            <ScrollView style={{ maxHeight: screenHeight * 0.6 }}>
              {children}
            </ScrollView>
          </Animated.View>
        </Portal>
      )}
    </>
  );
};

const MenuItem: React.FC<MenuItemProps> = ({
  title,
  onPress,
  style,
  titleStyle,
}) => {
  const theme = useTheme();

  return (
    <Pressable
      style={[styles.menuItem, style]}
      onPress={onPress}
      android_ripple={{ color: theme.rippleColor, foreground: true }}
    >
      <Animated.Text
        style={[styles.menuItemText, { color: theme.onSurface }, titleStyle]}
      >
        {title}
      </Animated.Text>
    </Pressable>
  );
};

Menu.Item = MenuItem;

const styles = StyleSheet.create({
  menuContainer: {
    borderRadius: 8,
    elevation: 8,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 1001,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  backdropDark: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  backdropLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '400',
  },
});

export default Menu;
