// jest.config.js
const baseModuleNameMapper = {
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
  '^@test-utils$': '<rootDir>/__tests-modules__/test-utils',
  '^@env$': '<rootDir>/src/generated/build-info',
  // Mock static assets
  '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
};

const baseTransform = {
  '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
};

const baseTransformIgnorePatterns = [
  // 'node_modules/(?!(.pnpm/|@op-engineering|drizzle-orm|lodash-es|@babel/runtime))',
  'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|color|@op-engineering|drizzle-orm|lodash-es))',
];

module.exports = {
  moduleDirectories: ['node_modules', '__tests-modules__'],
  projects: [
    // --- Project 1: Database / pure logic tests (node environment) ---
    {
      displayName: 'db',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/database'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      transform: baseTransform,
      transformIgnorePatterns: baseTransformIgnorePatterns,
      moduleNameMapper: baseModuleNameMapper,
      setupFilesAfterEnv: ['<rootDir>/src/database/queries/__tests__/setup.ts'],
      collectCoverageFrom: [
        'src/database/queries/**/*.ts',
        '!src/database/queries/**/__tests__/**',
      ],
    },

    // --- Project 2: React Native component / hook / integration tests ---
    {
      displayName: 'rn',
      preset: 'jest-expo',
      roots: ['<rootDir>/src'],
      testMatch: [
        '**/__tests__/**/*.test.tsx',
        // Also pick up non-db .test.ts (hooks, utils, services)
        '**/__tests__/**/*.test.ts',
      ],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/database/'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      transform: baseTransform,
      transformIgnorePatterns: baseTransformIgnorePatterns,
      moduleNameMapper: baseModuleNameMapper,
      setupFiles: ['<rootDir>/__mocks__/index.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.ts'],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/database/queries/**/__tests__/**',
        '!src/**/__tests__/**',
      ],
    },
    {
      displayName: 'js assets',
      preset: 'jest-expo',
      roots: ['<rootDir>'],
      testMatch: ['__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
      testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
      transform: baseTransform,
      transformIgnorePatterns: baseTransformIgnorePatterns,
      moduleNameMapper: baseModuleNameMapper,
      setupFiles: ['<rootDir>/__mocks__/index.js'],
      setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.ts'],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/database/queries/**/__tests__/**',
        '!src/**/__tests__/**',
      ],
    },
  ],

  // Global settings
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: true,
};
