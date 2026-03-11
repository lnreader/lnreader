import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  StatusBar,
  ScrollView,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { IconButton, Switch } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import color from 'color';
import { useTheme } from '@hooks/persisted';
import { useChapterContext } from '../ChapterContext';

interface RSVPReaderProps {
  visible: boolean;
  onClose: () => void;
}

type RSVPViewStyle = 'flash' | 'scroll-v' | 'scroll-h';

// ─── Helpers ────────────────────────────────────────────────

function htmlToWords(html: string): string[] {
  let text = html.replace(/<[^>]*>/g, ' ');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, c) => String.fromCharCode(Number(c)));
  return text.split(/\s+/).filter(w => w.length > 0);
}

const CHUNK_WORDS = new Set([
  'a', 'an', 'the', 'i', 'is', 'am', 'in', 'on', 'at', 'to', 'of',
  'it', 'my', 'no', 'or', 'so', 'do', 'if', 'by', 'as', 'be', 'he',
  'we', 'up', 'us', 'me', '&',
]);

function chunkWords(words: string[]): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const w = words[i];
    if (
      CHUNK_WORDS.has(w.toLowerCase()) &&
      i + 1 < words.length &&
      words[i + 1].length <= 8
    ) {
      chunks.push(w + ' ' + words[i + 1]);
      i += 2;
    } else {
      chunks.push(w);
      i += 1;
    }
  }
  return chunks;
}

function getORP(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return Math.floor(len * 0.3);
}

function wordDelay(word: string, wpm: number): number {
  const base = 60000 / wpm;
  if (/[.!?]$/.test(word)) return base + base * 0.6;
  if (/[,;:]$/.test(word)) return base + base * 0.3;
  if (word.length > 12) return base + base * 0.2;
  if (word.length > 8) return base + base * 0.15;
  if (word.includes(' ')) return base + base * 0.4;
  return base;
}

function bionicBoldLen(word: string): number {
  const len = word.length;
  if (len <= 1) return 1;
  if (len <= 3) return 1;
  if (len <= 6) return 2;
  if (len <= 9) return 3;
  return Math.ceil(len * 0.4);
}

function BionicWord({
  word,
  bionic,
  boldColor,
  restColor,
  fontSize,
  fontWeight,
}: {
  word: string;
  bionic: boolean;
  boldColor: string;
  restColor: string;
  fontSize: number;
  fontWeight?: 'bold' | 'normal';
}) {
  if (!bionic) {
    return (
      <Text style={{ color: boldColor, fontSize, fontWeight: fontWeight ?? 'normal' }}>
        {word}
      </Text>
    );
  }
  const bLen = bionicBoldLen(word);
  return (
    <Text>
      <Text style={{ fontWeight: 'bold', color: boldColor, fontSize }}>
        {word.slice(0, bLen)}
      </Text>
      <Text style={{ fontWeight: 'normal', color: restColor, fontSize }}>
        {word.slice(bLen)}
      </Text>
    </Text>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Reusable focus ruler: two horizontal lines with a center tick mark */
function FocusRuler({ primaryColor, width }: { primaryColor: string; width: string | number }) {
  return (
    <View style={[rulerStyles.container, { width: width as any }]}>
      <View style={[rulerStyles.line, { backgroundColor: primaryColor }]} />
      <View style={[rulerStyles.tick, { backgroundColor: primaryColor }]} />
      <View style={[rulerStyles.line, { backgroundColor: primaryColor }]} />
    </View>
  );
}

const rulerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginVertical: 6,
  },
  line: {
    flex: 1,
    height: 2,
    opacity: 0.25,
    borderRadius: 1,
  },
  tick: {
    width: 2,
    height: 14,
    marginHorizontal: 2,
    opacity: 0.5,
    borderRadius: 1,
  },
});

// ─── Constants ──────────────────────────────────────────────

const MIN_WPM = 50;
const MAX_WPM = 1000;
const DEFAULT_WPM = 100;
const WPM_STEP = 10;
const MIN_LINE_SPACING = 1;
const MAX_LINE_SPACING = 3;
const DEFAULT_LINE_SPACING = 1.5;
const MIN_FONT = 16;
const MAX_FONT = 48;
const DEFAULT_FONT = 36;

