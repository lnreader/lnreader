import { NovelStatus } from '@plugins/types';
import { getString } from '@i18n/translations';

export const translateNovelStatus = (status?: NovelStatus | string) => {
  switch (status) {
    case NovelStatus.Ongoing:
      return getString('novelScreen.status.ongoing');
    case NovelStatus.OnHiatus:
      return getString('novelScreen.status.onHiatus');
    case NovelStatus.Completed:
      return getString('novelScreen.status.completed');
    case NovelStatus.Unknown:
      return getString('novelScreen.status.unknown');
    case NovelStatus.Cancelled:
      return getString('novelScreen.status.cancelled');
    case NovelStatus.Licensed:
      return getString('novelScreen.status.licensed');
    case NovelStatus.PublishingFinished:
      return getString('novelScreen.status.publishingFinished');
    default:
      return status ?? '';
  }
};
