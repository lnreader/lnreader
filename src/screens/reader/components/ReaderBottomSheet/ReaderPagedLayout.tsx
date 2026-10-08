import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { List, SegmentedControl } from '@components';
import {
  useChapterGeneralSettings,
  useChapterReaderSettings,
  useTheme,
} from '@hooks/persisted';
import type {
  PageAnimation,
  ReaderColumns,
} from '@hooks/persisted/useSettings';
import { getString } from '@i18n/translations';

const columnOptions: { value: ReaderColumns; label: () => string }[] = [
  { value: 'auto', label: () => getString('readerSettings.columnsAuto') },
  { value: 1, label: () => getString('readerSettings.columnsOne') },
  { value: 2, label: () => getString('readerSettings.columnsTwo') },
];

const pageAnimationOptions: {
  value: PageAnimation;
  label: () => string;
}[] = [
  { value: 'push', label: () => getString('readerSettings.animationPush') },
  { value: 'slide', label: () => getString('readerSettings.animationSlide') },
  { value: 'curl', label: () => getString('readerSettings.animationCurl') },
];

/** Page layout options of the paginated renderer. */
const ReaderPagedLayout = () => {
  const theme = useTheme();
  const { columns = 'auto', setChapterReaderSettings } =
    useChapterReaderSettings();
  const {
    pageReaderDisableAnimation,
    pageAnimation = 'push',
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();
  return (
    <>
      <List.SubHeader theme={theme}>
        {getString('readerSettings.columns')}
      </List.SubHeader>
      <SegmentedControl
        options={columnOptions.map(item => ({
          value: item.value,
          label: item.label(),
        }))}
        value={columns}
        onChange={value => setChapterReaderSettings({ columns: value })}
        modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
        theme={theme}
      />
      <List.InfoItem
        title={getString('readerSettings.columnsDesc')}
        theme={theme}
      />
      {pageReaderDisableAnimation ? null : (
        <>
          <List.SubHeader theme={theme}>
            {getString('readerSettings.pageAnimation')}
          </List.SubHeader>
          <SegmentedControl
            options={pageAnimationOptions.map(item => ({
              value: item.value,
              label: item.label(),
            }))}
            value={pageAnimation}
            onChange={value =>
              setChapterGeneralSettings({ pageAnimation: value })
            }
            modifiers={[fillMaxWidth(), padding(16, 4, 16, 8)]}
            theme={theme}
          />
        </>
      )}
    </>
  );
};

export default ReaderPagedLayout;
