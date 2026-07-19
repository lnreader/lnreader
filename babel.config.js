const ReactCompilerConfig = {
  target: '19',
};

export default function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'module:@babel/plugin-transform-export-namespace-from',
      ['babel-plugin-react-compiler', ReactCompilerConfig],
      [
        'module-resolver',
        {
          alias: {
            '@components': './src/components',
            '@database': './src/database',
            '@hooks': './src/hooks',
            '@screens': './src/screens',
            '@strings': './strings',
            '@services': './src/services',
            '@plugins': './src/plugins',
            '@utils': './src/utils',
            '@theme': './src/theme',
            '@navigators': './src/navigators',
            '@api': './src/api',
            '@type': './src/type',
            '@specs': './specs',
            '@test-utils': './__tests-modules__/test-utils',
            '@env': './src/generated/build-info',
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
