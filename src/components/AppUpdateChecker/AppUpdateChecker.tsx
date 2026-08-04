import { useCallback, useState } from 'react';

import AppUpdateDialog from './AppUpdateDialog';
import { useAppUpdateChecker } from './useAppUpdateChecker';

const AppUpdateChecker = () => {
  const { ignoreVersion, isNewVersion, latestRelease } = useAppUpdateChecker();
  const [dismissedVersion, setDismissedVersion] = useState<string>();

  const versionTag = latestRelease?.tag_name;

  const dismissUpdate = useCallback(() => {
    setDismissedVersion(versionTag);
  }, [versionTag]);

  const ignoreUpdate = useCallback(() => {
    if (versionTag) {
      ignoreVersion(versionTag);
    }
  }, [ignoreVersion, versionTag]);

  if (
    !isNewVersion ||
    !latestRelease ||
    dismissedVersion === latestRelease.tag_name
  ) {
    return null;
  }

  return (
    <AppUpdateDialog
      release={latestRelease}
      onDismiss={dismissUpdate}
      onIgnore={ignoreUpdate}
    />
  );
};

export default AppUpdateChecker;
