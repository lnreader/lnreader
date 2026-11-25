import { getString } from '@i18n/translations';

export const getLibraryCategoryIndex = (
  categories: { id: number }[],
  categoryId?: number,
): number => {
  const index = categories.findIndex(category => category.id === categoryId);
  return index === -1 ? 0 : index;
};

export type LibraryFilterKey =
  | 'downloaded'
  | 'unread'
  | 'started'
  | 'completed'
  | 'customUpdateFrequency';

export type LibraryFilterState = 'include' | 'exclude';

export type LibraryFilters = Partial<
  Record<LibraryFilterKey, LibraryFilterState>
>;

/** Genre keys are normalized with `normalizeGenre`, so "Sci-fi" and "Sci fi" match. */
export interface LibraryGenreFilter {
  include: string[];
  exclude: string[];
}

export const libraryFilterList: { label: string; key: LibraryFilterKey }[] = [
  {
    label: getString('libraryScreen.bottomSheet.filters.downloaded'),
    key: 'downloaded',
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.unread'),
    key: 'unread',
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.started'),
    key: 'started',
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.completed'),
    key: 'completed',
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.customUpdateFrequency'),
    key: 'customUpdateFrequency',
  },
];

/** Older versions persisted a single raw SQL clause as `filter`. */
const legacyLibraryFilterKeys: Record<string, LibraryFilterKey> = {
  '(chaptersDownloaded > 0 OR isLocal = 1)': 'downloaded',
  'lastReadAt IS NULL': 'unread',
  'lastReadAt IS NOT NULL': 'started',
  "status LIKE 'Completed'": 'completed',
  'fetchInterval < 0': 'customUpdateFrequency',
};

export const resolveLibraryFilters = (
  libraryFilters: LibraryFilters | undefined,
  legacyFilter: string | undefined,
): LibraryFilters => {
  if (libraryFilters) {
    return libraryFilters;
  }
  const legacyKey = legacyFilter
    ? legacyLibraryFilterKeys[legacyFilter]
    : undefined;
  return legacyKey ? { [legacyKey]: 'include' } : {};
};

/** Cycles unset → include → exclude → unset, like Mihon's library filters. */
export const nextLibraryFilterState = (
  state: LibraryFilterState | undefined,
): LibraryFilterState | undefined =>
  state === undefined ? 'include' : state === 'include' ? 'exclude' : undefined;

// NIL: Novels in Library
export enum LibrarySortOrder {
  Alphabetically_ASC = 'name ASC',
  Alphabetically_DESC = 'name DESC',
  Downloaded_ASC = 'chaptersDownloaded ASC',
  Downloaded_DESC = 'chaptersDownloaded DESC',
  TotalChapters_ASC = 'totalChapters ASC',
  TotalChapters_DESC = 'totalChapters DESC',
  UnreadChapters_ASC = 'chaptersUnread ASC',
  UnreadChapters_DESC = 'chaptersUnread DESC',
  DateAdded_ASC = 'id ASC',
  DateAdded_DESC = 'id DESC',
  LastRead_ASC = 'lastReadAt ASC',
  LastRead_DESC = 'lastReadAt DESC',
  LastUpdated_ASC = 'lastUpdatedAt ASC',
  LastUpdated_DESC = 'lastUpdatedAt DESC',
}

export const librarySortOrderList = [
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.alphabetically'),
    ASC: LibrarySortOrder.Alphabetically_ASC,
    DESC: LibrarySortOrder.Alphabetically_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.lastRead'),
    ASC: LibrarySortOrder.LastRead_ASC,
    DESC: LibrarySortOrder.LastRead_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.lastUpdated'),
    ASC: LibrarySortOrder.LastUpdated_ASC,
    DESC: LibrarySortOrder.LastUpdated_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.download'),
    ASC: LibrarySortOrder.Downloaded_ASC,
    DESC: LibrarySortOrder.Downloaded_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.totalChapters'),
    ASC: LibrarySortOrder.TotalChapters_ASC,
    DESC: LibrarySortOrder.TotalChapters_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.unread'),
    ASC: LibrarySortOrder.UnreadChapters_ASC,
    DESC: LibrarySortOrder.UnreadChapters_DESC,
  },
  {
    label: getString('libraryScreen.bottomSheet.sortOrders.dateAdded'),
    ASC: LibrarySortOrder.DateAdded_ASC,
    DESC: LibrarySortOrder.DateAdded_DESC,
  },
];

export enum DisplayModes {
  Compact,
  Comfortable,
  CoverOnly,
  List,
}

export const displayModesList = [
  {
    label: getString('libraryScreen.bottomSheet.display.compact'),
    value: DisplayModes.Compact,
  },
  {
    label: getString('libraryScreen.bottomSheet.display.comfortable'),
    value: DisplayModes.Comfortable,
  },
  {
    label: getString('libraryScreen.bottomSheet.display.noTitle'),
    value: DisplayModes.CoverOnly,
  },
  {
    label: getString('libraryScreen.bottomSheet.display.list'),
    value: DisplayModes.List,
  },
];
