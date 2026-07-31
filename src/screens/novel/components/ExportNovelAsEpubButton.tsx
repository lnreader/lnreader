import React, { useMemo } from 'react';
import { Portal } from 'react-native-paper';
import { StatusBar } from 'react-native';
import { openDocumentTree } from 'react-native-saf-x';

import { type EpubExportChapter } from '@modules/nitro-epub';

import { NovelInfo } from '@database/types';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { useBoolean } from '@hooks/index';
import { showToast } from '@utils/showToast';
import { NOVEL_STORAGE } from '@utils/Storages';
import { getString } from '@i18n/translations';
import { getNovelDownloadedChapters } from '@database/queries/ChapterQueries';
import { backgroundTasks } from '@services/backgroundTasks';

import ExportEpubModal, { EpubExportOptions } from './ExportEpubModal';

interface ExportNovelAsEpubButtonProps {
  novel?: NovelInfo;
  renderIcon: (onPress: () => void) => React.ReactNode;
}

const ExportNovelAsEpubButton: React.FC<ExportNovelAsEpubButtonProps> = ({
  novel,
  renderIcon,
}) => {
  const theme = useTheme();

  const {
    value: isModalVisible,
    setTrue: showModal,
    setFalse: hideModal,
  } = useBoolean(false);

  const readerSettings = useChapterReaderSettings();
  const appThemeStylesheet = useMemo(() => {
    if (!novel) {
      return '';
    }

    return `
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
      }`;
  }, [novel, readerSettings, theme.primary]);

  const customStylesheet = useMemo(() => {
    if (!novel) {
      return '';
    }

    return readerSettings.customCSS
      .replace(RegExp(`#sourceId-${novel.pluginId}\\s*\\{`, 'g'), 'body {')
      .replace(RegExp(`#sourceId-${novel.pluginId}[^.#A-Z]*`, 'gi'), '');
  }, [novel, readerSettings.customCSS]);

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
    options: EpubExportOptions,
    startChapter?: number,
    endChapter?: number,
  ) => {
    if (!novel) {
      showToast(getString('novelScreen.epub.noNovelSelected'));
      return;
    }
    const {
      id: novelId,
      pluginId,
      name: novelName,
      cover,
      summary,
      author,
    } = novel;

    try {
      const chapters = await getNovelDownloadedChapters(
        novelId,
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

      const epubChapters: EpubExportChapter[] = chapters.map(
        (chapter, index) => {
          const chapterNumber = chapter.chapterNumber ?? index + 1;
          const numberedTitle = getString('novelScreen.chapterChapnum', {
            num: chapterNumber,
          });
          const sourceTitle = chapter.name?.trim();

          return {
            title:
              options.includeChapterNumber && sourceTitle
                ? `${numberedTitle} — ${sourceTitle}`
                : sourceTitle || numberedTitle,
            htmlPath: `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapter.id}/index.html`,
            novelId: novelId.toString(),
            chapterId: chapter.id.toString(),
          };
        },
      );

      backgroundTasks.enqueue({
        name: 'EXPORT_EPUB',
        data: {
          novelName: novelName,
          destinationUri: resolvedDestinationUri,
          fileName,
          chapters: epubChapters,
          metadata: {
            title: novelName,
            language: 'en',
            coverPath: cover || '',
            description: summary || '',
            author: author || '',
            bookId: `urn:lnreader:${pluginId}:${novelId}`,
            stylesheet:
              (options.useAppTheme ? appThemeStylesheet : '') +
              (options.useCustomCSS ? customStylesheet : ''),
            javascript: options.useCustomJS ? epubJavaScript : '',
          },
        },
      });
    } catch (error) {
      showToast(
        getString('novelScreen.epub.exportFailed', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  return (
    <>
      {renderIcon(showModal)}
      <Portal>
        {isModalVisible ? (
          <ExportEpubModal
            isVisible
            defaultFileName={novel?.name || 'novel'}
            hideModal={hideModal}
            onSubmit={exportNovelAsEpub}
          />
        ) : null}
      </Portal>
    </>
  );
};

export default ExportNovelAsEpubButton;
