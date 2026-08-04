import DeviceInfo from 'react-native-device-info';
import * as Sharing from 'expo-sharing';

import NativeFile from '@modules/native-file';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { getBuildName } from '@utils/getBuildName';
import { showToast } from '@utils/showToast';
import { getString, i18n } from '@i18n/translations';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import { PluginItem } from '@plugins/types';

import { logger } from './logger';
import { getLastCrash } from './globalHandler';
import { redact } from './redact';

const CRASH_LOG_FILENAME = 'lnreader_crash_logs.txt';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return 'unknown';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function getDebugInfo(): string {
  return [
    `App version:  ${getBuildName()}`,
    `Android:      ${DeviceInfo.getSystemVersion()} (SDK ${DeviceInfo.getApiLevelSync()})`,
    `Device:       ${DeviceInfo.getBrand()} ${DeviceInfo.getModel()} / ${DeviceInfo.supportedAbisSync().join(
      ', ',
    )}`,
    `Emulator:     ${DeviceInfo.isEmulatorSync()}`,
    `Locale:       ${i18n.locale}`,
    `Memory:       ${formatBytes(
      DeviceInfo.getTotalMemorySync(),
    )} total, ${formatBytes(DeviceInfo.getFreeDiskStorageSync())} free disk`,
    `User agent:   ${DeviceInfo.getUserAgentSync()}`,
    `Timestamp:    ${new Date().toISOString()}`,
  ].join('\n');
}

export function getPluginsInfo(): string {
  const plugins = getMMKVObject<PluginItem[]>(INSTALLED_PLUGINS_KEY) ?? [];
  const problematic = plugins.filter(plugin => plugin.hasUpdate);

  const lines = [`=== Plugins (${plugins.length} installed) ===`];
  if (problematic.length === 0) {
    lines.push('No known plugin issues.');
  } else {
    for (const plugin of problematic) {
      lines.push(
        `Update available: ${plugin.id} (${plugin.version}, ${plugin.lang})`,
      );
    }
  }
  return lines.join('\n');
}

function getExceptionSection(explicitError?: unknown): string {
  if (explicitError) {
    const message =
      explicitError instanceof Error
        ? explicitError.message
        : String(explicitError);
    const stack =
      explicitError instanceof Error ? explicitError.stack : undefined;
    return `${message}${stack ? `\n\n${stack}` : ''}`;
  }

  const lastCrash = getLastCrash();
  if (lastCrash) {
    return `(from last crash, ${lastCrash.ts})\n${lastCrash.message}${
      lastCrash.stack ? `\n\n${lastCrash.stack}` : ''
    }`;
  }

  return 'No exception provided.';
}

export async function buildCrashLog(error?: unknown): Promise<string> {
  const entries = logger.getEntries();
  const logLines = entries
    .map(
      entry =>
        `${entry.ts} ${entry.level.toUpperCase()[0]}/${entry.tag}: ${
          entry.message
        }${entry.stack ? `\n${entry.stack}` : ''}`,
    )
    .join('\n');

  return [
    '=== LNReader Crash Logs ===',
    getDebugInfo(),
    '',
    getPluginsInfo(),
    '',
    '=== Exception ===',
    getExceptionSection(error),
    '',
    `=== Logs (last ${entries.length}) ===`,
    logLines || '(empty)',
  ].join('\n');
}

/**
 * Writes a redacted crash/debug dump to a cache file and hands it to the
 * user via the Android share sheet, falling back to a SAF "save as" if
 * sharing isn't available on the device.
 */
export async function dumpLogs(error?: unknown): Promise<void> {
  let path: string;
  try {
    const content = redact(await buildCrashLog(error));
    path = `${NativeFile.ExternalCachesDirectoryPath}/${CRASH_LOG_FILENAME}`;
    await NativeFile.writeFile(path, content);
  } catch {
    showToast(getString('advancedSettingsScreen.crashLogsFailed'));
    return;
  }

  try {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(`file://${path}`, {
        mimeType: 'text/plain',
        dialogTitle: getString('advancedSettingsScreen.shareCrashLogs'),
      });
    } else {
      const destinationUri = await NativeFile.createDocument(
        CRASH_LOG_FILENAME,
        'text/plain',
      );
      await NativeFile.copyFile(path, destinationUri);
    }
  } catch {
    // Dismissing the share sheet / document picker intentionally does nothing.
  }
}
