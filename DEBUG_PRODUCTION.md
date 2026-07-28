# Debugging Production Builds

Symbolicate production stack traces from LNReader using uploaded sourcemaps.

## Prerequisites

- **Node.js** (v18 or later)
- The **sourcemap** matching the crashing APK version
- A **stack trace** from either `adb logcat` (device attached) or pasted from a Discord / GitHub issue report

## Getting the Sourcemap

### Release builds

Sourcemaps are uploaded as GitHub release assets. Download the one matching the crashing version:

```
LNReader-v{version}-sourcemap.map
```

Example for `v2.5.0`:

1. Go to the [releases page](https://github.com/lnreader/lnreader/releases)
2. Find release `v2.5.0`
3. Under **Assets**, download `LNReader-v2.5.0-sourcemap.map`

### Preview / nightly builds

Sourcemaps are uploaded as a separate artifact alongside the preview APK, named `LNReader-{sha}-sourcemap`.

1. Go to the [Actions tab](https://github.com/lnreader/lnreader/actions) → **Build Preview**
2. Find the workflow run matching the build hash
3. Under **Artifacts**, download the one with the `-sourcemap` suffix

## Symbolicating a Stack Trace

Save the raw stack trace to a file (from `adb logcat`, or paste from Discord/GitHub into `trace.txt`), then run:

```bash
npx metro-symbolicate <sourcemap.map> < trace.txt
```

Or pipe it directly:

```bash
adb logcat -d | npx metro-symbolicate <sourcemap.map>
```

## Example

Before (Hermes-obfuscated):

```
com.lnreader  E  Error: Unexpected token
    at 93795 (address at index.js:1:729193)
    at 28471 (address at index.js:1:219482)
    at 10384 (address at index.js:1:81729)
```

After symbolication:

```
com.lnreader  E  Error: Unexpected token
    at handleResponse (src/api/plugins.ts:120:12)
    at fetchPlugin (src/hooks/usePlugins.ts:45:8)
    at getPluginList (src/screens/browse/BrowseScreen.tsx:89:20)
```

## Troubleshooting

- **Version mismatch**: the sourcemap must match the exact APK build. A mismatched version produces wrong file names and line numbers.
- **No sourcemap artifact**: verify the workflow that built the APK ran successfully and that the "Upload Sourcemaps" / "Upload Preview Sourcemap" step completed without errors.
- **Hermes bytecode**: Hermes compiles JS to bytecode. The sourcemap is generated during this step and maps bytecode offsets back to source. `metro-symbolicate` handles this transparently.
