import { useState, useEffect, useCallback } from 'react';
import { version } from '../../../package.json';
import { newer } from '@utils/compareVersion';
import { MMKVStorage } from '@utils/mmkv/mmkv';

interface GithubUpdate {
  isNewVersion: boolean;
  latestRelease: any;
}

const LAST_UPDATE_CHECK_KEY = 'LAST_UPDATE_CHECK';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const useGithubUpdateChecker = (): GithubUpdate => {
  const latestReleaseUrl =
    'https://api.github.com/repos/rajarsheechatterjee/lnreader/releases/latest';

  const [checking, setChecking] = useState(true);
  const [latestRelease, setLatestRelease] = useState<any>();

  const shouldCheckForUpdate = (): boolean => {
    const lastCheckTime = MMKVStorage.getNumber(LAST_UPDATE_CHECK_KEY);
    if (!lastCheckTime) {
      return true;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - lastCheckTime;

    return timeSinceLastCheck >= ONE_DAY_MS;
  };

  const checkForRelease = useCallback(async () => {
    if (!shouldCheckForUpdate()) {
      setChecking(false);
      return;
    }

    try {
      const res = await fetch(latestReleaseUrl);

      if (!res.ok) {
        setChecking(false);
        return;
      }

      const data = await res.json();

      if (!data || !data.tag_name) {
        setChecking(false);
        return;
      }

      const release = {
        tag_name: data.tag_name,
        body: data.body,
        downloadUrl: data.assets?.[0]?.browser_download_url || undefined,
      };

      MMKVStorage.set(LAST_UPDATE_CHECK_KEY, Date.now());

      setLatestRelease(release);
      setChecking(false);
    } catch (error) {
      // Silently fail in offline mode or on network errors
      setChecking(false);
    }
  }, []);

  const isNewVersion = (versionTag: string) => {
    const currentVersion = `${version}`;
    const regex = /[^\d.]/;

    const newVersion = versionTag.replace(regex, '');

    return newer(newVersion, currentVersion);
  };

  useEffect(() => {
    checkForRelease();
  }, [checkForRelease]);

  if (!checking && latestRelease?.tag_name) {
    return {
      latestRelease,
      isNewVersion: isNewVersion(latestRelease.tag_name),
    };
  }

  return {
    latestRelease: undefined,
    isNewVersion: false,
  };
};
