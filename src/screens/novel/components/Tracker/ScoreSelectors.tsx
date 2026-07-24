import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from 'react-native-paper';

import { RadioButton, RadioButtonGroup } from '@components/RadioButton';
import { useTheme } from '@hooks/persisted';
import {
  getAniListScoreFormatting,
  getKitsuScoreFormatting,
  getMyAnimeListScoreLabel,
} from './constants';
import {
  AniListScoreSelectorProps,
  ScoreFormat,
  ScoreSelectorProps,
} from './types';

export const MyAnimeListScoreSelector: React.FC<ScoreSelectorProps> = ({
  trackItem,
  onUpdateScore,
}) => {
  const theme = useTheme();
  const scores = Array.from({ length: 11 }, (_, i) => i);

  const handleValueChange = (value: string) => {
    onUpdateScore(Number(value));
  };

  return (
    <RadioButtonGroup onValueChange={handleValueChange} value={trackItem.score}>
      {scores.map(score => (
        <RadioButton
          key={score}
          value={score}
          label={getMyAnimeListScoreLabel(score)}
          theme={theme}
        />
      ))}
    </RadioButtonGroup>
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
  const scores = Array.from({ length: formatting.count }, (_, i) => i);

  const handleValueChange = (value: string) => {
    onUpdateScore(Number(value));
  };

  return (
    <ScrollView>
      <RadioButtonGroup
        onValueChange={handleValueChange}
        value={trackItem.score}
      >
        {scores.map(score => (
          <RadioButton
            key={score}
            value={score}
            label={formatting.label(score)}
            theme={theme}
          />
        ))}
      </RadioButtonGroup>
    </ScrollView>
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
  const scores = Array.from({ length: formatting.count }, (_, i) => i);

  const handleValueChange = (value: string) => {
    onUpdateScore(Number(value));
  };

  return (
    <ScrollView>
      <RadioButtonGroup
        onValueChange={handleValueChange}
        value={trackItem.score}
      >
        {scores.map(score => (
          <RadioButton
            key={score}
            value={score}
            label={formatting.label(score)}
            theme={theme}
          />
        ))}
      </RadioButtonGroup>
    </ScrollView>
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
  helperText: {
    fontSize: 13,
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
});
