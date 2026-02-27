import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, IconButton } from 'react-native-paper';

import { useTheme } from '@hooks/persisted';
import { useTTS } from '../tts/hooks';

interface TTSPlayerBarProps {
  /** Whether the player bar should be visible */
  visible: boolean;
  /** Text that is currently being spoken */
  currentText?: string;
}

/**
 * TTS Player Bar component
 * Fixed position at bottom of screen when TTS is active
 * Shows: current voice name, play/pause button, stop button
 */
const TTSPlayerBar: React.FC<TTSPlayerBarProps> = ({
  visible,
  currentText = '',
}) => {
  const theme = useTheme();
  const { isPlaying, isPaused, pause, resume, stop, currentVoice } = useTTS();

  if (!visible) {
    return null;
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    }
  };

  const handleStop = () => {
    stop();
  };

  // Truncate text for display
  const displayText =
    currentText.length > 50
      ? currentText.substring(0, 50) + '...'
      : currentText;

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.content}>
        <View style={styles.textContainer}>
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={[styles.voiceName, { color: theme.onSurface }]}
          >
            {currentVoice?.name || 'No voice selected'}
          </Text>
          {displayText ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.onSurfaceVariant }}
            >
              {displayText}
            </Text>
          ) : null}
        </View>

        <View style={styles.controls}>
          <IconButton
            icon={isPlaying ? 'pause' : 'play'}
            iconColor={theme.primary}
            size={28}
            onPress={handlePlayPause}
          />
          <IconButton
            icon="stop"
            iconColor={theme.error}
            size={24}
            onPress={handleStop}
          />
        </View>
      </View>
    </View>
  );
};

export default TTSPlayerBar;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  voiceName: {
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
