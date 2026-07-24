import { useCallback } from 'react';
import { StorageAccessFramework } from 'expo-file-system/legacy';

import { NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import NativeFile from '@modules/native-file';
import { downloadFile } from '@plugins/helpers/fetch';
import { showToast } from '@utils/showToast';

export const useSaveNovelCover = (novel: NovelInfo | undefined) =>
  useCallback(async () => {
    if (!novel?.cover) {
      showToast(
        getString(
          novel ? 'novelScreen.noCoverFound' : 'novelScreen.coverNotSaved',
        ),
      );
      return;
    }

    const permissions =
      await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted) {
      showToast(getString('novelScreen.coverNotSaved'));
      return;
    }

    const cover = novel.cover;
    let tempCoverUri: string | null = null;
    try {
      const rawExtension = cover.split('.').pop()?.split('?')[0] || 'png';
      const extension = ['jpg', 'jpeg', 'png', 'webp'].includes(rawExtension)
        ? rawExtension
        : 'png';
      const fileName = `${novel.name.replace(/[^a-zA-Z0-9]/g, '_')}_${
        novel.id
      }.${extension}`;
      const destination = await StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        `image/${extension}`,
      );

      if (cover.startsWith('http')) {
        tempCoverUri = `${NativeFile.ExternalCachesDirectoryPath}/${fileName}`;
        await downloadFile(cover, tempCoverUri);
        await NativeFile.copyFile(tempCoverUri, destination);
      } else {
        await NativeFile.copyFile(cover, destination);
      }
      showToast(getString('novelScreen.coverSaved'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    } finally {
      if (tempCoverUri) {
        await NativeFile.unlink(tempCoverUri).catch(() => undefined);
      }
    }
  }, [novel]);
