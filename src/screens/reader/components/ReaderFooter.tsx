import { useEffect, useRef, useState } from 'react';
import {
  AnimatedVisibility,
  Column,
  EnterTransition,
  ExitTransition,
  Row,
  Surface,
} from '@expo/ui/jetpack-compose';
import {
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useChapterGeneralSettings } from '@hooks/persisted';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import { sliderTick } from '@utils/haptics';
import { useChapterContext } from '../ChapterContext';
import { useSliderHaptics } from './ReaderBottomSheet/useSliderHaptics';
import AutoStoriesIcon from '@expo/material-symbols/auto_stories.xml';
import FormatListBulletedIcon from '@expo/material-symbols/format_list_bulleted.xml';
import SkipNextIcon from '@expo/material-symbols/skip_next.xml';
import SkipPreviousIcon from '@expo/material-symbols/skip_previous.xml';
import SlowMotionVideoIcon from '@expo/material-symbols/slow_motion_video.xml';
import TuneIcon from '@expo/material-symbols/tune.xml';
import VerticalAlignTopIcon from '@expo/material-symbols/vertical_align_top.xml';
import ViewDayIcon from '@expo/material-symbols/view_day.xml';
import {
  AppHost,
  IconButtonV2,
  Slider,
  AppText,
  useScreenInsets,
} from '@components';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import {
  BAR_HEIGHT,
  BAR_BUTTON_WIDTH,
  slideIn,
  slideOut,
  useBarGutter,
} from './ReaderAppbar';
import { StyleSheet } from 'react-native';

export const bottomBarHeight = (verticalSeekbar: boolean) =>
  verticalSeekbar ? BAR_HEIGHT : 128;

const SCRUB_SEEK_MS = 120;

const SCRUB_SETTLE_MS = 1000;

const SCRUB_ARRIVED = 0.005;

const MIN_TICK_GAP = 12;

export const SIDE_SEEKBAR_THICKNESS = 38;

const SIDE_SEEKBAR_MARGIN = 16;

const positionLabel = (
  position: ReturnType<typeof useChapterContext>['position'],
) => {
  if (!position) {
    return '';
  }
  if (position.page && position.pages) {
    return getString('readerSettings.pageOf', {
      page: position.page,
      pages: position.pages,
    });
  }
  return `${Math.round(position.fraction * 100)}%`;
};

// Paginated, the scrubber moves by whole pages and only seeks when the page
// would change; a dropped thumb waits for the reader instead of jumping back.
const useScrubber = () => {
  const { position, seek } = useChapterContext();
  const [dragging, setDragging] = useState<number>();
  const [dropped, setDropped] = useState<number>();
  const haptics = useSliderHaptics();
  const lastSeek = useRef(0);
  const lastTick = useRef(-1);
  const latest = useRef<number>(undefined);
  const sought = useRef<number>(undefined);
  const pages = position?.page && position.pages ? position.pages : undefined;
  /** Page k + 1 opens at fraction k / (pages − 1). */
  const snap = (value: number) =>
    pages
      ? pages > 1
        ? Math.round(value * (pages - 1)) / (pages - 1)
        : 0
      : value;
  const current =
    pages && position?.page
      ? snap((position.page - 1) / Math.max(1, pages - 1))
      : position?.fraction ?? 0;
  const label = (value: number) =>
    pages
      ? getString('readerSettings.pageOf', {
          page: Math.round(value * Math.max(1, pages - 1)) + 1,
          pages,
        })
      : `${Math.round(value * 100)}%`;

  useEffect(() => {
    if (dropped === undefined) {
      return;
    }
    const arrived = Math.abs(current - dropped) < SCRUB_ARRIVED;
    const timer = setTimeout(
      () => setDropped(undefined),
      arrived ? 0 : SCRUB_SETTLE_MS,
    );
    return () => clearTimeout(timer);
  }, [current, dropped]);

  const shown = dragging === undefined ? dropped : snap(dragging);
  return {
    pages,
    fraction: dragging ?? dropped ?? current,
    // Two pages need no stops; they snap on drop.
    step: pages && pages > 2 ? 1 / (pages - 1) : undefined,
    ticks: (length: number) =>
      !!pages && pages > 2 && length / (pages - 1) >= MIN_TICK_GAP,
    movable: pages
      ? pages > 1
      : !!position && (position.fraction > 0 || position.endFraction < 1),
    label: shown === undefined ? undefined : label(shown),
    onValueChange: (value: number) => {
      sought.current ??= current;
      latest.current = value;
      setDragging(value);
      const target = snap(value);
      const tick = Math.round(target * 20);
      if (tick !== lastTick.current) {
        lastTick.current = tick;
        if (haptics) {
          sliderTick();
        }
      }
      const now = Date.now();
      if (
        target !== sought.current &&
        now - lastSeek.current >= SCRUB_SEEK_MS
      ) {
        lastSeek.current = now;
        sought.current = target;
        seek(target);
      }
    },
    onValueChangeFinished: () => {
      if (latest.current !== undefined) {
        const target = snap(latest.current);
        if (target !== sought.current) {
          seek(target);
        }
        setDropped(target);
      }
      latest.current = undefined;
      sought.current = undefined;
      lastTick.current = -1;
      setDragging(undefined);
    },
  };
};

