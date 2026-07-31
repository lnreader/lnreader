import { useState, useEffect, useCallback } from 'react';
import { version } from '../../../package.json';
import { newer } from '@utils/compareVersion';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import DeviceInfo from 'react-native-device-info';

interface GithubUpdate {
  isNewVersion: boolean;
  latestRelease: any;
}

const LAST_UPDATE_CHECK_KEY = 'LAST_UPDATE_CHECK';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

interface GithubReleaseAsset {
  name?: string;
  browser_download_url?: string;
}

const getReleaseDownloadUrl = async (
  assets: GithubReleaseAsset[] = [],
): Promise<string | undefined> => {
  const apkAssets = assets.filter(asset => {
    return asset.name?.endsWith('.apk') && asset.browser_download_url;
  });
  const universalAsset = apkAssets.find(asset =>
    asset.name?.endsWith('-universal.apk'),
  );
  let supportedAbis: string[] = [];
  try {
    supportedAbis = await DeviceInfo.supportedAbis();
  } catch {
    // Fall back to the universal APK when ABI detection is unavailable.
    return (
      universalAsset?.browser_download_url || apkAssets[0]?.browser_download_url
    );
  }
  for (const abi of supportedAbis) {
    const matchingAsset = apkAssets.find(asset =>
      asset.name?.endsWith(`-${abi}.apk`),
    );

    if (matchingAsset && matchingAsset.browser_download_url) {
      return matchingAsset.browser_download_url;
    }
  }
};

async function fetchRelease(url: string) {
  'use no memo';
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error();
  }

  const data = await res.json();

  if (!data || !data.tag_name) {
    throw new Error();
  }

  const downloadUrl = await getReleaseDownloadUrl(data.assets);
  return {
    tag_name: data.tag_name,
    body: data.body,
    downloadUrl,
  };
}

export const useGithubUpdateChecker = (): GithubUpdate => {
  const latestReleaseUrl =
    'https://api.github.com/repos/LNReader/lnreader/releases/latest';

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
      const release = await fetchRelease(latestReleaseUrl);

      MMKVStorage.set(LAST_UPDATE_CHECK_KEY, Date.now());

      setLatestRelease(release);
      setChecking(false);
    } catch {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
