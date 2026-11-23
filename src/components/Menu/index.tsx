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
  type HostInstance,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAvailableMenuWidth, getMenuPosition } from './layout';

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

// Everything that subscribes to window, inset or theme changes lives in the
// popup, which only mounts while the menu is open. Closed menus sit in list
// rows (e.g. every downloaded chapter), so they should cost no more than the
// anchor itself.
const Menu: React.FC<MenuProps> & { Item: React.FC<MenuItemProps> } = ({
  visible,
  onDismiss,
  anchor,
  contentStyle,
  children,
  fullWidth,
}) => {
  const anchorRef = useRef<HostInstance>(null);

  return (
    <>
      <View ref={anchorRef} collapsable={false}>
        {anchor}
      </View>

      {visible && (
        <MenuPopup
          anchorRef={anchorRef}
          onDismiss={onDismiss}
          contentStyle={contentStyle}
          fullWidth={fullWidth}
        >
          {children}
        </MenuPopup>
      )}
    </>
  );
};

interface MenuPopupProps extends Omit<MenuProps, 'visible' | 'anchor'> {
  anchorRef: React.RefObject<HostInstance | null>;
}

const MenuPopup = ({
  anchorRef,
  onDismiss,
  contentStyle,
  children,
  fullWidth,
}: MenuPopupProps) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

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
  }, [anchorRef]);

  useLayoutEffect(() => {
    measureAnchor();
  }, [measureAnchor, screenHeight, screenWidth]);

  const menuPosition = useMemo(() => {
    if (!menuLayout) return { opacity: 0 };
    const { left, top } = getMenuPosition({
      anchor: anchorLayout,
      insets,
      menu: menuLayout,
      screen: { height: screenHeight, width: screenWidth },
    });

    const maxWidth = Math.min(
      fullWidth ? anchorLayout.width : MAX_MENU_WIDTH,
      getAvailableMenuWidth(screenWidth, insets),
    );

    const position = {
      left,
      top,
      shadowColor: theme.isDark ? '#000' : theme.shadow,
    };
    return fullWidth
      ? { ...position, width: maxWidth }
      : { ...position, maxWidth };
  }, [
    anchorLayout,
    fullWidth,
    insets,
    menuLayout,
    screenHeight,
    screenWidth,
    theme.isDark,
    theme.shadow,
  ]);

  return (
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
          entering={menuLayout ? FadeIn.duration(ENTER_DURATION) : undefined}
          exiting={menuLayout ? FadeOut.duration(EXIT_DURATION) : undefined}
          key={menuLayout ? 'ready' : 'measuring'}
          onLayout={event => setMenuLayout(event.nativeEvent.layout)}
          style={[
            styles.menuContainer,
            {
              backgroundColor:
                theme.surfaceContainerLow ?? theme.surface2 ?? theme.surface,
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
