import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { TextInput, Portal } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { ThemeColors } from '@theme/types';
import { Button, ConfirmationDialog } from '@components/index';
import { showToast } from '@utils/showToast';
import { useBoolean } from '@hooks';

type CodeTab = 'css' | 'js';

const AdvancedTab: React.FC = () => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const { customCSS, customJS, setChapterReaderSettings } =
    useChapterReaderSettings();

  const [activeCodeTab, setActiveCodeTab] = useState<CodeTab>('css');
  const [cssValue, setCssValue] = useState(customCSS || '');
  const [jsValue, setJsValue] = useState(customJS || '');

  const clearCSSModal = useBoolean();
  const clearJSModal = useBoolean();

  const customCSSPlaceholder = `/* Custom CSS for your reader */

body {
  margin: 16px;
  line-height: 1.8;
}

h1, h2, h3 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: bold;
}

p {
  text-indent: 1em;
  margin-bottom: 1em;
}

/* Target specific sources */
#sourceId-example {
  font-family: serif;
}`;

  const customJSPlaceholder = `// Custom JavaScript for your reader
// Available variables:
// - html, novelName, chapterName
// - sourceId, chapterId, novelId

// Example: Remove elements
document.querySelectorAll('.ads').forEach(el => el.remove());

// Example: Modify content
const title = document.querySelector('h1');
if (title) {
  title.style.color = '#FF6B6B';
}`;

  const handleSave = () => {
    if (activeCodeTab === 'css') {
      setChapterReaderSettings({ customCSS: cssValue });
    } else {
      setChapterReaderSettings({ customJS: jsValue });
    }
    showToast('Saved');
  };

  const handleReset = () => {
    if (activeCodeTab === 'css') {
      clearCSSModal.setTrue();
    } else {
      clearJSModal.setTrue();
    }
  };

  const confirmResetCSS = () => {
    setCssValue('');
    setChapterReaderSettings({ customCSS: '' });
    clearCSSModal.setFalse();
  };

  const confirmResetJS = () => {
    setJsValue('');
    setChapterReaderSettings({ customJS: '' });
    clearJSModal.setFalse();
  };

  const handleImport = async () => {
    try {
      const mimeType =
        activeCodeTab === 'css' ? 'text/css' : 'application/javascript';
      const file = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: false,
        type: mimeType,
      });

      if (file.assets) {
        const content = await StorageAccessFramework.readAsStringAsync(
          file.assets[0].uri,
        );

        if (activeCodeTab === 'css') {
          setCssValue(content.trim());
          setChapterReaderSettings({ customCSS: content.trim() });
        } else {
          setJsValue(content.trim());
          setChapterReaderSettings({ customJS: content.trim() });
        }
        showToast('Imported');
      }
    } catch (error: any) {
      showToast(error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <BottomSheetScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tab,
              activeCodeTab === 'css' && styles.activeTab,
            ]}
            onPress={() => setActiveCodeTab('css')}
            android_ripple={{ color: theme.rippleColor }}
          >
            <MaterialCommunityIcons
              name="language-css3"
              size={20}
              color={
                activeCodeTab === 'css' ? theme.primary : theme.onSurfaceVariant
              }
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color:
                    activeCodeTab === 'css'
                      ? theme.primary
                      : theme.onSurfaceVariant,
                },
                activeCodeTab === 'css' && styles.activeTabLabel,
              ]}
            >
              CSS
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tab,
              activeCodeTab === 'js' && styles.activeTab,
            ]}
            onPress={() => setActiveCodeTab('js')}
            android_ripple={{ color: theme.rippleColor }}
          >
            <MaterialCommunityIcons
              name="language-javascript"
              size={20}
              color={
                activeCodeTab === 'js' ? theme.primary : theme.onSurfaceVariant
              }
              style={styles.tabIcon}
            />
            <Text
              style={[
                styles.tabLabel,
                {
                  color:
                    activeCodeTab === 'js'
                      ? theme.primary
                      : theme.onSurfaceVariant,
                },
                activeCodeTab === 'js' && styles.activeTabLabel,
              ]}
            >
              JS
            </Text>
          </Pressable>
        </View>

        {/* Code Editor */}
        <View style={styles.editorContainer}>
          <TextInput
            mode="flat"
            value={activeCodeTab === 'css' ? cssValue : jsValue}
            onChangeText={text =>
              activeCodeTab === 'css' ? setCssValue(text) : setJsValue(text)
            }
            placeholder={
              activeCodeTab === 'css'
                ? customCSSPlaceholder
                : customJSPlaceholder
            }
            multiline
            numberOfLines={12}
            autoCorrect={false}
            autoCapitalize="none"
            spellCheck={false}
            style={[styles.codeEditor, { backgroundColor: theme.surface2 }]}
            activeUnderlineColor={theme.primary}
            contentStyle={styles.codeEditorContent}
            textColor={theme.onSurface}
            placeholderTextColor={theme.onSurfaceVariant}
          />
        </View>

        {/* Hint */}
        <View
          style={[styles.hint, { backgroundColor: theme.secondaryContainer }]}
        >
          <MaterialCommunityIcons
            name="lightbulb-outline"
            size={18}
            color={theme.onSecondaryContainer}
            style={styles.hintIcon}
          />
          <Text
            style={[styles.hintText, { color: theme.onSecondaryContainer }]}
          >
            {activeCodeTab === 'css'
              ? getString('readerSettings.cssHint')
              : getString('readerSettings.jsHint')}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            title="Import"
            onPress={handleImport}
            mode="outlined"
            style={styles.button}
          />
          <Button
            title={getString('common.reset')}
            onPress={handleReset}
            mode="outlined"
            style={styles.button}
            disabled={activeCodeTab === 'css' ? !cssValue : !jsValue}
          />
          <Button
            title={getString('common.save')}
            onPress={handleSave}
            mode="contained"
            style={styles.button}
          />
        </View>

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      {/* Confirmation Dialogs */}
      <Portal>
        <ConfirmationDialog
          title={getString('readerSettings.clearCustomCSS')}
          visible={clearCSSModal.value}
          onSubmit={confirmResetCSS}
          onDismiss={clearCSSModal.setFalse}
          theme={theme}
        />
        <ConfirmationDialog
          title={getString('readerSettings.clearCustomJS')}
          visible={clearJSModal.value}
          onSubmit={confirmResetJS}
          onDismiss={clearJSModal.setFalse}
          theme={theme}
        />
      </Portal>
    </KeyboardAvoidingView>
  );
};

export default AdvancedTab;

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollContainer: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 24,
    },
    tabContainer: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    },
    activeTab: {
      borderBottomColor: theme.primary,
      borderBottomWidth: 2,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      minHeight: 48,
    },
    tabIcon: {
      marginEnd: 8,
    },
    tabLabel: {
      fontSize: 14,
      letterSpacing: 0.5,
      fontWeight: '400',
    },
    activeTabLabel: {
      fontWeight: '500',
    },
    editorContainer: {
      marginHorizontal: 16,
      marginTop: 16,
      minHeight: 300,
    },
    codeEditor: {
      minHeight: 300,
      maxHeight: 400,
    },
    codeEditorContent: {
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 20,
      paddingTop: 12,
      paddingBottom: 12,
    },
    hint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 12,
      borderRadius: 8,
      marginHorizontal: 16,
      marginTop: 16,
      gap: 8,
    },
    hintIcon: {
      marginTop: 2,
    },
    hintText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    actionButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginHorizontal: 16,
      marginTop: 16,
      gap: 8,
    },
    button: {
      flex: 1,
    },
    bottomSpacing: {
      height: 24,
    },
  });
