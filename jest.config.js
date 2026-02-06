module.exports = {
  // Use node environment for database tests (no React Native needed)
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform TypeScript and JavaScript files using Babel (uses babel.config.js)
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },

  // Transform node_modules packages that use ES modules
  // Exclude most packages, but include ones that need transformation
  // Note: The pattern uses negative lookahead - packages NOT matching this pattern are ignored
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|expo|expo-.*|@expo|@op-engineering|drizzle-orm|lodash-es|@babel/runtime)/)',
  ],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@components$': '<rootDir>/src/components/index',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@database/(.*)$': '<rootDir>/src/database/$1',
    '^@hooks$': '<rootDir>/src/hooks/index',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@strings/(.*)$': '<rootDir>/strings/$1',
    '^@theme/(.*)$': '<rootDir>/src/theme/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@plugins/(.*)$': '<rootDir>/src/plugins/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@navigators/(.*)$': '<rootDir>/src/navigators/$1',
    '^@native/(.*)$': '<rootDir>/src/native/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@type/(.*)$': '<rootDir>/src/type/$1',
    '^@specs/(.*)$': '<rootDir>/specs/$1',
  },

  // Setup file runs after Jest environment is set up
  setupFilesAfterEnv: ['<rootDir>/src/database/queries/__tests__/setup.ts'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/database/queries/**/*.ts',
    '!src/database/queries/**/__tests__/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Test configuration
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  verbose: true,
};
