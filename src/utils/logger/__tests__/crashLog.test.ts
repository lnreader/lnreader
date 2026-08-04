import * as Sharing from 'expo-sharing';
import NativeFile from '@modules/native-file';
import { setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { logger } from '../logger';
import { clearLastCrash } from '../globalHandler';
import { buildCrashLog, dumpLogs } from '../crashLog';

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: {
    getBrand: jest.fn(() => 'Google'),
    getModel: jest.fn(() => 'Pixel 7'),
    getSystemVersion: jest.fn(() => '14'),
    getApiLevelSync: jest.fn(() => 34),
    supportedAbisSync: jest.fn(() => ['arm64-v8a']),
    isEmulatorSync: jest.fn(() => false),
    getTotalMemorySync: jest.fn(() => 8 * 1024 * 1024 * 1024),
    getFreeDiskStorageSync: jest.fn(() => 1024 * 1024 * 1024),
    getUserAgentSync: jest.fn(() => 'Mozilla/5.0 (LNReader test agent)'),
  },
}));

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

const OAUTH_TOKEN = 'oauth-secret-abc123';

describe('crashLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logger.clear();
    clearLastCrash();
    MMKVStorage.clearAll();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  describe('buildCrashLog', () => {
    it('includes the build, device, plugin and log sections', async () => {
      const dump = await buildCrashLog();

      expect(dump).toContain('=== LNReader Crash Logs ===');
      expect(dump).toContain('Google Pixel 7');
      expect(dump).toContain('=== Plugins (0 installed) ===');
      expect(dump).toContain('=== Exception ===');
      expect(dump).toContain('=== Logs (last 0) ===');
    });

    it('lists a plugin with an available update but not a healthy one', async () => {
      setMMKVObject('INSTALL_PLUGINS', [
        {
          id: 'stale-plugin',
          name: 'Stale',
          site: '',
          lang: 'en',
          version: '1.0.0',
          url: '',
          iconUrl: '',
          hasUpdate: true,
        },
        {
          id: 'healthy-plugin',
          name: 'Healthy',
          site: '',
          lang: 'en',
          version: '2.0.0',
          url: '',
          iconUrl: '',
          hasUpdate: false,
        },
      ]);

      const dump = await buildCrashLog();

      expect(dump).toContain('=== Plugins (2 installed) ===');
      expect(dump).toContain('Update available: stale-plugin (1.0.0, en)');
      expect(dump).not.toContain('healthy-plugin');
    });

    it('never leaks a tracker OAuth token into the dump', async () => {
      setMMKVObject('TRACKERS', {
        AniList: {
          name: 'AniList',
          auth: { accessToken: OAUTH_TOKEN, expiresAt: new Date() },
        },
      });
      logger.error('Trackers', `Authorization: Bearer ${OAUTH_TOKEN}`);

      const dump = await buildCrashLog(new Error('sync failed'));

      expect(dump).not.toContain(OAUTH_TOKEN);
    });
  });

  describe('dumpLogs', () => {
    it('writes the dump to a cache file and shares it via the share sheet', async () => {
      await dumpLogs(new Error('boom'));

      expect(NativeFile.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('lnreader_crash_logs.txt'),
        expect.stringContaining('boom'),
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('lnreader_crash_logs.txt'),
        expect.objectContaining({ mimeType: 'text/plain' }),
      );
    });

    it('falls back to a SAF save when the share sheet is unavailable', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

      await dumpLogs();

      expect(NativeFile.createDocument).toHaveBeenCalledWith(
        'lnreader_crash_logs.txt',
        'text/plain',
      );
      expect(NativeFile.copyFile).toHaveBeenCalled();
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    it('regression: never writes a live tracker token to the shared crash dump', async () => {
      setMMKVObject('TRACKERS', {
        AniList: {
          name: 'AniList',
          auth: { accessToken: OAUTH_TOKEN, expiresAt: new Date() },
        },
      });
      const leakyError = new Error(
        `Request failed: Authorization: Bearer ${OAUTH_TOKEN}`,
      );

      await dumpLogs(leakyError);

      const [, writtenContent] = (NativeFile.writeFile as jest.Mock).mock
        .calls[0];
      expect(writtenContent).not.toContain(OAUTH_TOKEN);
    });
  });
});
