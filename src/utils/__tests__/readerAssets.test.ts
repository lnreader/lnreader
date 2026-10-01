import { NativeModules } from 'react-native';

import { getReaderAssetsUri } from '../readerAssets';

describe('getReaderAssetsUri', () => {
  const original = NativeModules.SourceCode;

  afterEach(() => {
    NativeModules.SourceCode = original;
  });

  it('uses the dev server the bundle was loaded from', () => {
    NativeModules.SourceCode = {
      getConstants: () => ({
        scriptURL: 'http://192.168.0.20:8081/index.bundle?platform=android',
      }),
    };
    expect(getReaderAssetsUri()).toBe('http://192.168.0.20:8081/assets');
  });

  it('falls back to localhost when the bundle URL is unknown', () => {
    NativeModules.SourceCode = { getConstants: () => ({}) };
    expect(getReaderAssetsUri()).toBe('http://localhost:8081/assets');
  });
});
