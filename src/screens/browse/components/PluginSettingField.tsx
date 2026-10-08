import { memo, useState } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  AppIcon,
  AppText,
  Checkbox,
  Menu,
  SwitchItem,
  TextInput,
} from '@components';
import { getString } from '@i18n/translations';
import { PluginSetting } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import ArrowDropDownIcon from '@expo/material-symbols/arrow_drop_down.xml';
import KeyboardArrowDownIcon from '@expo/material-symbols/keyboard_arrow_down.xml';
import KeyboardArrowUpIcon from '@expo/material-symbols/keyboard_arrow_up.xml';

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
      const selectedOption = setting.options.find(
        option => option.value === value,
      );

      return (
        <Box modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
          <Menu
            visible={expanded}
            anchor={
              <Box
                modifiers={[fillMaxWidth(), clickable(() => setExpanded(true))]}
              >
                <TextInput
                  label={setting.label}
                  value={selectedOption?.label ?? ''}
                  onChangeText={() => undefined}
                  disabled
                  trailing={
                    <AppIcon
                      source={ArrowDropDownIcon}
                      label={getString('browseScreen.editPluginSetting', {
                        name: setting.label,
                      })}
                    />
                  }
                />
              </Box>
            }
            onDismiss={() => setExpanded(false)}
          >
            {setting.options.map(option => (
              <Menu.Item
                key={option.value}
                title={option.label}
                onPress={() => {
                  onChange(settingKey, option.value);
                  setExpanded(false);
                }}
              />
            ))}
          </Menu>
        </Box>
      );
    }

    if (setting.type === 'CheckboxGroup') {
      const selectedValues = Array.isArray(value) ? value : [];

      return (
        <Column modifiers={[fillMaxWidth()]}>
          <Row
            verticalAlignment="center"
            modifiers={[
              fillMaxWidth(),
              clickable(() => setExpanded(current => !current)),
              padding(16, 12, 16, 12),
            ]}
          >
            <AppText variant="bodyLarge" modifiers={[weight(1)]}>
              {setting.label}
            </AppText>
            <AppIcon
              source={expanded ? KeyboardArrowUpIcon : KeyboardArrowDownIcon}
              tint={theme.onSurface}
              label={getString('browseScreen.togglePluginSetting', {
                name: setting.label,
              })}
            />
          </Row>
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
        </Column>
      );
    }

    return (
      <Box modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
        <TextInput
          label={setting.label}
          value={String(value ?? '')}
          singleLine
          onChangeText={nextValue => {
            onChangeText(settingKey, nextValue);
            // A Compose field reports no end of editing, so each change is saved.
            onEndTextEditing(settingKey, nextValue);
          }}
        />
      </Box>
    );
  },
);
