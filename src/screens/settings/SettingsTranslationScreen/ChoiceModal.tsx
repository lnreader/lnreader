import { FlatList, StyleSheet } from 'react-native';

import { Dialog, RadioButton } from '@components';
import { useTheme } from '@hooks/persisted';

export interface Choice<T extends string> {
  value: T;
  label: string;
}

interface ChoiceModalProps<T extends string> {
  title: string;
  choices: Choice<T>[];
  selected: T;
  visible: boolean;
  onDismiss: () => void;
  onSelect: (value: T) => void;
}

/** Radio picker shared by the provider and target-language rows. */
const ChoiceModal = <T extends string>({
  title,
  choices,
  selected,
  visible,
  onDismiss,
  onSelect,
}: ChoiceModalProps<T>) => {
  const theme = useTheme();

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.ScrollArea>
        <FlatList
          data={choices}
          keyExtractor={choice => choice.value}
          style={styles.list}
          renderItem={({ item }) => (
            <RadioButton
              label={item.label}
              status={item.value === selected}
              onPress={() => {
                onSelect(item.value);
                onDismiss();
              }}
              theme={theme}
            />
          )}
        />
      </Dialog.ScrollArea>
    </Dialog.Root>
  );
};

export default ChoiceModal;

const styles = StyleSheet.create({
  list: {
    maxHeight: 380,
  },
});