interface ReaderFooterProps {
  visible: boolean;
  onOpenChapters: () => void;
  onOpenSettings: () => void;
}

const ReaderFooter = ({
  visible,
  onOpenChapters,
  onOpenSettings,
}: ReaderFooterProps) => {
  const theme = useTheme();
  const { bottom, left, right } = useScreenInsets();
  const layout = useWindowLayout();
  const gutter = useBarGutter();
  const {
    chapter,
    chapters,
    nextChapter,
    prevChapter,
    position,
    navigateChapter,
    seek,
  } = useChapterContext();
  const {
    pageReader,
    autoScroll,
    continuousChapters,
    verticalSeekbar = true,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();
  const scrubber = useScrubber();
  const scrubberLength =
    layout.width - 2 * gutter - left - right - 16 - 2 * BAR_BUTTON_WIDTH;
  const index = chapters.findIndex(item => item.id === chapter.id);

  const previous = (
    <IconButtonV2
      name={SkipPreviousIcon}
      accessibilityLabel={
        prevChapter
          ? getString('readerScreen.previousChapter', {
              name: prevChapter.name,
            })
          : getString('readerScreen.noPreviousChapter')
      }
      disabled={!prevChapter}
      onPress={() => navigateChapter('PREV')}
      theme={theme}
    />
  );
  const next = (
    <IconButtonV2
      name={SkipNextIcon}
      accessibilityLabel={
        nextChapter
          ? getString('readerScreen.nextChapter', { name: nextChapter.name })
          : getString('readerScreen.noNextChapter')
      }
      disabled={!nextChapter}
      onPress={() => navigateChapter('NEXT')}
      theme={theme}
    />
  );
  const tools = (
    <>
      {continuousChapters ? null : (
        <IconButtonV2
          name={VerticalAlignTopIcon}
          accessibilityLabel={getString('readerScreen.drawer.scrollToTop')}
          onPress={() => seek(0)}
          theme={theme}
        />
      )}
      <IconButtonV2
        name={FormatListBulletedIcon}
        accessibilityLabel={getString('common.chapters')}
        onPress={onOpenChapters}
        theme={theme}
      />
      <IconButtonV2
        name={pageReader ? AutoStoriesIcon : ViewDayIcon}
        accessibilityLabel={getString(
          pageReader ? 'readerSettings.pages' : 'readerSettings.scroll',
        )}
        onPress={() => setChapterGeneralSettings({ pageReader: !pageReader })}
        theme={theme}
      />
      {pageReader ? null : (
        <IconButtonV2
          name={SlowMotionVideoIcon}
          accessibilityLabel={getString('readerScreen.bottomSheet.autoscroll')}
          selected={autoScroll}
          onPress={() => setChapterGeneralSettings({ autoScroll: !autoScroll })}
          theme={theme}
        />
      )}
      <IconButtonV2
        name={TuneIcon}
        accessibilityLabel={getString('readerSettings.title')}
        onPress={onOpenSettings}
        theme={theme}
      />
    </>
  );

  return (
    <AppHost
      style={[
        styles.bottom,
        { height: bottomBarHeight(verticalSeekbar) + bottom },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <AnimatedVisibility
        visible={visible}
        enterTransition={slideIn(1)}
        exitTransition={slideOut(1)}
        modifiers={[fillMaxWidth()]}
      >
        <Surface
          color={theme.surfaceContainer}
          contentColor={theme.onSurface}
          modifiers={[fillMaxWidth()]}
        >
          <Column
            modifiers={[
              fillMaxWidth(),
              padding(left + gutter + 4, 4, right + gutter + 4, bottom + 4),
            ]}
          >
            {verticalSeekbar ? (
              <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                {previous}
                <Row
                  verticalAlignment="center"
                  horizontalArrangement="spaceEvenly"
                  modifiers={[weight(1)]}
                >
                  {tools}
                </Row>
                {next}
              </Row>
            ) : (
              <>
                {/* The buttons centre on the slider; the labels sit under it. */}
                <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
                  {previous}
                  <Column modifiers={[weight(1), padding(4, 0, 4, 0)]}>
                    <Slider
                      value={scrubber.fraction}
                      min={0}
                      max={1}
                      step={scrubber.step}
                      showStops={scrubber.ticks(scrubberLength)}
                      disabled={!scrubber.movable}
                      onValueChange={scrubber.onValueChange}
                      onSlidingComplete={scrubber.onValueChangeFinished}
                    />
                  </Column>
                  {next}
                </Row>
                <Row
                  modifiers={[
                    fillMaxWidth(),
                    padding(BAR_BUTTON_WIDTH + 8, 0, BAR_BUTTON_WIDTH + 8, 0),
                  ]}
                >
                  <AppText
                    variant="labelSmall"
                    color={theme.onSurfaceVariant}
                    maxLines={1}
                    modifiers={[weight(1)]}
                  >
                    {index >= 0
                      ? getString('readerSettings.chapterPosition', {
                          current: index + 1,
                          total: chapters.length,
                        })
                      : ''}
                  </AppText>
                  <AppText variant="labelSmall" color={theme.onSurfaceVariant}>
                    {scrubber.label ?? positionLabel(position)}
                  </AppText>
                </Row>
                <Row
                  verticalAlignment="center"
                  horizontalArrangement="spaceEvenly"
                  modifiers={[fillMaxWidth()]}
                >
                  {tools}
                </Row>
              </>
            )}
          </Column>
        </Surface>
      </AnimatedVisibility>
    </AppHost>
  );
};

export const ReaderSideSeekbar = ({ visible }: { visible: boolean }) => {
  const theme = useTheme();
  const { top, bottom, right } = useScreenInsets();
  const layout = useWindowLayout();
  const { verticalSeekbar = true } = useChapterGeneralSettings();
  const scrubber = useScrubber();
  const start = top + BAR_HEIGHT + SIDE_SEEKBAR_MARGIN;
  const available = Math.max(
    0,
    layout.height -
      start -
      bottomBarHeight(true) -
      bottom -
      SIDE_SEEKBAR_MARGIN,
  );
  // Sized like the old in-page scrollbar: half the screen, centred on it,
  // with where the reader is above and where the chapter ends below.
  const length = Math.min(
    available,
    Math.max(200, Math.round(layout.height / 2)),
  );
  if (!verticalSeekbar || length < SIDE_SEEKBAR_THICKNESS * 2) {
    return null;
  }
  const centerY = Math.min(
    Math.max(layout.height / 2, start + length / 2),
    start + available - length / 2,
  );
  const label = (text: string) => (
    <AppText
      variant="labelMedium"
      align="center"
      maxLines={1}
      modifiers={[fillMaxWidth(), padding(0, 10, 0, 10)]}
    >
      {text}
    </AppText>
  );
  return (
    <AppHost
      style={[
        styles.side,
        {
          height: length,
          right: right + Math.round(layout.width * 0.05),
          top: Math.round(centerY - length / 2),
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <AnimatedVisibility
        visible={visible}
        enterTransition={EnterTransition.fadeIn()}
        exitTransition={ExitTransition.fadeOut()}
        modifiers={[fillMaxSize()]}
      >
        <Surface
          color={theme.surfaceContainer}
          contentColor={theme.onSurface}
          modifiers={[fillMaxSize(), clip(Shapes.RoundedCorner(24))]}
        >
          <Column horizontalAlignment="center" modifiers={[fillMaxSize()]}>
            {label(
              scrubber.pages
                ? String(
                    Math.round(scrubber.fraction * (scrubber.pages - 1)) + 1,
                  )
                : String(Math.round(scrubber.fraction * 100)),
            )}
            <Slider
              vertical
              value={scrubber.fraction}
              min={0}
              max={1}
              step={scrubber.step}
              showStops={scrubber.ticks(length - 80)}
              disabled={!scrubber.movable}
              thumbLength={SIDE_SEEKBAR_THICKNESS - 16}
              onValueChange={scrubber.onValueChange}
              onSlidingComplete={scrubber.onValueChangeFinished}
              modifiers={[weight(1)]}
            />
            {label(scrubber.pages ? String(scrubber.pages) : '100')}
          </Column>
        </Surface>
      </AnimatedVisibility>
    </AppHost>
  );
};

const styles = StyleSheet.create({
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  side: { position: 'absolute', width: SIDE_SEEKBAR_THICKNESS },
});

export default ReaderFooter;
