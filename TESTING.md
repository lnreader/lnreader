# Testing Guide for LNReader

This guide explains how to write tests in this React Native project using Jest and React Testing Library.


## Existing Mocks

### Global Mocks

The project has global mocks configured in Jest. These are automatically applied:

- `test/mocks/` - Global mocks for native modules (react-native-mmkv, react-navigation, all database queries, etc.)
- `src/hooks/__mocks__/index.ts` - Hook-specific mocks (showToast, getString, parseChapterNumber, etc.)
- `src/hooks/__tests__/mocks.ts` - Extended mocks for persisted hooks

### Using @test-utils

There is a custom render wrapper at `test/test-utils.tsx` with:

- `render` - wraps with GestureHandlerRootView, SafeAreaProvider, PaperProvider, etc.
- `renderNovel` - includes NovelContextProvider
- `AllTheProviders` - the full provider wrapper

Usage:

```typescript
import { render, renderNovel } from '@test-utils';
```

## Common Issues

### 1. ESM Modules Not Transforming

If you see `Cannot use import statement outside a module`, you need to add mocks for the module:

```typescript
jest.mock('@hooks/persisted/usePlugins');
// Add more specific mocks as needed
```

### 2. Mock Functions Not Working

If `mockReturnValue` throws "not a function", create mock functions at the module level:

```typescript
// CORRECT: Module-level mock functions
const mockUseTheme = jest.fn();
jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

// INCORRECT: Trying to use jest.Mock type casting
// (useTheme as jest.Mock).mockReturnValue(...) // This fails!
```

### 3. Test Isolation

Tests must mock at module level, not in `beforeEach`:

```typescript
// CORRECT
const mockFn = jest.fn();
jest.mock('module', () => ({ useHook: () => mockFn() }));

// INCORRECT - mocks get reset between tests
jest.mock('module');
beforeEach(() => {
  // This doesn't work properly
});
```

## Running Tests

```bash
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm test:coverage  # With coverage
pnpm test:rn        # React Native only
pnpm test:db        # Database only
```
