const isDevelopment = process.env.NODE_ENV === 'development';

export default function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          'react-compiler': {
            panicThreshold: isDevelopment ? 'critical_errors' : 'none',
            logger: {
              logEvent(filename, event) {
                if (isDevelopment && event.kind === 'CompileError') {
                  console.error(
                    `Babel compile error in ${filename}:`,
                    event.detail.options,
                  );
                }
              },
            },
          },
        },
      ],
    ],
    plugins: [
      'module:@babel/plugin-transform-export-namespace-from',
      [
        'module-resolver',
        {
          alias: {
            '@components': './src/components',
            '@database': './src/database',
            '@hooks': './src/hooks',
            '@screens': './src/screens',
            '@i18n': './src/i18n',
            '@services': './src/services',
            '@plugins': './src/plugins',
            '@utils': './src/utils',
            '@theme': './src/theme',
            '@navigators': './src/navigators',
            '@api': './src/api',
            '@type': './src/type',
            '@specs': './specs',
            '@test-utils': './test/test-utils',
            '@env': './src/generated/build-info',
            '@modules/nitro-tts': './modules/nitro-tts/src/index',
            '@modules': './modules',
            'react-native-vector-icons/MaterialCommunityIcons':
              '@react-native-vector-icons/material-design-icons',
          },
        },
      ],
      'react-native-worklets/plugin',
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
    ],
  };
}
