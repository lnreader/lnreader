import React, { useState } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { AppText, TextInput } from '@components';
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
    <Column modifiers={[fillMaxWidth()]}>
      <AppText
        variant="bodySmall"
        color={theme.onSurfaceVariant}
        modifiers={[padding(0, 0, 0, 16)]}
      >
        Enter a score between 0 and 10 (decimals allowed, e.g., 7.5)
      </AppText>
      <TextInput
        value={scoreText}
        onChangeText={handleChangeText}
        outlined
        keyboardType="decimal"
        placeholder="0.0 - 10.0"
        error={error}
      />
    </Column>
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
    <>
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
    </>
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
    <>
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
    </>
  );
};
