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
import { TextInput } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import NativeFile from '@modules/native-file';
import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { Button, ConfirmationDialog } from '@components/index';
import { showToast } from '@utils/showToast';
import { useBoolean } from '@hooks';
import type { ReaderCustomizationContext } from '@screens/reader/utils/readerCustomization';

type CodeTab = 'css' | 'js';

interface AdvancedTabProps {
  /** Context of the chapter currently shown in the settings preview, if any. */
  previewContext?: ReaderCustomizationContext;
  /** Human-readable name of the source identified by previewContext.sourceId. */
  sourceName?: string;
}

const buildSourceTemplate = (
  tab: CodeTab,
  sourceId: string,
  sourceName?: string,
): string =>
  tab === 'css'
    ? `body[data-source-id='${sourceId}'] {
  /* Your customization for ${sourceName ?? sourceId} */
}`
    : `// Current source:
const { sourceId } = LNReader.context;

if (sourceId === '${sourceId}') {
  // Your customization for ${sourceName ?? sourceId}
}`;

const AdvancedTab: React.FC<AdvancedTabProps> = ({
  previewContext,
  sourceName,
}) => {
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

/* Target a specific source (recommended) */
body[data-source-id='example-source'] {
  font-family: serif;
}`;

  const customJSPlaceholder = `// Current source:
const { sourceId } = LNReader.context;

if (sourceId === 'example-source') {
  // Your customization
}

// LNReader.context is the recommended API: sourceId, novelId, novelName,
// chapterId, chapterName. The standalone variables (sourceId, novelId,
// novelName, chapterId, chapterName, html) remain available for
// compatibility with older scripts.
//
// html is a one-time snapshot — changing it does not change the rendered
// chapter. To modify the chapter, use LNReader.chapter.root, e.g:
// LNReader.chapter.root.querySelectorAll('.ads').forEach(el => el.remove());`;

  const handleCopySourceId = () => {
    if (!previewContext?.sourceId) {
      return;
    }
    Clipboard.setStringAsync(previewContext.sourceId).then(() =>
      showToast(
        getString('common.copiedToClipboard', {
          name: previewContext.sourceId,
        }),
      ),
    );
  };

  const handleInsertTemplate = () => {
    if (!previewContext?.sourceId) {
      return;
    }
    const template = buildSourceTemplate(
      activeCodeTab,
      previewContext.sourceId,
      sourceName,
    );
    if (activeCodeTab === 'css') {
      setCssValue(current =>
        current ? `${current}\n\n${template}` : template,
      );
    } else {
      setJsValue(current => (current ? `${current}\n\n${template}` : template));
    }
  };

  const handleSave = () => {
    if (activeCodeTab === 'css') {
      setChapterReaderSettings({ customCSS: cssValue });
    } else {
      setChapterReaderSettings({ customJS: jsValue });
    }
    showToast(getString('common.saved'));
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
        const tempPath =
          NativeFile.ExternalCachesDirectoryPath +
          '/imported_custom.' +
          activeCodeTab;
        await NativeFile.copyFile(file.assets[0].uri, tempPath);
        const content = await NativeFile.readFile(tempPath);
        await NativeFile.unlink(tempPath);

        if (activeCodeTab === 'css') {
          setCssValue(content.trim());
          setChapterReaderSettings({ customCSS: content.trim() });
        } else {
          setJsValue(content.trim());
          setChapterReaderSettings({ customJS: content.trim() });
        }
        showToast(getString('common.imported'));
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
            accessibilityLabel="CSS"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeCodeTab === 'css' }}
            style={styles.tab}
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
            {activeCodeTab === 'css' ? (
              <View
                style={[
                  styles.tabIndicator,
                  { backgroundColor: theme.primary },
                ]}
              />
            ) : null}
          </Pressable>

          <Pressable
            accessibilityLabel="JavaScript"
            accessibilityRole="tab"
            accessibilityState={{ selected: activeCodeTab === 'js' }}
            style={styles.tab}
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
            {activeCodeTab === 'js' ? (
              <View
                style={[
                  styles.tabIndicator,
                  { backgroundColor: theme.primary },
                ]}
              />
            ) : null}
          </Pressable>
        </View>

        {/* Current context */}
        {previewContext ? (
          <View
            style={[
              styles.contextPanel,
              { backgroundColor: theme.surfaceContainerLow ?? theme.surface },
            ]}
          >
            <Text
              style={[styles.contextTitle, { color: theme.onSurfaceVariant }]}
            >
              {getString('readerSettings.currentSource')}
            </Text>
            <Text style={[styles.contextLine, { color: theme.onSurface }]}>
              {(sourceName ?? previewContext.sourceId) +
                (previewContext.sourceId
                  ? ` (${previewContext.sourceId})`
                  : '')}
            </Text>
            <Text
              style={[styles.contextLine, { color: theme.onSurfaceVariant }]}
            >
              {previewContext.novelName} — {previewContext.chapterName}
            </Text>
            <View style={styles.contextActions}>
              <Button
                title={getString('readerSettings.copySourceId')}
                onPress={handleCopySourceId}
                mode="outlined"
                style={styles.contextButton}
                disabled={!previewContext.sourceId}
              />
              <Button
                title={getString('readerSettings.insertSourceTemplate')}
                onPress={handleInsertTemplate}
                mode="outlined"
                style={styles.contextButton}
                disabled={!previewContext.sourceId}
              />
            </View>
          </View>
        ) : null}

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
            title={
              activeCodeTab === 'css'
                ? getString('readerSettings.openCSSFile')
                : getString('readerSettings.openJSFile')
            }
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

      <ConfirmationDialog
        title={getString('readerSettings.clearCustomCSS')}
        confirmLabel={getString('common.clear')}
        visible={clearCSSModal.value}
        onConfirm={confirmResetCSS}
        onDismiss={clearCSSModal.setFalse}
      />
      <ConfirmationDialog
        title={getString('readerSettings.clearCustomJS')}
        confirmLabel={getString('common.clear')}
        visible={clearJSModal.value}
        onConfirm={confirmResetJS}
        onDismiss={clearJSModal.setFalse}
      />
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
      borderBottomColor: theme.outlineVariant,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      minHeight: 48,
    },
    contextPanel: {
      marginHorizontal: 16,
      marginTop: 16,
      padding: 12,
      borderRadius: 8,
      gap: 4,
    },
    contextTitle: {
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    contextLine: {
      fontSize: 13,
    },
    contextActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
    },
    contextButton: {
      flex: 1,
    },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      width: '60%',
      height: 3,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
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
