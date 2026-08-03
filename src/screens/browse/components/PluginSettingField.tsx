import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { TextInput } from 'react-native-paper';

import { Checkbox, SelectField, SwitchItem } from '@components';
import { PluginSetting } from '@plugins/types';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';

import { PluginSettingValue } from '../hooks/usePluginSettings';

interface PluginSettingFieldProps {
  onChange: (key: string, value: PluginSettingValue) => void;
  onChangeText: (key: string, value: string) => void;
  onEndTextEditing: (key: string, value: string) => void;
  setting: PluginSetting;
  settingKey: string;
  theme: ThemeColors;
  value: PluginSettingValue | undefined;
}

const toggleArrayValue = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter(current => current !== value)
    : [...values, value];

export const PluginSettingField = memo(
  ({
    onChange,
    onChangeText,
    onEndTextEditing,
    setting,
    settingKey,
    theme,
    value,
  }: PluginSettingFieldProps) => {
    const [expanded, setExpanded] = useState(false);

    if (setting.type === 'Switch') {
      return (
        <SwitchItem
          label={setting.label}
          value={Boolean(value)}
          onPress={() => onChange(settingKey, !value)}
          theme={theme}
        />
      );
    }

    if (setting.type === 'Select') {
      return (
        <View style={styles.setting}>
          <SelectField
            label={setting.label}
            value={typeof value === 'string' ? value : ''}
            options={setting.options}
            onValueChange={nextValue => onChange(settingKey, nextValue)}
            theme={theme}
          />
        </View>
      );
    }

    if (setting.type === 'CheckboxGroup') {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <View>
          <Pressable
            accessibilityLabel={getString('browseScreen.togglePluginSetting', {
              name: setting.label,
            })}
            accessibilityRole="button"
            style={styles.checkboxHeader}
            android_ripple={{ color: theme.rippleColor }}
            onPress={() => setExpanded(current => !current)}
          >
            <Text style={{ color: theme.onSurface }}>{setting.label}</Text>
            <MaterialCommunityIcons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              color={theme.onSurface}
              size={24}
            />
          </Pressable>
          {expanded
            ? setting.options.map(option => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  status={selectedValues.includes(option.value)}
                  onPress={() =>
                    onChange(
                      settingKey,
                      toggleArrayValue(selectedValues, option.value),
                    )
                  }
                  theme={theme}
                />
              ))
            : null}
        </View>
      );
    }

    return (
      <TextInput
        accessibilityLabel={setting.label}
        label={setting.label}
        mode="outlined"
        style={styles.setting}
        value={String(value ?? '')}
        onChangeText={nextValue => onChangeText(settingKey, nextValue)}
        onEndEditing={({ nativeEvent }) =>
          onEndTextEditing(settingKey, nativeEvent.text)
        }
        textColor={theme.onSurface}
        theme={{
          colors: {
            background: theme.surface,
            outline: theme.outline,
            primary: theme.primary,
          },
        }}
      />
    );
  },
);

const styles = StyleSheet.create({
  checkboxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  setting: {
    marginTop: 12,
  },
});
