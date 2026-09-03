import React from 'react';
import { Portal } from 'react-native-paper';

import NativeFile from '@modules/native-file';

import { NovelInfo } from '@database/types';
import { useBoolean } from '@hooks/index';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
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
  const {
    value: isModalVisible,
    setTrue: showModal,
    setFalse: hideModal,
  } = useBoolean(false);

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

    try {
      let resolvedDestinationUri = destinationUri;
      if (!resolvedDestinationUri) {
        const selectedFolder = await NativeFile.pickDirectory();
        resolvedDestinationUri = selectedFolder.uri;
      }

      // Intent only: the port owns chapters, metadata, and storage layout.
      backgroundTasks.enqueue({
        name: 'EXPORT_EPUB',
        data: {
          novelId: novel.id,
          destinationUri: resolvedDestinationUri,
          fileName,
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
