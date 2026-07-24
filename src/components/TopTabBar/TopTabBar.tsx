import { StyleSheet } from 'react-native';
import { TabBar, type Route, type TabBarProps } from 'react-native-tab-view';

const TopTabBar = <T extends Route>({
  indicatorStyle,
  ...props
}: TabBarProps<T>) => (
  <TabBar
    {...props}
    indicatorStyle={[styles.primaryIndicator, indicatorStyle]}
  />
);

const styles = StyleSheet.create({
  primaryIndicator: {
    width: '60%',
    height: 3,
    marginHorizontal: 'auto',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
});

export default TopTabBar;
