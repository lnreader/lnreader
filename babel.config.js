const ReactCompilerConfig = {
  target: '19',
};

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['module:@react-native/babel-preset'],
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
            'react-native-vector-icons/MaterialCommunityIcons':
              '@react-native-vector-icons/material-design-icons',
          },
        },
      ],
      'react-native-worklets/plugin',
      [
        'module:react-native-dotenv',
        {
          envName: 'APP_ENV',
          moduleName: '@env',
          path: '.env',
        },
      ],
      [
        'inline-import',
        {
          extensions: ['.sql'],
        },
      ],
    ],
  };
};
