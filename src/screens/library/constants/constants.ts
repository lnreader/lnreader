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

/** A filter that is not set is off. */
export type LibraryFilterState = 'include' | 'exclude';

export type LibraryFilters = Partial<
  Record<LibraryFilterKey, LibraryFilterState>
>;

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

export const nextLibraryFilterState = (
  state?: LibraryFilterState,
): LibraryFilterState | undefined => {
  switch (state) {
    case undefined:
      return 'include';
    case 'include':
      return 'exclude';
    default:
      return undefined;
  }
};

/**
 * The single filter older versions stored as a raw SQL fragment under
 * `filter`; kept only to carry an existing install's choice over.
 */
export enum LegacyLibraryFilter {
  Downloaded = '(chaptersDownloaded > 0 OR isLocal = 1)',
  Unread = 'lastReadAt IS NULL',
  Completed = "status LIKE 'Completed'",
  DownloadedOnly = 'AND chaptersDownloaded > 0',
  Started = 'lastReadAt IS NOT NULL',
  CustomUpdateFrequency = 'fetchInterval < 0',
}

const legacyLibraryFilterKeys = new Map<string, LibraryFilterKey>([
  [LegacyLibraryFilter.Downloaded, 'downloaded'],
  [LegacyLibraryFilter.Unread, 'unread'],
  [LegacyLibraryFilter.Completed, 'completed'],
  [LegacyLibraryFilter.DownloadedOnly, 'downloaded'],
  [LegacyLibraryFilter.Started, 'started'],
  [LegacyLibraryFilter.CustomUpdateFrequency, 'customUpdateFrequency'],
]);

/** Saved filters, falling back to the legacy single filter as an include. */
export const resolveLibraryFilters = (
  filters?: LibraryFilters,
  legacyFilter?: string,
): LibraryFilters => {
  if (filters) {
    return filters;
  }
  const key = legacyFilter
    ? legacyLibraryFilterKeys.get(legacyFilter)
    : undefined;
  return key ? { [key]: 'include' } : {};
};

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
