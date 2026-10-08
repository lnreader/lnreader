import React, { memo } from 'react';
import {
  BasicTextField,
  Box,
  Row,
  Surface,
  Shape,
} from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  testID,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import { ThemeColors } from '../../theme/types';
import ArrowBackIcon from '@expo/material-symbols/arrow_back.xml';
import CloseIcon from '@expo/material-symbols/close.xml';
import { useScreenInsets } from '../Screen/insets';
import IconButtonV2 from '../IconButtonV2/IconButtonV2';
import AppText from '../AppText/AppText';
import { OverflowMenu } from '../Menu';
import { useSyncedTextState } from '../../hooks/common/useSyncedTextState';
import { type IconSource } from '../AppIcon/AppIcon';

export interface RightIcon {
  accessibilityLabel?: string;
  iconName: IconSource;
  color?: string;
  onPress: () => void;
}

interface MenuButton {
  title: string;
  onPress: () => void;
}

interface SearcbarProps {
  searchText: string;
  placeholder: string;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  leftIcon: IconSource;
  rightIcons?: readonly RightIcon[];
  menuButtons?: MenuButton[];
  handleBackAction?: () => void;
  clearSearchbar: () => void;
  onLeftIconPress?: () => void;
  theme: ThemeColors;
  /** Compose top bars draw under the status bar, so the bar pads itself. */
  insetTop?: boolean;
}

const Searchbar: React.FC<SearcbarProps> = ({
  searchText,
  placeholder,
  onChangeText,
  onSubmitEditing,
  leftIcon,
  rightIcons,
  menuButtons,
  handleBackAction,
  clearSearchbar,
  onLeftIconPress,
  theme,
  insetTop = true,
}) => {
  const { top, left, right } = useScreenInsets();
  const text = useSyncedTextState(searchText);

  return (
    <Box
      modifiers={[
        fillMaxWidth(),
        padding(16 + left, 8 + (insetTop ? top : 0), 16 + right, 8),
      ]}
    >
      <Surface
        color={theme.surfaceContainerHigh}
        contentColor={theme.onSurface}
        shape={Shape.Pill({})}
        modifiers={[fillMaxWidth(), height(56)]}
      >
        <Row
          verticalAlignment="center"
          modifiers={[fillMaxWidth(), height(56), padding(4, 0, 4, 0)]}
        >
          <IconButtonV2
            accessibilityLabel={
              handleBackAction
                ? getString('common.back')
                : getString('common.search')
            }
            name={handleBackAction ? ArrowBackIcon : leftIcon}
            color={theme.onSurface}
            onPress={() => {
              if (handleBackAction) {
                handleBackAction();
              } else if (onLeftIconPress) {
                onLeftIconPress();
              }
            }}
            theme={theme}
          />
          <BasicTextField
            value={text}
            singleLine
            cursorColor={theme.primary}
            textStyle={{
              color: theme.onSurface,
              fontSize: 16,
            }}
            keyboardOptions={{ imeAction: 'search' }}
            keyboardActions={{ onSearch: () => onSubmitEditing?.() }}
            onValueChange={value => onChangeText?.(value)}
            modifiers={[
              weight(1),
              padding(4, 0, 4, 0),
              testID('search-bar-input'),
            ]}
          >
            <BasicTextField.DecorationBox>
              <Box>
                <BasicTextField.Placeholder>
                  <AppText
                    variant="bodyLarge"
                    color={theme.onSurfaceVariant}
                    maxLines={1}
                  >
                    {placeholder}
                  </AppText>
                </BasicTextField.Placeholder>
                <BasicTextField.InnerTextField />
              </Box>
            </BasicTextField.DecorationBox>
          </BasicTextField>
          {searchText !== '' ? (
            <IconButtonV2
              accessibilityLabel={getString('common.clear')}
              name={CloseIcon}
              color={theme.onSurface}
              onPress={clearSearchbar}
              theme={theme}
            />
          ) : null}
          {rightIcons?.map((icon, index) => (
            <IconButtonV2
              accessibilityLabel={icon.accessibilityLabel}
              key={index}
              name={icon.iconName}
              color={icon.color || theme.onSurface}
              onPress={icon.onPress}
              theme={theme}
            />
          ))}
          {menuButtons?.length ? (
            <OverflowMenu
              actions={menuButtons.map(button => ({
                label: button.title,
                onPress: button.onPress,
              }))}
            />
          ) : null}
        </Row>
      </Surface>
    </Box>
  );
};

export default memo(Searchbar);
