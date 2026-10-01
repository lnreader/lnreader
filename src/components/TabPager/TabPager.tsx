import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Column,
  HorizontalPager,
  RNHostView,
  type HorizontalPagerHandle,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import AppHost from '../AppHost/AppHost';
import TopTabBar, { type TopTab } from '../TopTabBar/TopTabBar';
import TabRow from '../TopTabBar/TabRow';

export interface TabPagerProps {
  tabs: readonly TopTab<number>[];
  index: number;
  onIndexChange: (index: number) => void;
  /** Content for the page at `index`, mounted on first visit. */
  renderPage: (index: number) => ReactNode;
  showCounts?: boolean;
  swipeEnabled?: boolean;
  /** Material's fixed tab row instead of chips, for a few tabs that fit. */
  fixed?: boolean;
}

type PagerProps = TabPagerProps & {
  wrapPage: (content: ReactNode, key: number) => ReactNode;
};

const Pager = ({
  tabs,
  index,
  onIndexChange,
  renderPage,
  showCounts,
  swipeEnabled = true,
  fixed = false,
  wrapPage,
}: PagerProps) => {
  const pager = useRef<HorizontalPagerHandle>(null);
  const pagerIndex = useRef(index);
  const [visited, setVisited] = useState<ReadonlySet<number>>(
    () => new Set([index]),
  );

  const visit = (page: number) =>
    setVisited(pages => (pages.has(page) ? pages : new Set(pages).add(page)));
  if (!visited.has(index)) {
    setVisited(new Set(visited).add(index));
  }

  useEffect(() => {
    if (pagerIndex.current !== index) {
      pagerIndex.current = index;
      void pager.current?.animateScrollToPage(index);
    }
  }, [index]);

  const Bar = fixed ? TabRow : TopTabBar;
  return (
    <>
      {tabs.length ? (
        <Bar
          tabs={tabs}
          selectedKey={index}
          onSelect={onIndexChange}
          showCounts={showCounts}
        />
      ) : null}
      <HorizontalPager
        ref={pager}
        initialPage={index}
        userScrollEnabled={swipeEnabled}
        onCurrentPageChange={visit}
        onSettledPageChange={page => {
          if (pagerIndex.current !== page) {
            pagerIndex.current = page;
            onIndexChange(page);
          }
        }}
        modifiers={[fillMaxWidth(), weight(1)]}
      >
        {tabs.map((tab, page) =>
          wrapPage(visited.has(page) ? renderPage(page) : null, tab.key),
        )}
      </HorizontalPager>
    </>
  );
};

/** Pages of React Native content, filling the space it is given. */
const TabPager = (props: TabPagerProps) => (
  <AppHost style={styles.fill}>
    <Column modifiers={[fillMaxSize()]}>
      <Pager
        {...props}
        wrapPage={(content, key) => (
          <RNHostView key={key}>
            <View style={styles.fill}>{content}</View>
          </RNHostView>
        )}
      />
    </Column>
  </AppHost>
);

/**
 * Pages of Compose content inside a host, each scrolling on its own, so a
 * sheet keeps its height and its tab row between tabs.
 */
export const ComposeTabPager = ({
  bottomInset = 0,
  ...props
}: TabPagerProps & { bottomInset?: number }) => (
  <Pager
    {...props}
    wrapPage={(content, key) => (
      <Column
        key={key}
        modifiers={[
          fillMaxSize(),
          verticalScroll(),
          padding(0, 0, 0, bottomInset + 16),
        ]}
      >
        {content}
      </Column>
    )}
  />
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
});

export default TabPager;
