import * as Notifications from 'expo-notifications';

const TTS_NOTIFICATION_ID = 'tts-control';

// ---------- lightweight event bus for TTS actions ----------
type TTSActionListener = (action: string) => void;
const listeners = new Set<TTSActionListener>();

export const emitTTSAction = (action: string) => {
  listeners.forEach(fn => fn(action));
};

export const subscribeTTSAction = (fn: TTSActionListener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
// -----------------------------------------------------------

export interface TTSNotificationData {
  novelName: string;
  chapterName: string;
  isPlaying: boolean;
}

/**
 * Show or update the persistent TTS notification.
 *
 * Key fixes vs the old implementation:
 *  – trigger uses `{ channelId }` (ChannelAwareTriggerInput) so the
 *    notification appears *immediately* on the correct channel instead of
 *    being delayed by 1 second.
 *  – Category buttons are updated before scheduling so Play/Pause label
 *    always matches the actual state.
 *  – A single function replaces the previously‐duplicated
 *    showTTSNotification / updateTTSNotification.
 */
export const showTTSNotification = async (data: TTSNotificationData) => {
  try {
    // Update category so Play/Pause label matches current state
    await Notifications.setNotificationCategoryAsync('TTS_CONTROLS', [
      {
        identifier: 'TTS_PLAY_PAUSE',
        buttonTitle: data.isPlaying ? '⏸️ Pause' : '▶️ Play',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'TTS_STOP',
        buttonTitle: '⏹️ Stop',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'TTS_NEXT',
        buttonTitle: '⏭️ Next',
        options: { opensAppToForeground: false },
      },
    ]);

    await Notifications.scheduleNotificationAsync({
      identifier: TTS_NOTIFICATION_ID,
      content: {
        title: data.novelName,
        subtitle: data.chapterName,
        body: data.isPlaying ? '▶ Playing' : '⏸ Paused',
        categoryIdentifier: 'TTS_CONTROLS',
        sticky: true,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      // ChannelAwareTriggerInput → immediate delivery on the right channel
      trigger: { channelId: 'tts-controls' },
    });
  } catch (e) {
    console.warn('TTS notification error:', e);
  }
};

/** Alias kept for call-site readability – same behaviour. */
export const updateTTSNotification = showTTSNotification;

export const dismissTTSNotification = async () => {
  try {
    await Notifications.dismissNotificationAsync(TTS_NOTIFICATION_ID);
  } catch {
    // notification may already be dismissed – safe to ignore
  }
};
