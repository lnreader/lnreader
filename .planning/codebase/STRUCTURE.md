# Codebase Structure

**Analysis Date:** 2026-02-27

## Directory Layout

```
lnreader/
├── App.tsx                          # Root component entry point
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
├── .eslintrc.js                     # ESLint configuration
├── src/
│   ├── api/                        # External API integrations
│   ├── components/                 # Reusable UI components
│   ├── database/                   # Data persistence layer
│   ├── hooks/                      # Custom React hooks
│   ├── navigators/                 # Navigation configuration
│   ├── plugins/                    # Plugin system
│   ├── screens/                    # Screen components
│   ├── services/                   # Business logic services
│   ├── strings/                    # Localization strings
│   ├── theme/                      # Theming utilities
│   └── utils/                      # Utility functions
├── android/                        # Android native code
├── ios/                           # iOS native code
├── drizzle/                       # Database migrations
└── scripts/                       # Build scripts
```

## Directory Purposes

### `src/api/`

- **Purpose:** External API integrations
- **Contains:** Google Drive API, remote source fetching
- **Key files:**
  - `src/api/drive/index.ts` - Google Drive backup/restore
  - `src/api/remote/index.ts` - Generic HTTP client for sources

### `src/components/`

- **Purpose:** Reusable UI components
- **Contains:** Buttons, lists, modals, sheets, common UI elements
- **Key files:**
  - `src/components/Button/` - Custom button variants
  - `src/components/BottomSheet/` - Bottom sheet modal
  - `src/components/List/` - List container
  - `src/components/NovelList.tsx` - Novel display list
  - `src/components/Common.tsx` - Common component exports
  - `src/components/Context/` - React context providers

### `src/database/`

- **Purpose:** Data persistence and queries
- **Contains:** SQLite database, schema, queries, migrations
- **Key files:**
  - `src/database/db.ts` - Database initialization
  - `src/database/schema/` - Table definitions (novel, chapter, category, repository)
  - `src/database/queries/` - CRUD operations per domain
  - `src/database/manager/` - Database lifecycle management

### `src/hooks/`

- **Purpose:** Custom React hooks for state and logic
- **Contains:** State management hooks, UI hooks
- **Subdirectories:**
  - `src/hooks/persisted/` - MMKV-persisted settings hooks
  - `src/hooks/common/` - Non-persisted utility hooks
- **Key files:**
  - `src/hooks/persisted/useSettings.ts` - App settings
  - `src/hooks/persisted/useTheme.ts` - Theme settings
  - `src/hooks/persisted/usePlugins.ts` - Plugin management

### `src/navigators/`

- **Purpose:** Navigation configuration
- **Contains:** Stack navigators, tab navigator, navigation types
- **Key files:**
  - `src/navigators/Main.tsx` - Root navigation container
  - `src/navigators/BottomNavigator.tsx` - Tab bar navigation
  - `src/navigators/ReaderStack.tsx` - Reader-specific navigation
  - `src/navigators/MoreStack.tsx` - Settings and more stack
  - `src/navigators/types/index.ts` - Navigation type definitions

### `src/plugins/`

- **Purpose:** Plugin system for sources
- **Contains:** Plugin manager, helpers, type definitions
- **Key files:**
  - `src/plugins/pluginManager.ts` - Plugin loading and management
  - `src/plugins/types/` - Plugin type definitions

### `src/screens/`

- **Purpose:** Full-screen views
- **Contains:** Screen components organized by feature
- **Structure:**
  - `src/screens/library/` - Library screen and components
  - `src/screens/novel/` - Novel detail screen and components
  - `src/screens/reader/` - Reader screen and components
  - `src/screens/browse/` - Browse/source discovery
  - `src/screens/settings/` - Settings screens
  - `src/screens/history/` - Reading history
  - `src/screens/StatsScreen/` - Statistics
  - `src/screens/more/` - More menu
  - `src/screens/onboarding/` - First-time setup

### `src/services/`

- **Purpose:** Background services and business logic
- **Contains:** Background task handlers
- **Key files:**
  - `src/services/ServiceManager.ts` - Background task orchestration
  - `src/services/updates/` - Library update logic
  - `src/services/download/` - Chapter download
  - `src/services/backup/` - Backup/restore (local, drive, self-host)
  - `src/services/migrate/` - Novel migration
  - `src/services/epub/` - EPUB import
  - `src/services/Trackers/` - Anime list tracker integrations

### `src/strings/`

- **Purpose:** Localization strings
- **Contains:** i18n translation files

### `src/theme/`

- **Purpose:** Theming utilities
- **Contains:** Color utilities, status bar configuration

### `src/utils/`

- **Purpose:** Utility functions
- **Contains:** MMKV helpers, fetch utilities, constants, helpers

## Key File Locations

### Entry Points

- `App.tsx` - Root React component
- `src/database/db.ts` - Database initialization

### Configuration

- `package.json` - Dependencies, scripts
- `tsconfig.json` - TypeScript config
- `.eslintrc.js` - Linting rules

### Core Logic

- `src/services/ServiceManager.ts` - Background task management
- `src/database/queries/` - Data access functions

### Navigation

- `src/navigators/Main.tsx` - Main navigation setup
- `src/navigators/types/index.ts` - Navigation param types

## Naming Conventions

### Files

- PascalCase for components: `NovelScreen.tsx`, `ChapterItem.tsx`
- PascalCase for hooks: `useNovel.ts`, `useTheme.ts`
- PascalCase for query files: `NovelQueries.ts`, `ChapterQueries.ts`
- camelCase for utilities: `mmkv.ts`, `fetch.ts`

### Directories

- Lowercase with hyphens for feature directories: `src/screens/library/`, `src/services/updates/`
- PascalCase for component folders: `src/components/Button/`, `src/screens/novel/components/`

### Types

- PascalCase for types and interfaces: `NovelRow`, `ChapterInsert`
- Suffix with "Row" for database row types: `NovelRow`, `ChapterRow`
- Suffix with "Insert" for insert types: `NovelInsert`, `ChapterInsert`

## Where to Add New Code

### New Feature

- Primary code: `src/screens/[feature]/`
- Tests: `src/database/queries/__tests__/` for data-related tests

### New Component/Module

- Reusable UI: `src/components/[ComponentName]/`
- Service logic: `src/services/[serviceName]/`
- Hook: `src/hooks/persisted/` or `src/hooks/common/`

### New Database Entity

- Schema: `src/database/schema/[entity].ts`
- Queries: `src/database/queries/[Entity]Queries.ts`
- Migrations: `drizzle/` directory

### New Plugin Helper

- Implementation: `src/plugins/helpers/[helper].ts`
- Types: `src/plugins/types/`

### New Settings

- Hook: `src/hooks/persisted/use[Setting].ts`
- UI: `src/screens/settings/`

## Special Directories

### `drizzle/`

- **Purpose:** Database migration files
- **Generated:** Yes (via `drizzle-kit generate`)
- **Committed:** Yes

### `android/`, `ios/`

- **Purpose:** Native platform code
- **Generated:** Partially (scaffolded, then modified)
- **Committed:** Yes

### `src/database/queries/__tests__/`

- **Purpose:** Database query tests
- **Committed:** Yes
- **Files:** `*.test.ts`

---

_Structure analysis: 2026-02-27_
