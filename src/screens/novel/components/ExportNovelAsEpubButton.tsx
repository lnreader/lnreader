import React, { useMemo } from 'react';
import { Portal } from 'react-native-paper';
import { StatusBar, StyleProp, ViewStyle } from 'react-native';

import EpubBuilder from '@cd-z/react-native-epub-creator';
import NativeFile from '@specs/NativeFile';

import { NovelInfo } from '@database/types';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { useBoolean } from '@hooks/index';
import { showToast } from '@utils/showToast';
import { NOVEL_STORAGE } from '@utils/Storages';
import { getString } from '@strings/translations';
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
        padding-top: ${StatusBar.currentHeight};
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
        background-color: "${readerSettings.theme}";
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
      let novelName = "${novel.name}";
      let chapterName = "";
      let sourceId = ${novel.pluginId};
      let chapterId = "";
      let novelId = ${novel.id};
      let html = document.querySelector("chapter").innerHTML;
      
      ${readerSettings.customJS}
    `;
  }, [novel, readerSettings]);

  const exportNovelAsEpub = async (
    destinationUri: string,
    startChapter?: number,
    endChapter?: number,
  ) => {
    if (!novel) {
      showToast(getString('novelScreen.epub.noNovelSelected'));
      return;
    }

    let epub: EpubBuilder | undefined;

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

      epub = new EpubBuilder(
        {
          title: novel.name,
          fileName: novel.name.replace(/\s/g, ''),
          language: 'en',
          cover: novel.cover,
          description: novel.summary,
          author: novel.author,
          bookId: novel.pluginId.toString(),
          stylesheet: epubStylesheet || undefined,
          js: epubUseCustomJS ? epubJavaScript : undefined,
        },
        destinationUri,
      );

      await epub.prepare();

      let addedChapters = 0;
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        const chapterFilePath = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}/index.html`;

        if (NativeFile.exists(chapterFilePath)) {
          let chapterContent = NativeFile.readFile(chapterFilePath);

          const chapterDir = `${NOVEL_STORAGE}/${novel.pluginId}/${novel.id}/${chapter.id}`;
          const escapedDir = chapterDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const imagePathRegex = new RegExp(
            `file://(${escapedDir}/[^"'\\s]+)`,
            'g',
          );

          for (const match of chapterContent.matchAll(imagePathRegex)) {
            const imagePath = match[1];
            if (imagePath && !NativeFile.exists(imagePath)) {
              const escapedPath = imagePath.replace(
                /[.*+?^${}()|[\]\\]/g,
                '\\$&',
              );
              const figureRegex = new RegExp(
                `<figure[^>]*>.*?${escapedPath}.*?</figure>`,
                'gs',
              );

              chapterContent = chapterContent.replace(figureRegex, '');

              const imgRegex = new RegExp(
                `<img[^>]*${escapedPath}[^>]*\\/?>`,
                'g',
              );

              chapterContent = chapterContent.replace(imgRegex, '');
            }
          }

          await epub.addChapter({
            title:
              chapter.name?.trim() || `Chapter ${chapter.chapterNumber || i}`,
            fileName: `Chapter${i}`,
            htmlBody: `<chapter data-novel-id='${novel.pluginId}' data-chapter-id='${chapter.id}'>${chapterContent}</chapter>`,
          });

          addedChapters++;
        }
      }

      if (addedChapters === 0) {
        showToast(getString('novelScreen.epub.noDownloadedChapters'));
        await epub.discardChanges();
        return;
      }

      await epub.save();
      showToast(
        getString('novelScreen.epub.exportSuccess', {
          chapters: addedChapters.toString(),
        }),
      );
    } catch (error: any) {
      showToast(
        getString('novelScreen.epub.exportFailed', {
          error: error.message || error,
        }),
      );
      await epub?.discardChanges();
    }
  };

  return (
    <>
      <IconComponent icon="book-arrow-down-outline" onPress={showModal} />
      <Portal>
        <ExportEpubModal
          isVisible={isModalVisible}
          hideModal={hideModal}
          onSubmit={exportNovelAsEpub}
        />
      </Portal>
    </>
  );
};

export default ExportNovelAsEpubButton;
