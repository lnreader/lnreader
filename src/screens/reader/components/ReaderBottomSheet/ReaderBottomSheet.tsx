import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Column } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { ComposeTabPager } from '@components';
import DisplayTab from '@screens/settings/SettingsReaderScreen/tabs/DisplayTab';
import NavigationTab from '@screens/settings/SettingsReaderScreen/tabs/NavigationTab';
import PaginationTab from '@screens/settings/SettingsReaderScreen/tabs/PaginationTab';
import AccessibilityTab from '@screens/settings/SettingsReaderScreen/tabs/AccessibilityTab';
import TTSTab from './TTSTab';

const routes = [
  { key: 'display', title: 'Display' },
  { key: 'navigation', title: 'Navigation' },
  { key: 'pagination', title: 'Pagination' },
  { key: 'accessibility', title: 'Accessibility' },
  { key: 'tts', title: 'TTS' },
];

// Share of the window the sheet takes when fully open. A fixed height keeps
// the tab row in place between tabs; the sheet opens half-way and each tab
// scrolls on its own.
const SHEET_HEIGHT = 0.85;

interface ReaderBottomSheetV2Props {
  /** Fill the available height (side panels) instead of a sheet's height. */
  fill?: boolean;
  bottomInset?: number;
}

const ReaderBottomSheetV2: React.FC<ReaderBottomSheetV2Props> = ({
  fill = false,
  bottomInset = 0,
}) => {
  const [index, setIndex] = useState(0);
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        fill ? weight(1) : height(Math.round(windowHeight * SHEET_HEIGHT)),
      ]}
    >
      {/* Pages mount on first visit – the TTS tab alone enumerates the
          device's engines and voices over the bridge. */}
      <ComposeTabPager
        tabs={routes.map((route, i) => ({ key: i, label: route.title }))}
        index={index}
        onIndexChange={setIndex}
        swipeEnabled={false}
        bottomInset={bottomInset}
        renderPage={page => {
          switch (routes[page].key) {
            case 'display':
              return <DisplayTab inReaderSheet />;
            case 'navigation':
              return <NavigationTab />;
            case 'pagination':
              return <PaginationTab />;
            case 'accessibility':
              return <AccessibilityTab />;
            default:
              return <TTSTab />;
          }
        }}
      />
    </Column>
  );
};

export default React.memo(ReaderBottomSheetV2);
