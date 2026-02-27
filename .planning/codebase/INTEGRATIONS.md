# External Integrations

**Analysis Date:** 2026-02-27

## APIs & External Services

### Anime/Manga Trackers

**MyAnimeList (MAL):**

- Purpose: Track reading progress and discover new series
- API: `https://api.myanimelist.net/v2`
- OAuth: `https://myanimelist.net/v1/oauth2/authorize`
- Token: `https://myanimelist.net/v1/oauth2/token`
- Implementation: `src/services/Trackers/myAnimeList.ts`
- Features: Novel tracking, search, cover images

**Kitsu:**

- Purpose: Track reading progress
- API: `https://kitsu.app/api/edge/`
- OAuth: `https://kitsu.app/api/oauth/token`
- Algolia Search: `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/production_media/query/`
- Implementation: `src/services/Trackers/kitsu.ts`
- Features: Library sync, search

**AniList:**

- Purpose: Track reading/watching progress
- API: GraphQL endpoint `https://graphql.anilist.co`
- OAuth: `https://anilist.co/api/v2/oauth/authorize`
- Implementation: `src/services/Trackers/aniList.ts`
- Authentication: OAuth 2.0 with token exchange

**MangaUpdates:**

- Purpose: Track manga/novel reading status
- API: `https://api.mangaupdates.com/v1`
- Implementation: `src/services/Trackers/mangaUpdates.ts`
- Features: Series tracking, reading status

### GitHub

**GitHub API:**

- Purpose: Check for app updates
- Endpoint: `https://api.github.com/repos/lnreader/lnreader/releases/latest`
- Implementation: `src/hooks/common/useGithubUpdateChecker.ts`
- Usage: Version checking for app updates

### Web Scraping

**MyAnimeList Web Scraper:**

- Purpose: Discover new series from MAL rankings
- URLs:
  - Rankings: `https://myanimelist.net/topmanga.php?type=lightnovels`
  - Search: `https://myanimelist.net/manga.php`
- Implementation: `src/screens/browse/discover/MyAnimeListScraper.ts`
- Note: Scrapes HTML directly (not official API)

## Data Storage

**Databases:**

- SQLite (local)
  - Engine: `@op-engineering/op-sqlite`
  - ORM: `drizzle-orm`
  - Location: App's private storage (`../files/SQLite/lnreader.db`)
  - Migrations: `drizzle/` directory
  - Schema: `src/database/schema/`

**File Storage:**

- Local filesystem (app private storage)
  - Novel downloads: `./files/`
  - EPUB exports
  - Cover images cache

**Caching:**

- react-native-mmkv for fast key-value storage
  - User preferences
  - Theme settings
  - Session data

## Authentication & Identity

**Google Sign-In:**

- Package: `@react-native-google-signin/google-signin`
- Implementation: Native module
- Usage: Backup/restore to Google Drive
- Scopes: Google Drive API access

## Monitoring & Observability

**Error Tracking:**

- Not detected - No external error tracking service

**Logs:**

- Console logging (development only)
- Database query logging in development mode

## CI/CD & Deployment

**Hosting:**

- Google Play Store (Android)
- Apple App Store (iOS)

**CI Pipeline:**

- GitHub Actions - `.github/workflows/`
- Android: Gradle builds
- iOS: Xcode builds

**Translation:**

- Crowdin - `crowdin.yml`
- Configuration: `strings/` directory

## Environment Configuration

**Build-time environment variables:**

- `BUILD_TYPE` - Debug or Release
- `GIT_HASH` - Git commit hash
- `RELEASE_DATE` - Build timestamp
- `NODE_ENV` - Development or production

**Required env vars (runtime):**

- Generated at build time via `scripts/generate-env-file.cjs`
- No runtime secrets required (all features are local or OAuth-based)

## Webhooks & Callbacks

**Incoming:**

- None detected - No webhook endpoints

**Outgoing:**

- OAuth redirects for tracker authentication
- Google Drive API calls for backup/restore

---

_Integration audit: 2026-02-27_
