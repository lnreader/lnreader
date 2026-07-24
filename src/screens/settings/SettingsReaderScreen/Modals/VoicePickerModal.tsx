import React, { useMemo, useState } from 'react';

import { TextInput, ActivityIndicator } from 'react-native-paper';
import { Dialog, RadioButton } from '@components';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { Voice } from 'expo-speech';
import { LegendList } from '@legendapp/list/react-native';
import { StyleSheet } from 'react-native';
import { getString } from '@i18n/translations';

interface VoicePickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  voices: Voice[];
}

const VoicePickerModal: React.FC<VoicePickerModalProps> = ({
  onDismiss,
  visible,
  voices,
}) => {
  const theme = useTheme();
  const [searchText, setSearchText] = useState('');
  const { setChapterReaderSettings, tts } = useChapterReaderSettings();
  const filteredVoices = useMemo(() => {
    const normalizedSearch = searchText.toLocaleLowerCase();
    return normalizedSearch
      ? voices.filter(voice =>
          voice.name.toLocaleLowerCase().includes(normalizedSearch),
        )
      : voices;
  }, [searchText, voices]);

  return (
    <Dialog.Root
      visible={visible}
      onDismiss={onDismiss}
      surfaceStyle={styles.containerStyle}
    >
      <Dialog.Title>Select voice</Dialog.Title>
      <Dialog.Content>
        <TextInput
          mode="outlined"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
          onChangeText={setSearchText}
          value={searchText}
          placeholder="Search voice"
        />
      </Dialog.Content>
      <Dialog.ScrollArea style={styles.list}>
        <LegendList
          recycleItems
          data={filteredVoices}
          extraData={tts?.voice}
          renderItem={({ item }) => (
            <RadioButton
              key={item.identifier}
              status={item.identifier === tts?.voice?.identifier}
              onPress={() =>
                setChapterReaderSettings({ tts: { ...tts, voice: item } })
              }
              label={item.name + ` (${item.language})`}
              labelStyle={{ fontFamily: item.name }}
              theme={theme}
            />
          )}
          keyExtractor={(item, index) =>
            item.identifier || `voice_${index}_${item.name}`
          }
          estimatedItemSize={64}
          ListEmptyComponent={
            <ActivityIndicator
              size={24}
              style={styles.marginTop}
              color={theme.primary}
            />
          }
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss}>
          {getString('common.ok')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default VoicePickerModal;

const styles = StyleSheet.create({
  containerStyle: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  marginTop: { marginTop: 16 },
});
