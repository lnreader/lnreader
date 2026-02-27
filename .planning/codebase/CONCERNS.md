# Codebase Concerns

**Analysis Date:** 2026-02-27

## Tech Debt

### Plugin System Security Risk

- **Issue:** Plugin code is executed using the `Function` constructor (essentially `eval`)
- **Files:** `src/plugins/pluginManager.ts` (lines 55-61)
- **Impact:** Malicious plugins can execute arbitrary code on user's device
- **Fix approach:** Implement sandboxed plugin execution or use a proper sandboxing solution

### WebView Security Configuration

- **Issue:** WebView uses `originWhitelist={['*']}` allowing all origins
- **Files:** `src/screens/reader/components/WebViewReader.tsx` (line 315)
- **Impact:** Potential for malicious content injection
- **Fix approach:** Restrict to specific domains or implement proper CSP

### Undeleted Download Files

- **Issue:** When chapters are unmarked as downloaded, the files remain on disk but database is updated
- **Files:** `src/database/queries/ChapterQueries.ts` (line 189)
- **Impact:** Wasted storage space
- **Fix approach:** Delete actual files when marking chapters as not downloaded

### Silent Error Swallowing

- **Issue:** Multiple empty catch blocks that silently ignore errors
- **Files:**
  - `src/services/updates/LibraryUpdateQueries.ts` (lines 226, 240)
  - `src/screens/reader/hooks/useChapter.ts` (lines 167, 189)
- **Impact:** Errors go unnoticed, making debugging difficult
- **Fix approach:** Add proper error logging or user-facing error messages

### Large Monolithic Files

- **Issue:** Several files exceed 400 lines, indicating potential complexity
- **Files:**
  - `src/hooks/persisted/useNovel.ts` (690 lines)
  - `src/database/queries/ChapterQueries.ts` (656 lines)
  - `src/services/ServiceManager.ts` (475 lines)
  - `src/services/Trackers/kitsu.ts` (489 lines)
- **Impact:** Hard to maintain, test, and understand
- **Fix approach:** Split into smaller, focused modules

### Type Safety Gaps

- **Issue:** Using `as any` type assertions in production code
- **Files:** `src/services/backup/utils.ts` (line 39)
- **Impact:** Runtime errors due to incorrect types
- **Fix approach:** Define proper types or use type guards

### Incomplete Backup Operations

- **Issue:** Comment indicates incomplete backup file cleanup
- **Files:** `src/services/backup/local/index.ts` (line 154)
- **Impact:** Potential for orphaned backup files

### Unimplemented Feature

- **Issue:** TODO comment about updating default category
- **Files:** `src/screens/settings/SettingsLibraryScreen/SettingsLibraryScreen.tsx` (line 18)
- **Impact:** Missing functionality for category management

### Task Queue Management

- **Issue:** No way to cancel individual tasks from task queue screen
- **Files:** `src/screens/more/TaskQueueScreen.tsx` (line 36)
- **Impact:** Users cannot stop specific background tasks

---

## Security Considerations

### Plugin Execution

- **Risk:** Plugins run with full access via `Function` constructor
- **Files:** `src/plugins/pluginManager.ts`
- **Current mitigation:** None
- **Recommendations:**
  - Implement plugin code signing
  - Use isolated VM or worker for plugin execution
  - Add runtime permissions for sensitive operations

### WebView Configuration

- **Risk:** `originWhitelist={['*']}` allows loading from any domain
- **Files:** `src/screens/reader/components/WebViewReader.tsx`
- **Current mitigation:** Debugging only enabled in dev mode (`webviewDebuggingEnabled={__DEV__}`)
- **Recommendations:** Restrict to known source domains

### Sensitive Data in Storage

- **Risk:** Plugin storage may contain sensitive data
- **Files:** `src/plugins/helpers/storage.ts`
- **Recommendations:** Encrypt plugin storage

---

## Performance Bottlenecks

### Large Novel Data Loading

- **Problem:** `useNovel.ts` hook loads entire novel data in memory
- **Files:** `src/hooks/persisted/useNovel.ts`
- **Cause:** No pagination for large novel libraries
- **Improvement path:** Implement virtualized loading for large datasets

### Database Query Optimization

- **Problem:** Multiple sequential queries in update operations
- **Files:** `src/services/updates/LibraryUpdateQueries.ts`
- **Improvement path:** Batch queries where possible

---

## Fragile Areas

### Background Service Manager

- **Files:** `src/services/ServiceManager.ts`
- **Why fragile:** Singleton with complex state management, handles multiple background tasks
- **Safe modification:** Add comprehensive tests, document state transitions
- **Test coverage:** Limited

### Plugin Loading

- **Files:** `src/plugins/pluginManager.ts`
- **Why fragile:** Uses dynamic code execution, no validation
- **Safe modification:** Add validation layer before execution
- **Test coverage:** Limited

### Database Migrations

- **Files:** `src/database/db.ts`, `src/database/manager/manager.ts`
- **Why fragile:** Schema changes can break existing data
- **Safe modification:** Always create migration files, test rollback

---

## Dependencies at Risk

### Drizzle ORM Beta

- **Risk:** Using beta version (`drizzle-orm: 1.0.0-beta.13-f728631`)
- **Impact:** Potential breaking changes in future updates
- **Migration plan:** Monitor stable release and upgrade when available

### Expo SDK 54

- **Risk:** Using latest Expo which may have breaking changes
- **Impact:** Potential issues with native module compatibility
- **Migration plan:** Test thoroughly before upgrading

---

## Test Coverage Gaps

### Service Manager

- **What's not tested:** Background task queuing, error recovery
- **Files:** `src/services/ServiceManager.ts`
- **Risk:** Background operations may fail silently
- **Priority:** High

### Plugin System

- **What's not tested:** Plugin loading, security sandboxing
- **Files:** `src/plugins/pluginManager.ts`
- **Risk:** Malicious plugins could cause issues
- **Priority:** High

### Backup/Restore

- **What's not tested:** Partial restore scenarios, corrupted backups
- **Files:** `src/services/backup/`
- **Risk:** Data loss during backup operations
- **Priority:** High

### Trackers Integration

- **What's not tested:** API failures, rate limiting
- **Files:** `src/services/Trackers/`
- **Risk:** Tracker sync failures not handled gracefully
- **Priority:** Medium

---

_Concerns audit: 2026-02-27_