const VIEW_STYLES: { key: RSVPViewStyle; label: string; icon: string }[] = [
  { key: 'flash', label: 'Flash', icon: 'flash' },
  { key: 'scroll-v', label: 'Vertical', icon: 'arrow-expand-vertical' },
  { key: 'scroll-h', label: 'Horizontal', icon: 'arrow-expand-horizontal' },
];

// ─── Component ──────────────────────────────────────────────

const RSVPReader = ({ visible, onClose }: RSVPReaderProps) => {
  const theme = useTheme();
  const { chapterText, chapter } = useChapterContext();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;
  const rawWords = useMemo(() => htmlToWords(chapterText), [chapterText]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [bionic, setBionic] = useState(false);
  const [viewStyle, setViewStyle] = useState<RSVPViewStyle>('flash');
  const [lineSpacing, setLineSpacing] = useState(DEFAULT_LINE_SPACING);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [chunking, setChunking] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const pendingPlayRef = useRef(false);

  const words = useMemo(
    () => (chunking ? chunkWords(rawWords) : rawWords),
    [rawWords, chunking],
  );

  const indexRef = useRef(currentIndex);
  const isPlayingRef = useRef(isPlaying);
  const wpmRef = useRef(wpm);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { wpmRef.current = wpm; }, [wpm]);

  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [chapterText]);

  const timeRemaining = useMemo(() => {
    const remaining = words.length - currentIndex;
    if (remaining <= 0) return '0:00';
    return formatTime((remaining / wpm) * 60);
  }, [words.length, currentIndex, wpm]);

  // ── Countdown then play ──

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 700);
      return () => clearTimeout(t);
    }
    if (pendingPlayRef.current) {
      pendingPlayRef.current = false;
      setIsPlaying(true);
    }
  }, [countdown]);

  const startWithCountdown = useCallback(() => {
    if (currentIndex >= words.length) {
      setCurrentIndex(0);
      indexRef.current = 0;
    }
    pendingPlayRef.current = true;
    setCountdown(3);
  }, [currentIndex, words.length]);

  // ── Playback ──

  const scheduleNext = useCallback(() => {
    if (!isPlayingRef.current) return;
    const idx = indexRef.current;
    if (idx >= words.length) {
      setIsPlaying(false);
      return;
    }
    const delay = wordDelay(words[idx], wpmRef.current);
    timerRef.current = setTimeout(() => {
      setCurrentIndex(prev => {
        const next = prev + 1;
        indexRef.current = next;
        return next;
      });
      scheduleNext();
    }, delay);
  }, [words]);

  useEffect(() => {
    if (isPlaying) {
      scheduleNext();
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, scheduleNext]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    startWithCountdown();
  }, [isPlaying, startWithCountdown]);

  const handleClose = useCallback(() => {
    setIsPlaying(false);
    setCountdown(0);
    setShowBottomSheet(false);
    onClose();
  }, [onClose]);

  const openBottomSheet = useCallback(() => {
    setShowBottomSheet(true);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [sheetAnim]);

  const closeBottomSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setShowBottomSheet(false));
  }, [sheetAnim]);

  const progress =
    words.length > 0 ? ((currentIndex + 1) / words.length) * 100 : 0;

  // ── View: Flash (Spritz-style ORP-aligned) ──

  const renderFlash = () => {
    if (countdown > 0) {
      return (
        <View style={styles.flashArea}>
          <Text style={[styles.countdownText, { color: theme.primary }]}>
            {countdown}
          </Text>
        </View>
      );
    }

    const w = words[currentIndex] ?? '';
    const orp = getORP(w);
    const before = w.slice(0, orp);
    const orpChar = w[orp] ?? '';
    const after = w.slice(orp + 1);
    const halfWidth = (screenWidth - 60) / 2;

    if (bionic) {
      const bLen = bionicBoldLen(w);
      const bBefore = w.slice(0, Math.min(bLen, orp));
      const bOrp = orp < bLen ? 'bold' : 'normal';
      const bAfter = Math.max(0, bLen - orp - 1);
      return (
        <View style={styles.flashArea}>
          <FocusRuler primaryColor={theme.primary} width="70%" />
          <View style={styles.spritzRow}>
            <View style={[styles.spritzLeft, { width: halfWidth }]}>
              <Text style={{ fontSize, fontFamily: 'monospace' }}>
                <Text style={{ fontWeight: bBefore.length > 0 ? 'bold' : 'normal', color: theme.onSurface }}>
                  {bBefore}
                </Text>
                <Text style={{ fontWeight: 'normal', color: theme.onSurfaceVariant }}>
                  {before.slice(bBefore.length)}
                </Text>
              </Text>
            </View>
            <View style={styles.spritzCenter}>
              <Text style={{ fontSize: fontSize + 4, fontWeight: bOrp, color: theme.primary, fontFamily: 'monospace' }}>
                {orpChar}
              </Text>
            </View>
            <View style={[styles.spritzRight, { width: halfWidth }]}>
              <Text style={{ fontSize, fontFamily: 'monospace' }}>
                <Text style={{ fontWeight: 'bold', color: theme.onSurface }}>
                  {after.slice(0, bAfter)}
                </Text>
                <Text style={{ fontWeight: 'normal', color: theme.onSurfaceVariant }}>
                  {after.slice(bAfter)}
                </Text>
              </Text>
            </View>
          </View>
          <FocusRuler primaryColor={theme.primary} width="70%" />
        </View>
      );
    }

    return (
      <View style={styles.flashArea}>
        <FocusRuler primaryColor={theme.primary} width="70%" />
        <View style={styles.spritzRow}>
          <View style={[styles.spritzLeft, { width: halfWidth }]}>
            <Text style={[styles.spritzText, { color: theme.onSurface, fontSize }]}>
              {before}
            </Text>
          </View>
          <View style={styles.spritzCenter}>
            <Text style={[styles.spritzPivot, { color: theme.primary, fontSize: fontSize + 4 }]}>
              {orpChar}
            </Text>
          </View>
          <View style={[styles.spritzRight, { width: halfWidth }]}>
            <Text style={[styles.spritzText, { color: theme.onSurface, fontSize }]}>
              {after}
            </Text>
          </View>
        </View>
        <FocusRuler primaryColor={theme.primary} width="70%" />
      </View>
    );
  };

  // ── View: Scroll Vertical ──

  const renderScrollVertical = () => {
    if (countdown > 0) {
      return (
        <View style={styles.scrollVArea}>
          <Text style={[styles.countdownText, { color: theme.primary }]}>{countdown}</Text>
        </View>
      );
    }

    const VISIBLE_LINES = isLandscape ? 5 : 7;
    const CENTER_LINE = Math.floor(VISIBLE_LINES / 2);
    const wordsPerLine = rulerMaxWords;
    const centerSlot = Math.floor(wordsPerLine / 2);
    const activeLineStart = currentIndex - centerSlot;

    return (
      <View style={styles.scrollVArea}>
        {Array.from({ length: VISIBLE_LINES }, (_, li) => {
          const offset = li - CENTER_LINE;
          const isCenterLine = li === CENTER_LINE;
          const lineStart = activeLineStart + offset * wordsPerLine;
          const distFromCenter = Math.abs(offset);
          const lineOpacity = 1 - distFromCenter * 0.15;
          return (
            <View key={`line-${li}`}>
              {isCenterLine && <FocusRuler primaryColor={theme.primary} width="80%" />}
              <View
                style={[
                  styles.scrollVLine,
                  { marginVertical: lineSpacing * 2, opacity: lineOpacity },
                ]}
              >
                {Array.from({ length: wordsPerLine }, (__, wi) => {
                  const globalIdx = lineStart + wi;
                  if (globalIdx < 0 || globalIdx >= words.length) {
                    return (
                      <Text key={`sp-${li}-${wi}`} style={{ marginHorizontal: 3, fontSize: fontSize * 0.5 }}>
                        {'  '}
                      </Text>
                    );
                  }
                  const isActive = globalIdx === currentIndex;
                  return (
                    <Text key={globalIdx} style={{ marginHorizontal: 3 }}>
                      <BionicWord
                        word={words[globalIdx]}
                        bionic={bionic}
                        boldColor={isActive ? theme.primary : theme.onSurface}
                        restColor={
                          isActive
                            ? color(theme.primary).alpha(0.7).string()
                            : theme.onSurfaceVariant
                        }
                        fontSize={isActive ? fontSize * 0.7 : fontSize * 0.5}
                        fontWeight={isActive ? 'bold' : 'normal'}
                      />
                    </Text>
                  );
                })}
              </View>
              {isCenterLine && <FocusRuler primaryColor={theme.primary} width="80%" />}
            </View>
          );
        })}
      </View>
    );
  };

  // ── View: Scroll Horizontal (active word centered) ──

  const renderScrollHorizontal = () => {
    if (countdown > 0) {
      return (
        <View style={styles.scrollHArea}>
          <Text style={[styles.countdownText, { color: theme.primary }]}>{countdown}</Text>
        </View>
      );
    }

    const hVisible = rulerMaxWords;
    const half = Math.floor(hVisible / 2);
    const windowStart = currentIndex - half;

    return (
      <View style={styles.scrollHArea}>
        <FocusRuler primaryColor={theme.primary} width="85%" />
        <View style={styles.scrollHRow}>
          {Array.from({ length: hVisible }, (_, i) => {
            const globalIdx = windowStart + i;
            const isCenter = i === half;
            if (globalIdx < 0 || globalIdx >= words.length) {
              return (
                <View
                  key={`sp-h-${i}`}
                  style={[styles.scrollHWord, { marginHorizontal: lineSpacing * 3 }]}
                >
                  <Text style={{ fontSize: fontSize * 0.6 }}>{' '}</Text>
                </View>
              );
            }
            return (
              <View
                key={`h-${globalIdx}`}
                style={[styles.scrollHWord, { marginHorizontal: lineSpacing * 3 }]}
              >
                <BionicWord
                  word={words[globalIdx]}
                  bionic={bionic}
                  boldColor={isCenter ? theme.primary : theme.onSurfaceVariant}
                  restColor={
                    isCenter
                      ? color(theme.primary).alpha(0.7).string()
                      : color(theme.onSurfaceVariant).alpha(0.5).string()
                  }
                  fontSize={isCenter ? fontSize : fontSize * 0.6}
                  fontWeight={isCenter ? 'bold' : 'normal'}
                />
              </View>
            );
          })}
        </View>
        <FocusRuler primaryColor={theme.primary} width="85%" />
      </View>
    );
  };

  // Max words that fit on one line without wrapping
  const rulerMaxWords = useMemo(() => {
    const avgCharWidth = fontSize * 0.55;
    const avgWordChars = 5;
    const wordMargin = 10;
    const available = screenWidth - 40;
    return Math.max(3, Math.floor(available / (avgCharWidth * avgWordChars + wordMargin)));
  }, [fontSize, screenWidth]);

  const renderDisplay = () => {
    switch (viewStyle) {
      case 'scroll-v':
        return renderScrollVertical();
      case 'scroll-h':
        return renderScrollHorizontal();
      default:
        return renderFlash();
    }
  };

  // ── Render ──

  const renderBody = () => (
    <>
      {/* View style selector */}
      <ScrollView
        horizontal={isLandscape}
        showsHorizontalScrollIndicator={false}
        style={[
          { flexGrow: 0 },
          isLandscape ? styles.landscapeSettingsBar : undefined,
        ]}
        contentContainerStyle={
          isLandscape ? styles.landscapeSettingsBarContent : undefined
        }
      >
        <View style={isLandscape ? styles.settingsRowLandscape : styles.settingsRow}>
          <View style={styles.viewStyleRow}>
            {VIEW_STYLES.map(vs => {
              const active = viewStyle === vs.key;
              return (
                <Pressable
                  key={vs.key}
                  onPress={() => setViewStyle(vs.key)}
                  style={[
                    styles.viewStyleChip,
                    {
                      backgroundColor: active
                        ? color(theme.primary).alpha(0.15).string()
                        : 'transparent',
                      borderColor: active ? theme.primary : theme.outline,
                    },
                  ]}
                >
                  <IconButton
                    icon={vs.icon}
                    size={16}
                    iconColor={active ? theme.primary : theme.onSurfaceVariant}
                    style={styles.chipIcon}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: active ? theme.primary : theme.onSurfaceVariant,
                    }}
                  >
                    {vs.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      {/* Display */}
      <View style={styles.displayArea}>
        {renderDisplay()}
      </View>
      {renderBottomBar()}
    </>
  );

  const renderBottomBar = () => (
    <>
      {/* Progress + time remaining */}
      <View style={styles.progressSection}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressText, { color: theme.onSurfaceVariant }]}>
            {Math.min(currentIndex + 1, words.length)} / {words.length} (
            {progress.toFixed(1)}%)
          </Text>
          <Text style={[styles.progressText, { color: theme.onSurfaceVariant }]}>
            {timeRemaining} left
          </Text>
        </View>
        <Slider
          style={styles.progressSlider}
          minimumValue={0}
          maximumValue={Math.max(words.length - 1, 1)}
          value={currentIndex}
          onSlidingStart={() => setIsPlaying(false)}
          onSlidingComplete={val => {
            const idx = Math.round(val);
            setCurrentIndex(idx);
            indexRef.current = idx;
          }}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.surfaceVariant}
          thumbTintColor={theme.primary}
        />
      </View>

      {/* Controls: centered WPM−/Play/WPM+, gear pinned right */}
      <View style={styles.controls}>
        {/* Left spacer to balance the gear on the right */}
        <View style={styles.controlsEdge} />

        <View style={styles.controlsCenter}>
          <Pressable
            onPress={() => setWpm(c => Math.max(MIN_WPM, c - WPM_STEP))}
            style={[styles.wpmBtn, { borderColor: theme.outline }]}
          >
            <Text style={{ color: theme.onSurface, fontSize: 20, fontWeight: 'bold' }}>−</Text>
          </Pressable>

          <View style={styles.playCol}>
            <Pressable
              onPress={togglePlay}
              style={[styles.playButton, { backgroundColor: theme.primary }]}
            >
              <IconButton
                icon={isPlaying ? 'pause' : 'play'}
                size={28}
                iconColor={theme.onPrimary}
                style={styles.playBtnIcon}
              />
            </Pressable>
            <Text style={[styles.wpmLabel, { color: theme.onSurfaceVariant }]}>
              {wpm} WPM
            </Text>
          </View>

          <Pressable
            onPress={() => setWpm(c => Math.min(MAX_WPM, c + WPM_STEP))}
            style={[styles.wpmBtn, { borderColor: theme.outline }]}
          >
            <Text style={{ color: theme.onSurface, fontSize: 20, fontWeight: 'bold' }}>+</Text>
          </Pressable>
        </View>

        <View style={styles.controlsEdge}>
          <IconButton
            icon="cog"
            size={22}
            iconColor={theme.onSurfaceVariant}
            onPress={openBottomSheet}
            style={{ margin: 0 }}
          />
        </View>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar
        backgroundColor={theme.surface}
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />
      <View style={[styles.container, { backgroundColor: theme.surface }]}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton
            icon="close"
            size={24}
            iconColor={theme.onSurface}
            onPress={handleClose}
          />
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: theme.onSurface }]}
          >
            RSVP — {chapter.name}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {renderBody()}

        {/* Bottom sheet overlay */}
        {showBottomSheet && (
          <View style={StyleSheet.absoluteFill}>
            {/* Backdrop */}
            <Pressable style={styles.sheetBackdrop} onPress={closeBottomSheet} />
            {/* Sheet */}
            <Animated.View
              style={[
                styles.sheetContainer,
                { backgroundColor: theme.surface },
                {
                  transform: [
                    {
                      translateY: sheetAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [400, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Handle */}
              <View style={styles.sheetHandle}>
                <View style={[styles.sheetHandleBar, { backgroundColor: theme.outline }]} />
              </View>

              <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                {/* Toggles */}
                <View style={styles.sheetSection}>
                  <View style={styles.sheetRow}>
                    <Text style={[styles.sheetLabel, { color: theme.onSurface }]}>Bionic Reading</Text>
                    <Switch value={bionic} onValueChange={setBionic} color={theme.primary} />
                  </View>
                  <View style={styles.sheetRow}>
                    <Text style={[styles.sheetLabel, { color: theme.onSurface }]}>Word Chunking</Text>
                    <Switch value={chunking} onValueChange={setChunking} color={theme.primary} />
                  </View>
                </View>

                {/* Font size */}
                <View style={styles.sheetSection}>
                  <Text style={[styles.sheetSectionTitle, { color: theme.onSurfaceVariant }]}>Font Size</Text>
                  <View style={styles.sheetSliderRow}>
                    <Text style={[styles.sheetValue, { color: theme.onSurface }]}>{fontSize}</Text>
                    <Slider
                      style={styles.sheetSlider}
                      minimumValue={MIN_FONT}
                      maximumValue={MAX_FONT}
                      step={2}
                      value={fontSize}
                      onValueChange={setFontSize}
                      minimumTrackTintColor={theme.primary}
                      maximumTrackTintColor={theme.outline}
                      thumbTintColor={theme.primary}
                    />
                  </View>
                </View>

                {/* Line spacing */}
                <View style={styles.sheetSection}>
                  <Text style={[styles.sheetSectionTitle, { color: theme.onSurfaceVariant }]}>Line Spacing</Text>
                  <View style={styles.sheetSliderRow}>
                    <Text style={[styles.sheetValue, { color: theme.onSurface }]}>{lineSpacing.toFixed(2)}</Text>
                    <Slider
                      style={styles.sheetSlider}
                      minimumValue={MIN_LINE_SPACING}
                      maximumValue={MAX_LINE_SPACING}
                      step={0.25}
                      value={lineSpacing}
                      onValueChange={v => setLineSpacing(Math.round(v * 100) / 100)}
                      minimumTrackTintColor={theme.primary}
                      maximumTrackTintColor={theme.outline}
                      thumbTintColor={theme.primary}
                    />
                  </View>
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        )}
      </View>
    </Modal>
  );
};

export default React.memo(RSVPReader);

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  headerSpacer: { width: 48 },

  /* Landscape layout — compact horizontal settings bar */
  landscapeSettingsBar: {
    maxHeight: 52,
    flexGrow: 0,
  },
  landscapeSettingsBarContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  settingsRowLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },

  /* Settings (portrait) */
  settingsRow: {
    paddingHorizontal: 12,
    paddingTop: 6,
    gap: 8,
  },
  viewStyleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  viewStyleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingRight: 10,
    paddingVertical: 2,
  },
  chipIcon: { margin: 0, marginLeft: 4 },
  /* Display */
  displayArea: { flex: 1, justifyContent: 'center' },

  /* Flash / Spritz view */
  flashArea: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  spritzRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  spritzLeft: {
    alignItems: 'flex-end',
  },
  spritzCenter: {
    alignItems: 'center',
    minWidth: 20,
  },
  spritzRight: {
    alignItems: 'flex-start',
  },
  spritzText: { fontFamily: 'monospace' },
  spritzPivot: { fontWeight: 'bold', fontFamily: 'monospace' },

  /* Countdown */
  countdownText: { fontSize: 72, fontWeight: 'bold' },

  /* Scroll Vertical */
  scrollVArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  scrollVLine: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },

  /* Scroll Horizontal */
  scrollHArea: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  scrollHRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  scrollHWord: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },

  /* Progress */
  progressSection: { paddingHorizontal: 24, alignItems: 'center' },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
  },
  progressText: { fontSize: 12 },
  progressSlider: { width: '100%', height: 30 },

  /* Controls: three-column layout so play stays centered */
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 16,
    paddingHorizontal: 12,
  },
  controlsEdge: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsCenter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  wpmBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCol: {
    alignItems: 'center',
    gap: 2,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playBtnIcon: { margin: 0 },
  wpmLabel: { fontSize: 13, fontWeight: '600' },

  /* Bottom sheet */
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 24,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  sheetHandle: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  sheetScroll: {
    paddingHorizontal: 20,
  },
  sheetSection: {
    marginBottom: 16,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  sheetLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  sheetSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  sheetSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetSlider: {
    flex: 1,
    height: 36,
  },
  sheetValue: {
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 36,
    textAlign: 'center',
  },
});
