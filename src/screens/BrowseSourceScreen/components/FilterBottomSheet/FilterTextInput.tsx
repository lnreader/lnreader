import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FilterTypes, ValueOfFilter } from '@plugins/types/filterTypes';
import { overlay, TextInput } from 'react-native-paper';
import { ThemeColors } from '@theme/types';

type T = ValueOfFilter<FilterTypes.TextInput>;
type TextInputProps = {
  value: T;
  setFilter: (arg: T) => void;
  width: number;
  label: string;
  theme: ThemeColors;
};

export default function FilterTextInput({
  value,
  setFilter,
  theme,
  width,
  label,
}: TextInputProps) {
  return (
    <View style={styles.textContainer}>
      <TextInput
        style={[styles.flex, { width }]}
        mode="outlined"
        label={
          <Text
            style={[
              {
                color: theme.onSurface,
                backgroundColor: overlay(2, theme.surface),
              },
            ]}
          >
            {` ${label} `}
          </Text>
        }
        defaultValue={value as ValueOfFilter<FilterTypes.TextInput>}
        theme={{ colors: { ...theme, background: 'transparent' } }}
        outlineColor={theme.onSurface}
        textColor={theme.onSurface}
        onChangeText={setFilter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  textContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
});
