import type { NovelInfo } from '@database/types';
import type { NovelItem } from '@plugins/types';
import {
  extendNovelList,
  novelListKeyExtractor,
  type NovelListDataItem,
} from '../NovelList';

jest.mock('@shopify/flash-list', () => ({
  FlashList: () => null,
}));

jest.mock('@hooks', () => ({
  useDeviceOrientation: () => 'portrait',
}));

jest.mock('@hooks/persisted', () => ({
  useLibrarySettings: () => ({
    displayMode: 'comfortable',
    novelsPerRow: 3,
    showDownloadBadges: true,
    showUnreadBadges: true,
  }),
}));

describe('NovelList helpers', () => {
  it('uses source and path instead of the array index for persisted novels', () => {
    const novel = {
      id: 1,
      name: 'Novel',
      path: '/novel',
      pluginId: 'english/source',
    } as NovelInfo;

    expect(novelListKeyExtractor(novel)).toBe('english/source:/novel');
  });

  it('uses the path as the stable key for source results', () => {
    const novel: NovelItem = {
      id: undefined,
      name: 'Novel',
      path: '/novel',
    };

    expect(novelListKeyExtractor(novel)).toBe('/novel');
  });

  it('adds uniquely keyed filler cells without mutating the source data', () => {
    const novels: NovelListDataItem[] = [
      { id: undefined, name: 'One', path: '/one' },
      { id: undefined, name: 'Two', path: '/two' },
    ];

    const extended = extendNovelList(novels, true, 4);

    expect(novels).toHaveLength(2);
    expect(extended.map(item => item.path)).toEqual([
      '/one',
      '/two',
      '__loading-filler-0',
      '__loading-filler-1',
      '__loading-row',
    ]);
  });
});
