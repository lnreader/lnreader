import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput, overlay } from 'react-native-paper';
import { Menu } from '@components/index';
import { ThemeColors } from '@theme/types';
import { FilterTypes, Filters } from '@plugins/types/filterTypes';
import { useBoolean } from '@hooks/index';

interface FilterPickerProps {
  theme: ThemeColors;
  filter: Filters[string] & { type: FilterTypes.Picker };
  value: string;
  onSelect: (val: string) => void;
  screenWidth: number;
}

export default function FilterPicker({
  theme,
  filter,
  value,
  onSelect,
  screenWidth,
}: FilterPickerProps) {
  const {
    value: isVisible,
    toggle: toggleVisible,
    setFalse: closeVisible,
  } = useBoolean();

  const label = filter.options.find(opt => opt.value === value)?.label || '';

  return (
    <View style={styles.pickerContainer}>
      <Menu
        fullWidth
        visible={isVisible}
        contentStyle={{ backgroundColor: theme.surfaceVariant }}
        anchor={
          <Pressable
            style={{ width: screenWidth - 48 }}
            onPress={toggleVisible}
          >
            <TextInput
              mode="outlined"
              label={
                <Text
                  style={{
                    color: isVisible ? theme.primary : theme.onSurface,
                    backgroundColor: overlay(2, theme.surface),
                  }}
                >
                  {` ${filter.label} `}
                </Text>
              }
              value={label}
              editable={false}
              theme={{ colors: { background: 'transparent' } }}
              outlineColor={isVisible ? theme.primary : theme.onSurface}
              textColor={isVisible ? theme.primary : theme.onSurface}
            />
          </Pressable>
        }
        onDismiss={closeVisible}
      >
        {filter.options.map(val => (
          <Menu.Item
            key={val.label}
            title={val.label}
            titleStyle={{ color: theme.onSurfaceVariant }}
            onPress={() => {
              onSelect(val.value);
              closeVisible();
            }}
          />
        ))}
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  pickerContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
});
