import { version } from '../../package.json';
import Config from '@env';

/* eslint-disable import/no-named-as-default-member */
const GIT_HASH = Config.GIT_HASH;
const RELEASE_DATE = Config.RELEASE_DATE;
const BUILD_TYPE = Config.BUILD_TYPE;
/* eslint-enable import/no-named-as-default-member */

export function getBuildName(): string {
  if (!GIT_HASH || !RELEASE_DATE || !BUILD_TYPE) {
    return `Custom build ${version}`;
  }
  const localDateTime = isNaN(Number(RELEASE_DATE))
    ? RELEASE_DATE
    : new Date(Number(RELEASE_DATE)).toLocaleString();
  if (BUILD_TYPE === 'Release') {
    return `${BUILD_TYPE} ${version} (${localDateTime})`;
  }
  return `${BUILD_TYPE} ${version} (${localDateTime}) Commit: ${GIT_HASH}`;
}
