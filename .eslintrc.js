module.exports = {
  root: true,
  plugins: ['jest'],
  extends: ['@react-native', 'plugin:jest/recommended'],

  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
    },
    {
      files: ['*.js', '*.jsx', '*.ts', '*.tsx'],
      rules: {
        'no-shadow': 'off',
        'no-undef': 'off',
        'no-console': 'error',
        '@typescript-eslint/no-shadow': 'warn',
        'react-hooks/exhaustive-deps': 'warn',
        'curly': ['error', 'multi-line', 'consistent'],
        'no-useless-return': 'error',
        'block-scoped-var': 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'no-dupe-else-if': 'error',
        'no-duplicate-imports': 'error',
        '@react-native/no-deep-imports': 0,
      },
    },
  ],
};
