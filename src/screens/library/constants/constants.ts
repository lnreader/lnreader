import { getString } from '@i18n/translations';

export enum LibraryFilter {
  Downloaded = '(chaptersDownloaded > 0 OR isLocal = 1)',
  Unread = 'lastReadAt IS NULL',
  Completed = "status LIKE 'Completed'",
  DownloadedOnly = 'AND chaptersDownloaded > 0',
  Started = 'lastReadAt IS NOT NULL',
}

export const libraryFilterList = [
  {
    label: getString('libraryScreen.bottomSheet.filters.downloaded'),
    filter: LibraryFilter.Downloaded,
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.unread'),
    filter: LibraryFilter.Unread,
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.started'),
    filter: LibraryFilter.Started,
  },
  {
    label: getString('libraryScreen.bottomSheet.filters.completed'),
    filter: LibraryFilter.Completed,
  },
];

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
