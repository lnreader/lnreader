import { AnimatedIconButton, List } from '@components';
import KeyboardAvoidingModal from '@components/Modal/KeyboardAvoidingModal';
import { WINDOW_HEIGHT } from '@gorhom/bottom-sheet';
import { useBoolean } from '@hooks/index';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { TextInput as RNTextInput, StyleSheet } from 'react-native';
import { TextInput } from 'react-native-paper';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  LIST_ITEM_LINE_HEIGHT,
  RemoveItem,
  ReplaceItem,
} from '../Components/ListItems';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type ReplaceItemModalProps = {
  showReplace?: boolean;
  listExpanded: boolean;
  toggleList: () => void;
};

const ReplaceItemModal = ({
  showReplace = false,
  listExpanded = false,
  toggleList,
}: ReplaceItemModalProps) => {
  const theme = useTheme();
  const modal = useBoolean(false);
  const {
    setChapterReaderSettings: setSettings,
    replaceText,
    removeText,
  } = useChapterReaderSettings();
  const replaceArray = useMemo(() => {
    return Object.entries(replaceText);
  }, [replaceText]);

  const arrayLength = showReplace ? replaceArray.length : removeText.length;

  const textRef = useRef<RNTextInput>(null);
  const replaceTextRef = useRef<RNTextInput>(null);

  const [text, setText] = React.useState('');
  const [replacementText, setReplacementText] = React.useState('');
  const [editing, setEditing] = React.useState<string | undefined>();
  const [error, setError] = React.useState<[string, string] | undefined>();

  const listSize = useSharedValue<number | `${number}%`>(
    Math.min(110, arrayLength * 48),
  );
  const iconRotation = useSharedValue<number>(0);

  const cancel = () => {
    setError(undefined);
    textRef.current?.clear();
    setText('');
    setEditing(undefined);
    if (showReplace) {
      replaceTextRef.current?.clear();
      setReplacementText('');
    }
  };

  const save = () => {
    if (!text || (showReplace && !replacementText)) {
      const e: [string, string] = ['', ''];
      if (!text) {
        e[0] = 'Enter a match';
      }
      if (!replacementText) {
        e[1] = 'Enter a replace';
      }
      setError(e);
      return false;
    }

    if (showReplace) {
      if (editing && editing !== text) delete replaceText[editing];
      replaceText[text] = replacementText;
      setSettings({ replaceText: replaceText });
    } else {
      if (editing) {
        const i = removeText.findIndex(v => v === editing);
        removeText[i] = text;
      } else if (!removeText.includes(text)) {
        removeText.push(text);
      } else {
        setError(['Item already exists', '']);
        return false;
      }
      setSettings({ removeText: removeText });
    }
    cancel();
    return true;
  };

  const removeItem = useCallback(
    (identifier: string | number) => {
      if (showReplace) {
        delete replaceText[identifier];
        setSettings({ replaceText: replaceText });
      } else {
        removeText.splice(identifier as number, 1);
        setSettings({ removeText: removeText });
      }
    },
    [removeText, replaceText, setSettings, showReplace],
  );

  const editItem = useCallback(
    (item: string[]) => {
      setEditing(item[0]);
      setText(item[0]);
      if (showReplace) {
        setReplacementText(item[1]);
      }
      modal.setTrue();
    },
    [modal, showReplace],
  );

  const colorTheme = useMemo(() => {
    return { colors: theme };
  }, [theme]);

  const calcListSize = useCallback(
    (toggle: boolean = true) => {
      if (toggle) {
        toggleList();
        iconRotation.value = listExpanded ? 0 : 180;
      }
      if (listExpanded) {
        listSize.value = Math.min(
          WINDOW_HEIGHT * 0.6,
          arrayLength * (LIST_ITEM_LINE_HEIGHT + 16),
        );
      } else {
        listSize.value = Math.min(
          110,
          arrayLength * (LIST_ITEM_LINE_HEIGHT + 16),
        );
      }
    },
    [arrayLength, iconRotation, listExpanded, listSize, toggleList],
  );
  useEffect(() => {
    calcListSize(false);
  }, [replaceArray, removeText, calcListSize]);
  useEffect(() => {
    iconRotation.value = !listExpanded ? 0 : 180;
  }, [iconRotation, listExpanded]);

  const animatedListSize = useAnimatedStyle(() => ({
    height: withTiming(listSize.value, { duration: 250 }),
    overflow: 'hidden',
    position: 'relative',
  }));

  return (
    <>
      <List.Item
        title={showReplace ? 'Replace' : 'Remove'}
        description={showReplace ? 'Replace text' : 'Remove text'}
        theme={theme}
        right="plus"
        onPress={modal.setTrue}
      />
      <Animated.View style={animatedListSize}>
        {arrayLength <= 3 || listExpanded ? null : (
          <AnimatedLinearGradient
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            colors={['transparent', 'transparent', theme.background]}
            style={styles.gradient}
            onTouchEnd={() => calcListSize()}
          />
        )}
        {showReplace ? (
          <FlashList
            data={replaceArray}
            renderItem={({ item }) => (
              <ReplaceItem
                item={item}
                removeItem={removeItem}
                editItem={editItem}
              />
            )}
          />
        ) : (
          <FlashList
            data={removeText}
            renderItem={({ item, index }) => (
              <RemoveItem
                item={item}
                index={index}
                removeItem={removeItem}
                editItem={editItem}
              />
            )}
          />
        )}
      </Animated.View>
      <AnimatedIconButton
        name="menu-down"
        theme={theme}
        onPress={calcListSize}
        style={styles.marginHorizontal}
        color={theme.primary}
        rotation={iconRotation}
      />
      <KeyboardAvoidingModal
        visible={modal.value}
        onDismiss={() => {
          modal.setFalse();
          setError(undefined);
        }}
        onSave={save}
        onCancel={cancel}
        title="Edit Replace"
      >
        <TextInput
          ref={textRef}
          label={'match'}
          theme={colorTheme}
          defaultValue={text}
          onChangeText={setText}
          autoCorrect={false}
          mode="outlined"
          style={styles.textfield}
          error={error && !!error[0]}
        />
        {!showReplace ? null : (
          <TextInput
            ref={replaceTextRef}
            label={'replace'}
            theme={colorTheme}
            defaultValue={replacementText}
            onChangeText={setReplacementText}
            autoCorrect={false}
            mode="outlined"
            style={[styles.textfield, styles.bottom]}
            error={error && !!error[1]}
          />
        )}
      </KeyboardAvoidingModal>
    </>
  );
};

export default ReplaceItemModal;

const styles = StyleSheet.create({
  textfield: {
    marginBottom: 16,
  },
  bottom: {
    marginBottom: 24,
  },
  marginHorizontal: {
    marginHorizontal: 16,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
});
