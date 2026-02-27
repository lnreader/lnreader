# Technology Stack

**Analysis Date:** 2026-02-27

## Languages

**Primary:**

- TypeScript ~5.9.3 - Core application code, database queries, services
- JavaScript - Build scripts, codegen, some utilities

**Secondary:**

- Ruby - CocoaPods dependencies (iOS)
- Kotlin - Android native modules
- Swift - iOS native modules
- Nix - Development environment setup

## Runtime

**Environment:**

- Node.js >= 20 - Development and build tooling
- React Native 0.81.6 - Mobile runtime

**Package Manager:**

- pnpm 10.27.0 - Primary package manager
- Lockfile: `pnpm-lock.yaml` (committed)

## Frameworks

**Core:**

- React Native 0.81.6 - Cross-platform mobile framework
- Expo SDK 54 - Extended API access and tooling
- React 19.1.4 - UI library

**Navigation:**

- @react-navigation/native 7.1.28 - Navigation container
- @react-navigation/native-stack 7.13.0 - Stack navigator
- @react-navigation/bottom-tabs 7.14.0 - Tab navigator
- @react-navigation/stack 7.7.2 - Gesture-based stack

**UI Components:**

- react-native-paper 5.15.0 - Material Design 3 components
- @shopify/flash-list 2.0.2 - High-performance list
- @legendapp/list 2.0.19 - Alternative list component
- lottie-react-native 5.1.6 - Animation support

**Testing:**

- Jest 29.7.0 - Test runner
- @types/jest 29.5.14 - TypeScript types for Jest

**Build/Dev:**

- Metro 0.81.6 - JavaScript bundler
- @react-native/codegen 0.81.6 - Native module code generation
- babel-plugin-react-compiler 19.1.0-rc.3 - React compiler
- TypeScript ~5.9.3 - Type checking

**Linting/Formatting:**

- ESLint 8.57.1 - Linting
- Prettier 2.8.8 - Code formatting
- Husky 7.0.4 - Git hooks

## Key Dependencies

**Database:**

- @op-engineering/op-sqlite 15.2.5 - SQLite database engine
- drizzle-orm 1.0.0-beta.13-f728631 - ORM with type-safe queries
- drizzle-kit 1.0.0-beta.13-f728631 - Migration tooling
- better-sqlite3 12.6.2 - Type definitions

**Native Modules:**

- react-native-gesture-handler 2.30.0 - Gesture handling
- react-native-reanimated 4.2.2 - Animations
- react-native-worklets 0.7.4 - Worklet support for Reanimated
- react-native-screens 4.23.0 - Native navigation primitives
- react-native-safe-area-context 5.6.2 - Safe area handling
- react-native-webview 13.15.0 - WebView component
- react-native-pager-view 6.9.1 - ViewPager component

**Data & Networking:**

- cheerio 1.0.0-rc.12 - HTML parsing
- htmlparser2 10.1.0 - HTML/XML parsing
- sanitize-html 2.17.1 - HTML sanitization
- urlencode 2.0.0 - URL encoding

**Storage & Files:**

- react-native-mmkv 3.3.3 - Fast key-value storage
- react-native-file-access 3.2.0 - File system access
- expo-file-system 19.0.21 - File operations

**Utilities:**

- dayjs 1.11.19 - Date handling
- lodash-es 4.17.23 - Utility functions
- color 5.0.3 - Color manipulation
- protobufjs 7.5.4 - Protocol buffers

**Expo Modules (partial list):**

- expo-clipboard 8.0.8 - Clipboard access
- expo-document-picker 14.0.8 - Document selection
- expo-haptics 15.0.8 - Haptic feedback
- expo-notifications 0.32.16 - Push notifications
- expo-speech 14.0.8 - Text-to-speech
- expo-linear-gradient 15.0.8 - Gradient backgrounds
- expo-localization 17.0.8 - Locale information
- expo-keep-awake 15.0.8 - Prevent sleep mode

**Authentication:**

- @react-native-google-signin/google-signin 16.1.1 - Google OAuth

**EPUB:**

- @cd-z/react-native-epub-creator 3.0.0 - EPUB generation

## Configuration

**Environment:**

- `.env` file - Generated at build time
- Build variables: BUILD_TYPE, GIT_HASH, RELEASE_DATE, NODE_ENV
- Generated via `scripts/generate-env-file.cjs`

**Build Configuration:**

- `babel.config.js` - Babel transpilation
- `metro.config.js` - Metro bundler configuration
- `tsconfig.json` - TypeScript configuration
- `jest.config.js` - Jest testing configuration
- `drizzle.config.ts` - Database migration config

**Code Generation:**

- React Native Codegen - Native module bindings
- Codegen spec in `specs/` directory

## Platform Requirements

**Development:**

- Node.js >= 20
- pnpm >= 10
- Android Studio (Android development)
- Xcode (iOS development)
- CocoaPods (iOS dependencies)

**Production:**

- Android APK/AAB
- iOS IPA
- Target: Android API 24+ (Android 7.0+)
- Target: iOS 15.1+

---

_Stack analysis: 2026-02-27_
