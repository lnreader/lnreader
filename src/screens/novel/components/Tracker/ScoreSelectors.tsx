import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { RadioButton } from '@components';
import { useTheme } from '@hooks/persisted';
import {
  getAniListScoreFormatting,
  getKitsuScoreFormatting,
  getMyAnimeListScoreLabel,
} from './constants';
import { ThemeColors } from '@theme/types';
import {
  AniListScoreSelectorProps,
  ScoreFormat,
  ScoreSelectorProps,
} from './types';

interface ScoreRadioListProps {
  count: number;
  label: (score: number) => string;
  selected: number;
  onSelect: (score: number) => void;
  theme: ThemeColors;
}

// Virtualized so long scales (AniList's 101 points) don't mount a native
// radio for every row at once.
const ScoreRadioList: React.FC<ScoreRadioListProps> = ({
  count,
  label,
  selected,
  onSelect,
  theme,
}) => {
  const scores = useMemo(
    () => Array.from({ length: count }, (_, i) => i),
    [count],
  );

  return (
    <FlatList
      data={scores}
      extraData={selected}
      keyExtractor={String}
      renderItem={({ item: score }) => (
        <RadioButton
          label={label(score)}
          status={selected === score}
          onPress={() => onSelect(score)}
          style={styles.radio}
          labelStyle={styles.radioLabel}
          theme={theme}
        />
      )}
    />
  );
};

export const MyAnimeListScoreSelector: React.FC<ScoreSelectorProps> = ({
  trackItem,
  onUpdateScore,
}) => {
  const theme = useTheme();
  const scores = Array.from({ length: 11 }, (_, i) => i);

  return (
    <View style={styles.list}>
      {scores.map(score => (
        <RadioButton
          key={score}
          label={getMyAnimeListScoreLabel(score)}
          status={trackItem.score === score}
          onPress={() => onUpdateScore(score)}
          style={styles.radio}
          labelStyle={styles.radioLabel}
          theme={theme}
        />
      ))}
    </View>
  );
};

export const MangaUpdatesScoreSelector: React.FC<ScoreSelectorProps> = ({
  trackItem,
  onUpdateScore,
}) => {
  const theme = useTheme();
  const [scoreText, setScoreText] = useState(
    trackItem.score === 0 ? '' : trackItem.score.toString(),
  );
  const [error, setError] = useState<string | undefined>();

  const handleChangeText = (text: string) => {
    setScoreText(text);

    if (!text) {
      setError(undefined);
      onUpdateScore(0);
      return;
    }

    const score = parseFloat(text);

    if (isNaN(score)) {
      setError('Invalid number');
      return;
    }

    if (score < 0 || score > 10) {
      setError('Score must be between 0 and 10');
      return;
    }

    setError(undefined);
    onUpdateScore(score);
  };

  return (
    <View>
      <Text style={[styles.helperText, { color: theme.onSurfaceVariant }]}>
        Enter a score between 0 and 10 (decimals allowed, e.g., 7.5)
      </Text>
      <TextInput
        value={scoreText}
        onChangeText={handleChangeText}
        mode="outlined"
        keyboardType="decimal-pad"
        placeholder="0.0 - 10.0"
        error={!!error}
        theme={{
          colors: {
            primary: theme.primary,
            placeholder: theme.outline,
            text: theme.onSurface,
            background: 'transparent',
          },
        }}
        underlineColor={theme.outline}
        style={styles.textInput}
      />
      {error && (
        <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
      )}
    </View>
  );
};

export const AniListScoreSelector: React.FC<AniListScoreSelectorProps> = ({
  trackItem,
  onUpdateScore,
  scoreFormat,
}) => {
  const theme = useTheme();
  const formatting = getAniListScoreFormatting(scoreFormat as ScoreFormat);
  return (
    <ScoreRadioList
      count={formatting.count}
      label={formatting.label}
      selected={trackItem.score}
      onSelect={onUpdateScore}
      theme={theme}
    />
  );
};

/**
 * Kitsu uses a 0.5-10 scale (displayed as half-increments).
 * Score values: 0 (no score), 1 (0.5), 2 (1.0), 3 (1.5), ... 20 (10.0)
 */
export const KitsuScoreSelector: React.FC<ScoreSelectorProps> = ({
  trackItem,
  onUpdateScore,
}) => {
  const theme = useTheme();
  const formatting = getKitsuScoreFormatting();
  return (
    <ScoreRadioList
      count={formatting.count}
      label={formatting.label}
      selected={trackItem.score}
      onSelect={onUpdateScore}
      theme={theme}
    />
  );
};

const styles = StyleSheet.create({
  errorText: {
    fontSize: 12,
    marginTop: 4,
  },
  guideText: {
    fontSize: 13,
    lineHeight: 20,
  },
  guideTitle: {
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 8,
  },
  list: {
    marginHorizontal: -24,
  },
  radio: {
    paddingHorizontal: 24,
    paddingVertical: 2,
  },
  radioLabel: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
});
