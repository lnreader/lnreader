import { useTheme } from '@hooks/persisted';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, Dimensions } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { width: screenWidth } = Dimensions.get('window');

interface MenuProps {
  visible: boolean;
  onDismiss: () => void;
  anchor: React.ReactNode;
  contentStyle?: any;
  children: React.ReactNode;
}

interface MenuItemProps {
  title: string;
  onPress: () => void;
  style?: any;
  titleStyle?: any;
}

const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  contentStyle,
  children,
}) => {
  const theme = useTheme();
  const anchorRef = useRef<View>(null);
  const [anchorLayout, setAnchorLayout] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [isMeasured, setIsMeasured] = useState(false);

  const menuAnimatedStyle = useAnimatedStyle(() => ({
    shadowColor: theme.isDark ? '#000' : theme.shadow,
    position: 'absolute' as const,
    left: Math.max(16, Math.min(anchorLayout.x, screenWidth - 220)),
    top: anchorLayout.y + anchorLayout.height + 8,
    width: Math.min(200, screenWidth - 32),
    zIndex: 1001,
  }));

  // Create entering animations
  const backdropEntering = FadeIn.duration(150);
  const menuEntering = FadeInUp.duration(150)
    .springify()
    .damping(30)
    .stiffness(500)
    .mass(0.3)
    .withInitialValues({
      transform: [{ translateY: -10 }],
    });

  // Create exiting animations
  const backdropExiting = FadeOut.duration(150);
  const menuExiting = FadeOutUp.duration(150)
    .springify()
    .damping(30)
    .stiffness(500)
    .mass(0.3);

  const measureAnchor = React.useCallback(() => {
    if (anchorRef.current) {
      anchorRef.current.measure((x, y, width, height, pageX, pageY) => {
        setAnchorLayout({ x: pageX, y: pageY, width, height });
        setIsMeasured(true);
      });
    }
  }, []);

  // Measure anchor on mount
  useEffect(() => {
    setTimeout(measureAnchor, 0);
  }, [measureAnchor]);

  if (!visible) {
    return (
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
        {anchor}
      </View>
    );
  }

  return (
    <>
      <View ref={anchorRef} collapsable={false} onLayout={measureAnchor}>
        {anchor}
      </View>

      {visible && isMeasured && (
        <Portal>
          {/* Backdrop */}
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss}>
            <Animated.View
              style={[
                styles.backdrop,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(0, 0, 0, 0.2)'
                    : 'rgba(0, 0, 0, 0.1)',
                },
              ]}
              entering={backdropEntering}
              exiting={backdropExiting}
            />
          </Pressable>

          {/* Menu */}
          <Animated.View
            style={[
              styles.menuContainer,
              menuAnimatedStyle,
              { backgroundColor: theme.surface },
              contentStyle,
            ]}
            entering={menuEntering}
            exiting={menuExiting}
          >
            {children}
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
        style={[
          styles.menuItemText,
          {
            color: theme.onSurface,
          },
          titleStyle,
        ]}
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
  },
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
