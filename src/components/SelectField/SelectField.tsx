import { useEffect, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import {
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  OutlinedTextField,
  Text as ComposeText,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { menuAnchor } from '@expo/ui/jetpack-compose/modifiers';

import { ExpoHost } from '@components/ExpoUI';
import { ThemeColors } from '@theme/types';

export interface SelectFieldOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SelectFieldProps<T extends string = string> {
  label: string;
  value: T;
  options: SelectFieldOption<T>[];
  onValueChange: (value: T) => void;
  theme: ThemeColors;
  style?: StyleProp<ViewStyle>;
}

/**
 * LNReader's picker-style field, backed by Compose's
 * `ExposedDropdownMenuBox`/`TextField`/`ExposedDropdownMenu`. The text field
 * is read-only and only displays the selected option; it never receives
 * keyboard input, matching the previous Menu+TextInput anchor pattern.
 */
export function SelectField<T extends string = string>({
  label,
  value,
  options,
  onValueChange,
  theme,
  style,
}: SelectFieldProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const selectedLabel =
    options.find(option => option.value === value)?.label ?? '';
  const fieldValue = useNativeState(selectedLabel);

  useEffect(() => {
    fieldValue.set(selectedLabel);
  }, [fieldValue, selectedLabel]);

  return (
    <ExpoHost theme={theme} style={style} matchContents={{ vertical: true }}>
      <ExposedDropdownMenuBox
        expanded={expanded}
        onExpandedChange={setExpanded}
      >
        <OutlinedTextField
          value={fieldValue}
          readOnly
          modifiers={[menuAnchor()]}
          colors={{
            unfocusedIndicatorColor: theme.outline,
            focusedIndicatorColor: theme.primary,
            unfocusedTextColor: theme.onSurface,
            focusedTextColor: theme.onSurface,
            unfocusedLabelColor: theme.onSurfaceVariant,
            focusedLabelColor: theme.primary,
          }}
        >
          <OutlinedTextField.Label>
            <ComposeText>{label}</ComposeText>
          </OutlinedTextField.Label>
        </OutlinedTextField>
        <ExposedDropdownMenu
          expanded={expanded}
          onDismissRequest={() => setExpanded(false)}
        >
          {options.map(option => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => {
                onValueChange(option.value);
                setExpanded(false);
              }}
              elementColors={{ textColor: theme.onSurface }}
            >
              <DropdownMenuItem.Text>
                <ComposeText>{option.label}</ComposeText>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </ExposedDropdownMenu>
      </ExposedDropdownMenuBox>
    </ExpoHost>
  );
}
