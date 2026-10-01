import { Fragment } from 'react';
import {
  Badge,
  BadgedBox,
  Box,
  Column,
  HorizontalDivider,
  NavigationBar,
  NavigationBarItem,
  Surface,
} from '@expo/ui/jetpack-compose';
import {
  background,
  clickable,
  clip,
  fillMaxHeight,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  verticalScroll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@hooks/persisted/useTheme';
import AppHost from '../AppHost/AppHost';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

export interface NavDestination {
  key: string;
  label: string;
  icon: IconSource;
  badge?: string;
  groupStart?: boolean;
}

interface NavigationSuiteProps {
  destinations: readonly NavDestination[];
  selectedKey: string;
  onSelect: (key: string) => void;
  showLabels: boolean;
}

export const NAVIGATION_BAR_HEIGHT = 80;
export const NAVIGATION_RAIL_WIDTH = 88;

// Rail item: 6 + 32 (indicator) + 4 + 16 (label) + 6.
const RAIL_ITEM_HEIGHT = 64;
const RAIL_PADDING = 24;
const RAIL_DIVIDER_HEIGHT = 17;
const railSpacing = (count: number) => (count > 5 ? 4 : 12);

export const railHeightFor = (count: number, groups = 1) =>
  RAIL_PADDING * 2 +
  count * RAIL_ITEM_HEIGHT +
  (count - 1) * railSpacing(count) +
  (groups - 1) * RAIL_DIVIDER_HEIGHT;

const DestinationIcon = ({
  destination,
  selected,
}: {
  destination: NavDestination;
  selected: boolean;
}) => {
  const theme = useTheme();
  const icon = <AppIcon source={destination.icon} />;
  if (!destination.badge) {
    return icon;
  }
  return (
    <BadgedBox>
      <BadgedBox.Badge>
        <Badge containerColor={theme.error} contentColor={theme.onError}>
          <AppText variant="labelSmall" color={theme.onError}>
            {destination.badge}
          </AppText>
        </Badge>
      </BadgedBox.Badge>
      {icon}
    </BadgedBox>
  );
};

export const AppNavigationBar = ({
  destinations,
  selectedKey,
  onSelect,
  showLabels,
}: NavigationSuiteProps) => {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <AppHost style={{ height: NAVIGATION_BAR_HEIGHT + bottom }}>
      <NavigationBar
        containerColor={theme.surfaceContainer}
        contentColor={theme.onSurface}
        modifiers={[fillMaxWidth()]}
      >
        {destinations.map(destination => {
          const selected = destination.key === selectedKey;
          return (
            <NavigationBarItem
              key={destination.key}
              selected={selected}
              alwaysShowLabel={showLabels}
              onClick={() => onSelect(destination.key)}
              colors={{
                selectedIconColor: theme.onSecondaryContainer,
                selectedTextColor: theme.onSurface,
                selectedIndicatorColor: theme.secondaryContainer,
                unselectedIconColor: theme.onSurfaceVariant,
                unselectedTextColor: theme.onSurfaceVariant,
              }}
            >
              <NavigationBarItem.Icon>
                <DestinationIcon
                  destination={destination}
                  selected={selected}
                />
              </NavigationBarItem.Icon>
              <NavigationBarItem.Label>
                <AppText variant="labelMedium" maxLines={1}>
                  {destination.label}
                </AppText>
              </NavigationBarItem.Label>
            </NavigationBarItem>
          );
        })}
      </NavigationBar>
    </AppHost>
  );
};

const RailItem = ({
  destination,
  selected,
  showLabel,
  onPress,
}: {
  destination: NavDestination;
  selected: boolean;
  showLabel: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Column
      horizontalAlignment="center"
      verticalArrangement={{ spacedBy: 4 }}
      modifiers={[
        width(NAVIGATION_RAIL_WIDTH),
        padding(0, 6, 0, 6),
        clickable(onPress, { indication: false }),
      ]}
    >
      <Box
        contentAlignment="center"
        modifiers={[
          size(56, 32),
          clip(Shapes.RoundedCorner(16)),
          background(selected ? theme.secondaryContainer : 'transparent'),
        ]}
      >
        <Surface
          color="transparent"
          contentColor={
            selected ? theme.onSecondaryContainer : theme.onSurfaceVariant
          }
        >
          <DestinationIcon destination={destination} selected={selected} />
        </Surface>
      </Box>
      {showLabel || selected ? (
        <AppText
          variant="labelMedium"
          weight={selected ? '700' : undefined}
          color={selected ? theme.onSurface : theme.onSurfaceVariant}
          maxLines={1}
        >
          {destination.label}
        </AppText>
      ) : null}
    </Column>
  );
};

export const AppNavigationRail = ({
  destinations,
  selectedKey,
  onSelect,
  showLabels,
}: NavigationSuiteProps) => {
  const theme = useTheme();
  const { top, bottom, left } = useSafeAreaInsets();
  return (
    <AppHost style={[styles.rail, { width: NAVIGATION_RAIL_WIDTH + left }]}>
      <Column
        verticalArrangement={{ spacedBy: railSpacing(destinations.length) }}
        horizontalAlignment="center"
        modifiers={[
          fillMaxHeight(),
          width(NAVIGATION_RAIL_WIDTH + left),
          background(theme.surfaceContainer),
          // Scrolls only when the window is too short for every item.
          verticalScroll(),
          padding(left, top + RAIL_PADDING, 0, bottom + RAIL_PADDING),
        ]}
      >
        {destinations.map(destination => (
          <Fragment key={destination.key}>
            {destination.groupStart ? (
              <HorizontalDivider
                color={theme.outlineVariant}
                modifiers={[width(56), padding(0, 8, 0, 8)]}
              />
            ) : null}
            <RailItem
              destination={destination}
              selected={destination.key === selectedKey}
              showLabel={showLabels}
              onPress={() => onSelect(destination.key)}
            />
          </Fragment>
        ))}
      </Column>
    </AppHost>
  );
};

const styles = StyleSheet.create({
  rail: { height: '100%' },
});
