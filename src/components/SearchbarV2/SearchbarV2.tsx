import React, { memo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, TextInput } from 'react-native';

import IconButtonV2 from '../IconButtonV2/IconButtonV2';
import { ThemeColors } from '../../theme/types';
import { Menu } from '@components';
import { MaterialDesignIconName } from '@type/icon';

export interface RightIcon {
  iconName: MaterialDesignIconName;
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
  leftIcon: MaterialDesignIconName;
  rightIcons?: readonly RightIcon[];
  menuButtons?: MenuButton[];
  handleBackAction?: () => void;
  clearSearchbar: () => void;
  onLeftIconPress?: () => void;
  theme: ThemeColors;
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
}) => {
  const searchbarRef = useRef<any>(null);
  const focusSearchbar = () => searchbarRef.current.focus();
  const [extraMenu, showExtraMenu] = useState(false);

  const marginTop = 8;
  const marginRight = 16;
  const marginLeft = 16;

  return (
    <View
      style={[
        styles.searchbarContainer,
        {
          marginTop,
          marginRight,
          marginLeft,
          backgroundColor: theme.surface2,
        },
      ]}
    >
      <Pressable
        onPress={focusSearchbar}
        android_ripple={{ color: theme.rippleColor }}
        style={styles.searchbar}
      >
        <IconButtonV2
          name={handleBackAction ? 'arrow-left' : leftIcon}
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

        <TextInput
          ref={searchbarRef}
          style={[styles.textInput, { color: theme.onSurface }]}
          placeholder={placeholder}
          placeholderTextColor={theme.onSurface}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          defaultValue={searchText}
        />
        {searchText !== '' ? (
          <IconButtonV2
            name="close"
            color={theme.onSurface}
            onPress={clearSearchbar}
            theme={theme}
          />
        ) : null}
        {rightIcons?.map((icon, index) => (
          <IconButtonV2
            key={index}
            name={icon.iconName}
            color={icon.color || theme.onSurface}
            onPress={icon.onPress}
            theme={theme}
          />
        ))}
        {menuButtons?.length ? (
          <Menu
            visible={extraMenu}
            onDismiss={() => showExtraMenu(false)}
            anchor={
              <IconButtonV2
                name="dots-vertical"
                color={theme.onSurface}
                onPress={() => showExtraMenu(true)}
                theme={theme}
              />
            }
            contentStyle={{
              backgroundColor: theme.surface2,
            }}
          >
            {menuButtons?.map((button, index) => (
              <Menu.Item
                key={index}
                title={button.title}
                style={{ backgroundColor: theme.surface2 }}
                titleStyle={{
                  color: theme.onSurface,
                }}
                onPress={() => {
                  showExtraMenu(false);
                  setTimeout(() => {
                    button.onPress();
                  }, 0);
                }}
              />
            ))}
          </Menu>
        ) : null}
      </Pressable>
    </View>
  );
};

export default memo(Searchbar);

const styles = StyleSheet.create({
  icon: {
    marginHorizontal: 8,
  },
  searchIconContainer: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  searchbar: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  searchbarContainer: {
    borderRadius: 50,
    marginBottom: 12,
    marginHorizontal: 16,
    minHeight: 56,
    overflow: 'hidden',
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    marginHorizontal: 8,
  },
});
