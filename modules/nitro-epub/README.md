# Nitro EPUB

Cross-platform C++ EPUB support for LNReader, exposed through React Native Nitro
Modules.

## Capabilities

- Parse an extracted EPUB into novel metadata and chapter paths.
- Normalize raster-only SVG image wrappers into HTML images during import.
- Export downloaded chapter files as an EPUB 3 archive.
- Copy local chapter images into the archive and remove missing images.
- Generate EPUB navigation, NCX compatibility navigation, metadata, CSS, and
  optional JavaScript.
- Write the required `mimetype` entry first and without compression.
- Build exports on a Nitro worker thread and atomically publish the completed
  archive.
- Report completed chapter counts while an export is running.

The exporter accepts chapter file paths rather than chapter bodies so large
novels do not need to be retained in the JavaScript heap.

Import the shared runtime object from the package:

```ts
import { epub } from 'nitro-epub'

const novel = await epub.parseNovelAndChapters(extractedDirectory)
```

Run `pnpm specs` in this directory after changing `src/specs/Epub.nitro.ts`.
Generated Nitrogen sources are committed.
