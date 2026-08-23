import React from 'react';
import { View } from 'react-native';

import { Button, Slider } from '@components';
import { useChapterContext } from '@screens/reader/ChapterContext';
import { getString } from '@i18n/translations';
import {
  useRsvpSettings,
  RSVP_WPM_BOUNDS,
} from '@screens/reader/rsvp/useRsvpSettings';

const RsvpTab: React.FC = () => {
  const { webViewRef } = useChapterContext();
  const { rsvpSettings, setRsvp } = useRsvpSettings();

  const send = (command: string, arg?: number) => {
    webViewRef.current?.injectJavaScript(
      `window.rsvp?.${command}?.${arg !== undefined ? arg : ''}); true;`,
    );
  };

  const cycleChunk = () => {
    const next = (rsvpSettings.chunkSize % 3) + 1;
    setRsvp({ chunkSize: next });
    send('setChunkSize', next);
  };

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
      <Button
        title={getString('readerScreen.rsvpStart')}
        onPress={() => send('start')}
      />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Button title="⏸" onPress={() => send('pause')} />
        <Button title="▶" onPress={() => send('resume')} />
        <Button
          title={getString('readerScreen.rsvpExit')}
          onPress={() => send('exit')}
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <Button
          title={getString('readerScreen.rsvpChunkSize', {
            size: rsvpSettings.chunkSize,
          })}
          onPress={cycleChunk}
        />
      </View>
      <View style={{ marginTop: 16 }}>
        <Slider
          value={rsvpSettings.wpm}
          max={RSVP_WPM_BOUNDS.max}
          min={RSVP_WPM_BOUNDS.min}
          step={25}
          onValueChange={value => {
            const wpm = Math.round(value);
            setRsvp({ wpm });
            send('setWpm', wpm);
          }}
        />
      </View>
    </View>
  );
};

export default RsvpTab;
