# EPUB Import/Export Bug-Case Manifest (CASES.md)

One line per known bug case: symptom → fixture config / test name. When a
new EPUB import/export bug surfaces, add its reproduction here and pin it
with a test in `port.test.ts` (or a new sibling file) before fixing.

The public surface is now the port (`port.ts`): `importNovel(file)` and
`exportNovel(novelId, options)` returning `Result<T, EpubError[]>` with
typed progress phases. Errors are data; nothing in this module toasts.

## Pinned cases (covered by port.test.ts)

| Symptom                                                            | Fixture / test                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Novel imported but not in library / missing local flags            | AC3 happy path — "returns ok with novelId/name/chapterCount"                    |
| Category not auto-assigned on local import                         | AC3 happy path — same test, category asserted via NovelQueries mock             |
| Unnamed novel imported under a garbage internal name               | Name-fallback contract (helpers) + happy-path name assertion                    |
| 50 MB EPUB balloons to ~94 MB after import                         | AC4 moveFile budget — operation counts pinned per cohort in port tests          |
| Missing image aborts the whole import                              | image-move-partial test — failed moves collected, not fatal                     |
| Import failure invisible: toast fires, progress completes silently | Silent-catch is GONE at this layer: every failure returns `{ok: false, errors}` |
| Corrupt archive crashes the app                                    | zip-corrupt test — rejection maps to `{kind: 'zip-corrupt'}`                    |
| Source file missing mid-flow                                       | file-not-found test — maps to data, no throw                                    |
| Parse explodes on malformed structure                              | parse-failure test — error message carried as data                              |
| Database insert fails at novel or chapter stage                    | db-write-failure tests — stage attributed                                       |

## Known gaps (deliberately deferred — do NOT assume covered)

| Gap                                          | Why deferred                                                                                           | Tracking                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Export → re-import round-trip fidelity       | Needs real Nitro parser on device                                                                      | v2 candidate, first entry when reopened |
| Wall-clock timing budgets                    | Replaced by deterministic operation-count budgets (ruling f30793b)                                     | Closed by design                        |
| Reader-theme stylesheet/JS in exported EPUBs | Old caller-assembled metadata dropped with the legacy data shape; port exports canonical metadata only | Follow-up if requested                  |
| Chapter-range export (start/end)             | Port exports downloaded set; range selection needs a port option                                       | Follow-up if requested                  |

## Intake protocol

1. Reproduce the bug against current master with the smallest possible EPUB.
2. Encode it as a `FixtureConfig` (or extend `generator.ts` if the seam is new).
3. Add one test named `<symptom> (<issue #>)` that FAILS pre-fix.
4. Fix; test goes green; add the manifest row above.
