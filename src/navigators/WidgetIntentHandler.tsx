import { useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';

import { getMMKVObject } from '@utils/mmkv/mmkv';
import { APP_SETTINGS, type AppSettings } from '@hooks/persisted/useSettings';
import { useLibrarySettings } from '@hooks/persisted';
import { db } from '@database/db';
import { getChapter } from '@database/queries/ChapterQueries';
import { getNovelById } from '@database/queries/NovelQueries';
import { getRandomLibraryNovelFromDb } from '@database/queries/WidgetQueries';
import { scheduleWidgetSync, syncWidgets } from '@services/widgets';
import { navigationRef } from './ShareIntentHandler';

const WIDGET_URL_PREFIX = 'lnreader://widget/';

export const isWidgetUrl = (url: string) => url.startsWith(WIDGET_URL_PREFIX);

export interface WidgetLink {
  target: string;
  params: Record<string, string>;
}

/** Parses `lnreader://widget/<target>?a=1`. RN's URL polyfill lacks searchParams. */
export const parseWidgetUrl = (url: string): WidgetLink | null => {
  if (!isWidgetUrl(url)) {
    return null;
  }
  const [path, query = ''] = url.slice(WIDGET_URL_PREFIX.length).split('?');
  const target = path.replace(/\/+$/, '');
  if (!target) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) {
      continue;
    }
    const [key, value = ''] = pair.split('=');
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      // Malformed escape (e.g. a bare "%"); not a link a widget would send.
      return null;
    }
  }
  return { target, params };
};

const openTab = (tab: 'Library' | 'Updates' | 'History' | 'Browse') => {
  const { showUpdatesTab = true, showHistoryTab = true } =
    getMMKVObject<AppSettings>(APP_SETTINGS) ?? {};
  const hidden =
    (tab === 'Updates' && !showUpdatesTab) ||
    (tab === 'History' && !showHistoryTab);
  navigationRef.navigate('BottomNavigator', {
    screen: hidden ? 'Library' : tab,
  });
};

export const openWidgetLink = async ({ target, params }: WidgetLink) => {
  switch (target) {
    case 'chapter': {
      const novel = getNovelById(Number(params.novelId));
      const chapter = await getChapter(Number(params.chapterId));
      if (novel && chapter) {
        navigationRef.navigate('ReaderStack', {
          screen: 'Chapter',
          params: { novel, chapter },
        });
      } else {
        // Deleted since the widget last synced.
        openTab('Library');
        syncWidgets();
      }
      return;
    }
    case 'updates':
      return openTab('Updates');
    case 'history':
      return openTab('History');
    case 'browse':
      return openTab('Browse');
    case 'search':
      return navigationRef.navigate('GlobalSearchScreen', {});
    case 'downloads':
      return navigationRef.navigate('MoreStack', { screen: 'Downloads' });
    case 'random': {
      const novel = await getRandomLibraryNovelFromDb();
      if (novel) {
        navigationRef.navigate('ReaderStack', {
          screen: 'Novel',
          params: novel,
        });
      } else {
        openTab('Library');
      }
      return;
    }
    default:
      return openTab('Library');
  }
};

// Like shares, a widget tap can arrive before the navigator is ready; Main
// flushes this from NavigationContainer's onReady.
let pendingLink: WidgetLink | null = null;
let handledInitialUrl = false;

const dispatchWidgetUrl = (url: string | null) => {
  const link = url ? parseWidgetUrl(url) : null;
  if (!link) {
    return;
  }
  if (!navigationRef.isReady()) {
    pendingLink = link;
    return;
  }
  openWidgetLink(link);
};

export const flushPendingWidgetLink = () => {
  if (!pendingLink || !navigationRef.isReady()) {
    return;
  }
  const link = pendingLink;
  pendingLink = null;
  openWidgetLink(link);
};

/**
 * Routes widget taps and keeps widget data fresh while the app runs: any
 * Chapter/Novel write (reading progress, history, library changes) or an
 * incognito toggle schedules a debounced sync.
 */
const WidgetIntentHandler = () => {
  const { incognitoMode } = useLibrarySettings();

  useEffect(() => {
    if (!handledInitialUrl) {
      handledInitialUrl = true;
      Linking.getInitialURL()
        .then(dispatchWidgetUrl)
        .catch(() => {
          // No launch URL to act on.
        });
    }
    const subscription = Linking.addEventListener('url', ({ url }) =>
      dispatchWidgetUrl(url),
    );
    return () => subscription.remove();
  }, []);

  const incognitoChanged = useRef(false);
  useEffect(() => {
    if (incognitoChanged.current) {
      scheduleWidgetSync(0);
    }
    incognitoChanged.current = true;
  }, [incognitoMode]);

  useEffect(() => {
    syncWidgets({ force: true });
    const unsubscribe = db.reactiveExecute({
      query: 'SELECT 1',
      arguments: [],
      fireOn: [{ table: 'Chapter' }, { table: 'Novel' }],
      callback: () => scheduleWidgetSync(),
    });
    const appState = AppState.addEventListener('change', state => {
      if (state === 'background') {
        syncWidgets({ force: true });
      }
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);

  return null;
};

export default WidgetIntentHandler;
