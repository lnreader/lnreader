import React, { useState } from 'react';
import { FlowRow } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { Dialog } from '../Dialog/Dialog';
import { ThemeColors } from '../../theme/types';
import { getString } from '@i18n/translations';
import AppText from '../AppText/AppText';
import TextInput from '../TextInput';
import { ColorSwatch } from '../ColorPreferenceItem/ColorPreferenceItem';

interface ColorPickerModalProps {
  visible: boolean;
  title: string;
  color: string;
  onSubmit: (val: string | undefined) => void;
  closeModal: () => void;
  theme: ThemeColors;
  showAccentColors?: boolean;
}

const ColorPickerModal: React.FC<ColorPickerModalProps> = ({
  theme,
  color,
  title,
  onSubmit,
  closeModal,
  visible,
  showAccentColors,
}) => {
  const [text, setText] = useState<string>(color);
  const [error, setError] = useState<string | null>();

  const onDismiss = () => {
    closeModal();
    if (error) {
      setText(color);
    }
    setError(null);
  };

  const onChangeText = (txt: string) => setText(txt);

  const onSubmitEditing = () => {
    const re = /^#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})$/i;

    if (text.match(re)) {
      onSubmit(text);
      closeModal();
    } else {
      setError('Enter a valid hex color code');
    }
  };
  const onReset = () => {
    onSubmit(undefined);
    closeModal();
  };

  const accentColors = [
    '#EF5350',
    '#EC407A',
    '#AB47BC',
    '#7E57C2',
    '#5C6BC0',
    '#42A5F5',
    '#29B6FC',
    '#26C6DA',
    '#26A69A',
    '#66BB6A',
    '#9CCC65',
    '#D4E157',
    '#FFEE58',
    '#FFCA28',
    '#FFA726',
    '#FF7043',
    '#8D6E63',
    '#BDBDBD',
    '#78909C',
    '#000000',
  ];

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>{title}</Dialog.Title>
      {showAccentColors ? (
        <Dialog.Content>
          <FlowRow
            horizontalArrangement={{ spacedBy: 12 }}
            verticalArrangement={{ spacedBy: 12 }}
            modifiers={[fillMaxWidth()]}
          >
            {accentColors.map(item => (
              <ColorSwatch
                key={item}
                color={item}
                diameter={40}
                selected={item.toLowerCase() === color.toLowerCase()}
                onPress={() => {
                  onSubmit(item);
                  closeModal();
                }}
                theme={theme}
              />
            ))}
          </FlowRow>
        </Dialog.Content>
      ) : null}
      <Dialog.Content>
        <TextInput
          value={text}
          placeholder="Hex Color Code (E.g. #3399FF)"
          onChangeText={onChangeText}
          onSubmit={onSubmitEditing}
          keyboardType="ascii"
          singleLine
          error={error}
        />
        {error ? (
          <AppText
            variant="bodySmall"
            color={theme.error}
            modifiers={[padding(0, 8, 0, 0)]}
          >
            {error}
          </AppText>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action title={getString('common.reset')} onPress={onReset} />
        <Dialog.Action
          title={getString('common.save')}
          onPress={onSubmitEditing}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ColorPickerModal;
