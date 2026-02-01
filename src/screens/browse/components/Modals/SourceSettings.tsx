import React, { useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput, overlay } from 'react-native-paper';
import { Button, Modal, SwitchItem, Checkbox, Menu } from '@components/index';
import { useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { Storage } from '@plugins/helpers/storage';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { PluginSettings } from '@plugins/types';

interface SourceSettingsModal {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  description?: string;
  pluginId: string;
  pluginSettings?: PluginSettings;
}

const SourceSettingsModal: React.FC<SourceSettingsModal> = ({
  onDismiss,
  visible,
  title,
  description,
  pluginId,
  pluginSettings,
}) => {
  const theme = useTheme();

  const [formValues, setFormValues] = useState<
    Record<string, string | boolean | string[]>
  >({});
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (pluginSettings) {
      const storage = new Storage(pluginId);

      const loadFormValues = async () => {
        const loadedValues = await Promise.all(
          Object.keys(pluginSettings).map(async key => {
            const storedValue = await storage.get(key);
            return {
              key,
              value:
                storedValue !== null ? storedValue : pluginSettings[key].value,
            };
          }),
        );

        const initialFormValues = Object.fromEntries(
          loadedValues.map(({ key, value }) => [key, value]),
        );

        setFormValues(initialFormValues);
      };

      loadFormValues();
    }
  }, [pluginSettings, pluginId]);

  const handleChange = (key: string, value: string | boolean | string[]) => {
    setFormValues(prevValues => ({
      ...prevValues,
      [key]: value,
    }));
  };

  const insertOrRemoveIntoArray = (array: string[], val: string): string[] =>
    array.indexOf(val) > -1
      ? array.filter(ele => ele !== val)
      : [...array, val];

  const handleSave = () => {
    const storage = new Storage(pluginId);
    Object.entries(formValues).forEach(([key, value]) => {
      storage.set(key, value);
    });
    onDismiss();
  };

  if (!pluginSettings || Object.keys(pluginSettings).length === 0) {
    return (
      <Modal visible={visible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {title}
        </Text>
        <Text style={{ color: theme.onSurfaceVariant }}>
          {description || 'No settings available.'}
        </Text>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} onDismiss={onDismiss}>
      <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
        {title}
      </Text>
      <Text style={{ color: theme.onSurfaceVariant }}>{description}</Text>
      {Object.entries(pluginSettings).map(([key, setting]) => {
        if (setting?.type === 'Switch') {
          return (
            <SwitchItem
              key={key}
              value={!!formValues[key]}
              label={setting.label}
              onPress={() => handleChange(key, !formValues[key])}
              theme={theme}
            />
          );
        }
        if (setting?.type === 'Select') {
          const selectedOption = setting.options.find(
            opt => opt.value === formValues[key],
          );
          const isMenuOpen = !!openMenus[key];
          return (
            <View key={key} style={styles.selectContainer}>
              <Menu
                fullWidth
                visible={isMenuOpen}
                contentStyle={{ backgroundColor: theme.surfaceVariant }}
                anchor={
                  <Pressable
                    onPress={() =>
                      setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }))
                    }
                  >
                    <TextInput
                      mode="outlined"
                      label={
                        <Text
                          style={{
                            color: isMenuOpen ? theme.primary : theme.onSurface,
                            backgroundColor: overlay(2, theme.surface),
                          }}
                        >
                          {` ${setting.label} `}
                        </Text>
                      }
                      value={selectedOption?.label || ''}
                      editable={false}
                      theme={{ colors: { background: 'transparent' } }}
                      outlineColor={
                        isMenuOpen ? theme.primary : theme.onSurface
                      }
                      textColor={isMenuOpen ? theme.primary : theme.onSurface}
                      pointerEvents="none"
                    />
                  </Pressable>
                }
                onDismiss={() =>
                  setOpenMenus(prev => ({ ...prev, [key]: false }))
                }
              >
                {setting.options.map(option => (
                  <Menu.Item
                    key={option.value}
                    title={option.label}
                    titleStyle={{ color: theme.onSurfaceVariant }}
                    onPress={() => {
                      handleChange(key, option.value);
                      setOpenMenus(prev => ({ ...prev, [key]: false }));
                    }}
                  />
                ))}
              </Menu>
            </View>
          );
        }
        if (setting?.type === 'CheckboxGroup') {
          const value = (formValues[key] || []) as string[];
          const isExpanded = !!openMenus[key];
          return (
            <View key={key}>
              <Pressable
                style={styles.checkboxHeader}
                onPress={() =>
                  setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }))
                }
                android_ripple={{ color: theme.rippleColor }}
              >
                <Text style={{ color: theme.onSurfaceVariant }}>
                  {setting.label}
                </Text>
                <MaterialCommunityIcons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  color={theme.onSurface}
                  size={24}
                />
              </Pressable>
              {isExpanded &&
                setting.options.map(option => (
                  <Checkbox
                    key={option.value}
                    label={option.label}
                    theme={theme}
                    status={value.includes(option.value)}
                    onPress={() =>
                      handleChange(
                        key,
                        insertOrRemoveIntoArray(value, option.value),
                      )
                    }
                  />
                ))}
            </View>
          );
        }
        return (
          <TextInput
            key={key}
            mode="outlined"
            label={setting.label}
            value={(formValues[key] ?? '') as string}
            onChangeText={value => handleChange(key, value)}
            placeholder={`Enter ${setting.label}`}
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
          />
        );
      })}
      <View style={styles.customCSSButtons}>
        <Button
          onPress={handleSave}
          style={styles.button}
          title={getString('common.save')}
          mode="contained"
        />
      </View>
    </Modal>
  );
};

export default SourceSettingsModal;

const styles = StyleSheet.create({
  button: {
    flex: 1,
    marginHorizontal: 8,
    marginTop: 16,
  },
  customCSSButtons: {
    flexDirection: 'row',
  },
  modalTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
  textInput: {
    borderRadius: 14,
    fontSize: 16,
    height: 50,
    marginBottom: 8,
    marginTop: 16,
  },
  selectContainer: {
    marginVertical: 8,
  },
  checkboxHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});
