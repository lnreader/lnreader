import { useTheme } from '@hooks/persisted';
import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LayoutRectangle,
  Modal as NativeModal,
  Pressable,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const HORIZONTAL_MARGIN = 16;
const VERTICAL_MARGIN = 8;
const ANCHOR_GAP = 4;
const MAX_MENU_WIDTH = 280;
const MAX_MENU_HEIGHT_RATIO = 0.6;
const ENTER_DURATION = 150;
const EXIT_DURATION = 75;

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

  const [menuLayout, setMenuLayout] = useState<LayoutRectangle | null>(null);
  const [anchorLayout, setAnchorLayout] = useState<LayoutRectangle>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const measureAnchor = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setAnchorLayout({ x, y, width, height });
    });
  }, []);

  useLayoutEffect(() => {
    if (visible) {
      measureAnchor();
    }
  }, [measureAnchor, screenHeight, screenWidth, visible]);

  const menuPosition = useMemo(() => {
    if (!menuLayout) return { opacity: 0 };
    const leftPos = Math.max(
      HORIZONTAL_MARGIN,
      Math.min(
        anchorLayout.x,
        screenWidth - menuLayout.width - HORIZONTAL_MARGIN,
      ),
    );

    let topPos = anchorLayout.y + anchorLayout.height + ANCHOR_GAP;

    const showAbove =
      topPos + menuLayout.height > screenHeight - VERTICAL_MARGIN;
    if (showAbove) {
      topPos = anchorLayout.y - menuLayout.height - ANCHOR_GAP;
    }
    topPos = Math.max(
      VERTICAL_MARGIN,
      Math.min(topPos, screenHeight - menuLayout.height - VERTICAL_MARGIN),
    );

    const maxWidth = fullWidth
      ? anchorLayout.width
      : Math.min(MAX_MENU_WIDTH, screenWidth - HORIZONTAL_MARGIN * 2);

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
        <NativeModal
          animationType="none"
          hardwareAccelerated
          navigationBarTranslucent
          onRequestClose={onDismiss}
          onShow={measureAnchor}
          presentationStyle="overFullScreen"
          statusBarTranslucent
          transparent
          visible
        >
          <View style={styles.modal}>
            <Pressable
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              onPress={onDismiss}
              style={StyleSheet.absoluteFill}
              testID="menu-backdrop"
            />
            <Animated.View
              accessibilityRole="menu"
              accessibilityViewIsModal
              entering={
                menuLayout ? FadeIn.duration(ENTER_DURATION) : undefined
              }
              exiting={menuLayout ? FadeOut.duration(EXIT_DURATION) : undefined}
              key={menuLayout ? 'ready' : 'measuring'}
              onLayout={event => setMenuLayout(event.nativeEvent.layout)}
              style={[
                styles.menuContainer,
                {
                  backgroundColor:
                    theme.surfaceContainerLow ??
                    theme.surface2 ??
                    theme.surface,
                },
                contentStyle,
                menuPosition,
              ]}
              testID="menu"
            >
              <ScrollView
                contentContainerStyle={styles.menuContent}
                style={{ maxHeight: screenHeight * MAX_MENU_HEIGHT_RATIO }}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </View>
        </NativeModal>
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
      accessibilityRole="menuitem"
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
  modal: {
    flex: 1,
  },
  menuContainer: {
    borderCurve: 'continuous',
    borderRadius: 4,
    elevation: 2,
    minWidth: 112,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 1,
  },
  menuContent: {
    paddingVertical: 8,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.1,
    lineHeight: 20,
  },
});

export default Menu;
