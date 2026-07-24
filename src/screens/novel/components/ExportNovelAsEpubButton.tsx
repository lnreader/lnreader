import React, { useMemo } from 'react';
import { Portal } from 'react-native-paper';
import { StatusBar, StyleProp, ViewStyle } from 'react-native';
import { copyFile, openDocumentTree } from 'react-native-saf-x';

import { epub, type EpubExportChapter } from '@modules/nitro-epub';
import NativeFile from '@modules/native-file';

import { NovelInfo } from '@database/types';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { useBoolean } from '@hooks/index';
import { showToast } from '@utils/showToast';
import { NOVEL_STORAGE } from '@utils/Storages';
import { getString } from '@i18n/translations';
import { getNovelDownloadedChapters } from '@database/queries/ChapterQueries';

import ExportEpubModal from './ExportEpubModal';
import { MaterialDesignIconName } from '@type/icon';

interface ExportNovelAsEpubButtonProps {
  novel?: NovelInfo;
  iconComponent: (props: {
    icon: MaterialDesignIconName;
    onPress: () => void;
    style?: StyleProp<ViewStyle>;
    size?: number;
  }) => React.JSX.Element;
}

const sanitizeEpubFileName = (fileName: string) => {
  const withoutExtension = fileName.trim().replace(/\.epub$/i, '');
  return (
    withoutExtension
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
      .replace(/[. ]+$/g, '')
      .trim() || 'novel'
  );
};

const ExportNovelAsEpubButton: React.FC<ExportNovelAsEpubButtonProps> = ({
  novel,
  iconComponent: IconComponent,
}) => {
  const theme = useTheme();

  const {
    value: isModalVisible,
    setTrue: showModal,
    setFalse: hideModal,
  } = useBoolean(false);

  const readerSettings = useChapterReaderSettings();
  const {
    epubUseAppTheme = false,
    epubUseCustomCSS = false,
    epubUseCustomJS = false,
  } = readerSettings;

  const epubStylesheet = useMemo(() => {
    if (!novel) {
      return '';
    }

    const appThemeStyles = epubUseAppTheme
      ? `
      html {
        scroll-behavior: smooth;
        overflow-x: hidden;
        padding-top: ${StatusBar.currentHeight ?? 0}px;
        word-wrap: break-word;
      }
      body {
        padding-left: ${readerSettings.padding}%;
        padding-right: ${readerSettings.padding}%;
        padding-bottom: 40px;
        font-size: ${readerSettings.textSize}px;
        color: ${readerSettings.textColor};
        text-align: ${readerSettings.textAlign};
        line-height: ${readerSettings.lineHeight};
        font-family: "${readerSettings.fontFamily}";
        background-color: ${readerSettings.theme};
      }
      hr {
        margin-top: 20px;
        margin-bottom: 20px;
      }
      a {
        color: ${theme.primary};
      }
      img {
        display: block;
        width: auto;
        height: auto;
        max-width: 100%;
      }`
      : '';

    const customStyles = epubUseCustomCSS
      ? readerSettings.customCSS
          .replace(RegExp(`#sourceId-${novel.pluginId}\\s*\\{`, 'g'), 'body {')
          .replace(RegExp(`#sourceId-${novel.pluginId}[^.#A-Z]*`, 'gi'), '')
      : '';

    return appThemeStyles + customStyles;
  }, [novel, epubUseAppTheme, epubUseCustomCSS, readerSettings, theme.primary]);

  const epubJavaScript = useMemo(() => {
    if (!novel) {
      return '';
    }

    return `
      let novelName = ${JSON.stringify(novel.name)};
      let chapterName = document.title;
      let sourceId = ${JSON.stringify(novel.pluginId)};
      let chapterId = document.body.dataset.chapterId;
      let novelId = ${JSON.stringify(novel.id)};
      let html = document.body.innerHTML;
      
      ${readerSettings.customJS}
    `;
  }, [novel, readerSettings]);

  const exportNovelAsEpub = async (
    destinationUri: string,
    fileName: string,
    startChapter?: number,
    endChapter?: number,
  ) => {
    if (!novel) {
      showToast(getString('novelScreen.epub.noNovelSelected'));
      return;
    }

    let tempEpubPath: string | undefined;

    try {
      const chapters = await getNovelDownloadedChapters(
        novel.id,
        startChapter,
        endChapter,
      );

      if (chapters.length === 0) {
        showToast(getString('novelScreen.epub.noDownloadedChapters'));
        return;
      }

      let resolvedDestinationUri = destinationUri;
      if (!resolvedDestinationUri) {
        const selectedFolder = await openDocumentTree(true);
        if (!selectedFolder) {
          return;
        }
        resolvedDestinationUri = selectedFolder.uri;
      }

      const epubFileName = `${sanitizeEpubFileName(fileName)}.epub`;
      tempEpubPath = `${NativeFile.ExternalCachesDirectoryPath}/epub-export-${
        novel.id
      }-${Date.now()}.epub`;
      const epubChapters: EpubExportChapter[] = chapters.map(
        (chapter, index) => ({
          title:
            chapter.name?.trim() ||
            `Chapter ${chapter.chapterNumber || index + 1}`,
          htmlPath: `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`,
          novelId: novel.id.toString(),
          chapterId: chapter.id.toString(),
        }),
      );

      const result = await epub.exportEpub(
        {
          title: novel.name,
          language: 'en',
          coverPath: novel.cover || '',
          description: novel.summary || '',
          author: novel.author || '',
          bookId: `urn:lnreader:${novel.pluginId}:${novel.id}`,
          stylesheet: epubStylesheet,
          javascript: epubUseCustomJS ? epubJavaScript : '',
        },
        epubChapters,
        tempEpubPath,
      );

      await copyFile(
        `file://${result.outputPath}`,
        `${resolvedDestinationUri}/${epubFileName}`,
        { replaceIfDestinationExists: true },
      );
      showToast(
        getString('novelScreen.epub.exportSuccess', {
          chapters: result.chapterCount.toString(),
        }),
      );
    } catch (error: any) {
      showToast(
        getString('novelScreen.epub.exportFailed', {
          error: error.message || error,
        }),
      );
    } finally {
      try {
        if (tempEpubPath && (await NativeFile.exists(tempEpubPath))) {
          await NativeFile.unlink(tempEpubPath);
        }
      } catch {
        // Export cleanup must not replace the original result or error.
      }
    }
  };

  return (
    <>
      <IconComponent icon="book-arrow-down-outline" onPress={showModal} />
      <Portal>
        <ExportEpubModal
          isVisible={isModalVisible}
          defaultFileName={novel?.name || 'novel'}
          hideModal={hideModal}
          onSubmit={exportNovelAsEpub}
        />
      </Portal>
    </>
  );
};

export default ExportNovelAsEpubButton;
