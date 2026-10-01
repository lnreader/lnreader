import { type ReactNode } from 'react';
import {
  OutlinedTextField,
  TextField,
  type TextFieldKeyboardType,
  type TextFieldImeAction,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  testID,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';
import { useSyncedTextState } from '../../hooks/common/useSyncedTextState';

export interface TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  supportingText?: string;
  error?: string | null;
  leadingIcon?: IconSource;
  trailing?: ReactNode;
  singleLine?: boolean;
  minLines?: number;
  maxLines?: number;
  keyboardType?: TextFieldKeyboardType;
  imeAction?: TextFieldImeAction;
  onSubmit?: (text: string) => void;
  secure?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  monospace?: boolean;
  outlined?: boolean;
  testID?: string;
  modifiers?: ModifierConfig[];
}

const TextInput = ({
  value,
  onChangeText,
  label,
  placeholder,
  supportingText,
  error,
  leadingIcon,
  trailing,
  singleLine = true,
  minLines,
  maxLines,
  keyboardType = 'text',
  imeAction,
  onSubmit,
  secure,
  disabled,
  autoFocus,
  monospace,
  outlined,
  testID: fieldTestID,
  modifiers,
}: TextInputProps) => {
  const theme = useTheme();
  const text = useSyncedTextState(value);
  const Field = outlined ? OutlinedTextField : TextField;
  const submit = onSubmit
    ? (submitted: string) => onSubmit(submitted)
    : undefined;
  const helper = error || supportingText;

  return (
    <Field
      value={text}
      onValueChange={onChangeText}
      enabled={!disabled}
      autoFocus={autoFocus}
      singleLine={singleLine}
      minLines={minLines}
      maxLines={maxLines}
      isError={Boolean(error)}
      visualTransformation={secure ? 'password' : 'none'}
      keyboardOptions={{
        keyboardType,
        imeAction: imeAction ?? (singleLine ? 'done' : 'default'),
      }}
      keyboardActions={
        submit
          ? { onDone: submit, onGo: submit, onSearch: submit, onSend: submit }
          : undefined
      }
      textStyle={{
        color: theme.onSurface,
        ...(monospace ? { fontFamily: 'monospace' } : null),
        fontSize: monospace ? 14 : 16,
      }}
      colors={{
        focusedContainerColor: outlined
          ? 'transparent'
          : theme.surfaceContainerHighest,
        unfocusedContainerColor: outlined
          ? 'transparent'
          : theme.surfaceContainerHighest,
        disabledContainerColor: outlined
          ? 'transparent'
          : theme.surfaceDisabled,
        cursorColor: theme.primary,
        focusedIndicatorColor: theme.primary,
        unfocusedIndicatorColor: outlined
          ? theme.outline
          : theme.onSurfaceVariant,
        focusedLabelColor: theme.primary,
        unfocusedLabelColor: theme.onSurfaceVariant,
        focusedLeadingIconColor: theme.onSurfaceVariant,
        unfocusedLeadingIconColor: theme.onSurfaceVariant,
        focusedTrailingIconColor: theme.onSurfaceVariant,
        unfocusedTrailingIconColor: theme.onSurfaceVariant,
        errorIndicatorColor: theme.error,
        errorLabelColor: theme.error,
        errorSupportingTextColor: theme.error,
        errorCursorColor: theme.error,
      }}
      modifiers={[
        ...(modifiers ?? [fillMaxWidth()]),
        ...(fieldTestID ? [testID(fieldTestID)] : []),
      ]}
    >
      {label ? (
        <Field.Label>
          <AppText variant="bodySmall">{label}</AppText>
        </Field.Label>
      ) : null}
      {placeholder ? (
        <Field.Placeholder>
          <AppText variant="bodyLarge" color={theme.onSurfaceVariant}>
            {placeholder}
          </AppText>
        </Field.Placeholder>
      ) : null}
      {leadingIcon ? (
        <Field.LeadingIcon>
          <AppIcon source={leadingIcon} />
        </Field.LeadingIcon>
      ) : null}
      {trailing ? <Field.TrailingIcon>{trailing}</Field.TrailingIcon> : null}
      {helper ? (
        <Field.SupportingText>
          <AppText
            variant="bodySmall"
            color={error ? theme.error : theme.onSurfaceVariant}
          >
            {helper}
          </AppText>
        </Field.SupportingText>
      ) : null}
    </Field>
  );
};

export default TextInput;
