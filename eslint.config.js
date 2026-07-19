const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");
const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const testFiles = [
  "**/__tests__/**/*.[jt]s?(x)",
  "**/?(*.)+(spec|test).[jt]s?(x)",
];

module.exports = defineConfig([
  globalIgnores([
    "android/**",
    "ios/**",
    "node_modules/**",
    ".expo/**",
    "dist/**",
    "coverage/**",
  ]),
  expoConfig,
  ...compat
    .extends("plugin:testing-library/react", "plugin:jest/recommended")
    .map((config) => ({
      ...config,
      files: testFiles,
    })),

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-shadow": "off",
      "no-undef": "off",
      "no-console": "error",

      "@typescript-eslint/no-shadow": "warn",

      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/immutability": "warn",
      "react/no-children-prop": "warn",

      "react/display-name": "off",

      curly: ["error", "multi-line", "consistent"],
      "no-useless-return": "error",
      "block-scoped-var": "error",
      "no-var": "error",
      "prefer-const": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-imports": "error",

      "@react-native/no-deep-imports": "off",
    },
  },
]);
