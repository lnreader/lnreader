# Architecture

**Analysis Date:** 2026-02-27

## Pattern Overview

**Overall:** React Native Mobile Application with Clean Architecture principles

**Key Characteristics:**

- Layered architecture with clear separation between UI, business logic, and data
- React Navigation for routing with stack and bottom tab navigators
- SQLite database with Drizzle ORM for data persistence
- Plugin-based system for extensible source support
- Background task processing for long-running operations (downloads, updates, backups)
- State management via React hooks (persisted with MMKV for settings, React Context for UI state)

## Layers

### UI Layer (Screens & Components)

**Purpose:** Presentation and user interaction

- Location: `src/screens/`, `src/components/`
- Contains: React Native components, screens, navigation
- Depends on: Hooks layer for data access
- Used by: Navigation system

**Structure:**

- `src/screens/` - Full-screen views organized by feature (Library, Novel, Reader, Browse, Settings, etc.)
- `src/components/` - Reusable UI components (Button, List, BottomSheet, etc.)
- `src/navigators/` - Navigation configuration and stack definitions

### Hooks Layer (State & Business Logic)

**Purpose:** State management and business logic encapsulation

- Location: `src/hooks/`
- Contains: Custom React hooks for data access, state management
- Depends on: Services, Database queries
- Used by: Screens and Components

**Two categories:**

1. **Persisted hooks** (`src/hooks/persisted/`) - Settings and state persisted via MMKV
   - `useTheme`, `useSettings`, `usePlugins`, `useTracker`, `useCategories`, `useHistory`, `useDownload`, `useNovel`, `useUpdates`
2. **Common hooks** (`src/hooks/common/`) - UI and utility hooks
   - `useSearch`, `useBackHandler`, `useFullscreenMode`, `useDeviceOrientation`

### Services Layer (Business Logic)

**Purpose:** Background operations and complex business logic

- Location: `src/services/`
- Contains: Background task handlers, backup/restore, downloads, library updates, tracking
- Depends on: Database, Plugins
- Used by: Hooks layer, ServiceManager

**Key services:**

- `ServiceManager.ts` - Background task orchestration using `react-native-background-actions`
- `updates/` - Library update checking and chapter refresh
- `download/` - Chapter download management
- `backup/` - Local, Google Drive, and self-hosted backup/restore
- `migrate/` - Novel migration between sources
- `epub/` - EPUB import functionality

### Plugin Layer

**Purpose:** Extensible source system for fetching novels and chapters

- Location: `src/plugins/`
- Contains: Plugin manager, helper utilities, type definitions
- Provides: Runtime loading and execution of source plugins
- Depends on: Database for plugin storage

### Data Layer

**Purpose:** Data persistence and retrieval

- Location: `src/database/`
- Contains: SQLite database, Drizzle ORM schema, query functions
- Depends on: None (pure data layer)
- Used by: Hooks layer, Services

**Structure:**

- `src/database/schema/` - Table definitions (novel, chapter, category, repository)
- `src/database/queries/` - CRUD operations per domain (NovelQueries, ChapterQueries, LibraryQueries, etc.)
- `src/database/manager/` - Database lifecycle management
- `src/database/db.ts` - Database initialization and migration

### API Layer

**Purpose:** External service integration

- Location: `src/api/`
- Contains: Google Drive API, remote source fetching
- Used by: Services for backup/restore operations

## Data Flow

### Reading a Novel (Novel Screen)

1. User navigates to Novel screen via navigation
2. `NovelScreen.tsx` uses `useNovel` hook to fetch novel data
3. `useNovel` hook calls `NovelQueries.getNovel` to retrieve from SQLite
4. Novel and chapter data rendered via React components
5. User can start reading → navigates to Reader screen

### Library Updates

1. Background task triggered via `ServiceManager.addTask({ name: 'UPDATE_LIBRARY' })`
2. `ServiceManager.launch()` processes task queue
3. `updates/index.ts` iterates through installed plugins
4. Each plugin fetches new chapters from source
5. New chapters inserted via `ChapterQueries.insertChapters`
6. Progress updates via notification API
7. UI updates via React Query or context refresh

### Chapter Download

1. User initiates download from Novel screen
2. `ServiceManager.addTask({ name: 'DOWNLOAD_CHAPTER', data: {...} })`
3. Background service fetches chapter content via plugin
4. Content stored locally via file system
5. Progress shown via system notification

## Key Abstractions

### ServiceManager (Singleton Pattern)

- Purpose: Background task orchestration
- Examples: `src/services/ServiceManager.ts`
- Pattern: Singleton with static `manager` getter, background task queue processing

### Database Queries (Repository Pattern)

- Purpose: Type-safe data access
- Examples: `src/database/queries/NovelQueries.ts`, `ChapterQueries.ts`, `LibraryQueries.ts`
- Pattern: Drizzle ORM queries wrapped in domain-specific functions

### Persisted Hooks

- Purpose: Settings persistence across app restarts
- Examples: `src/hooks/persisted/useSettings.ts`, `useTheme.ts`
- Pattern: React hooks using MMKV for storage, providing React state interface

### Plugin System

- Purpose: Extensible source support
- Examples: `src/plugins/pluginManager.ts`, plugin helpers
- Pattern: Dynamic code loading from bundled JS or remote repositories

## Entry Points

### App Entry (Root Component)

- Location: `App.tsx`
- Triggers: App launch
- Responsibilities: Initialize database, providers, error boundary, main navigation

### Main Navigator

- Location: `src/navigators/Main.tsx`
- Triggers: Navigation container setup, authentication state
- Responsibilities: Root navigation stack, deep linking, theme configuration

### Bottom Navigator

- Location: `src/navigators/BottomNavigator.tsx`
- Triggers: Tab bar navigation
- Responsibilities: Library, Browse, History, Stats, More tabs

### Database Initialization

- Location: `src/database/db.ts`
- Triggers: App startup via `useInitDatabase` hook
- Responsibilities: SQLite open, Drizzle setup, migration run, pragma configuration

### Background Service

- Location: `src/services/ServiceManager.ts`
- Triggers: Task addition via `addTask()`, app restart with pending tasks
- Responsibilities: Long-running operations (downloads, updates, backups)

## Error Handling

**Strategy:** Error boundaries with fallback UI

**Patterns:**

- React Error Boundary (`src/components/AppErrorBoundary/AppErrorBoundary.tsx`) - Catches render errors
- Try-catch in service methods for background operations
- Notification-based error reporting for background task failures
- Database transaction handling for atomic operations

## Cross-Cutting Concerns

**Logging:** Minimal console logging (commented out in production), database query logging in dev mode

**Validation:** Input validation in hooks and service methods

**Authentication:** OAuth for Google Drive backup, token-based for anime list trackers

**Theme:** React Native Paper theming with custom color palette, persisted via MMKV

---

_Architecture analysis: 2026-02-27_
