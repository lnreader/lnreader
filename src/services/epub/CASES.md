# EPUB Import/Export Bug-Case Manifest (CASES.md)

One line per known bug case: symptom → fixture config / test name. When a
new EPUB import/export bug surfaces, add its reproduction here and pin it
with a test in `importEpub.test.ts` (or a new sibling file) before fixing.

## Pinned cases (covered by tests)

| Symptom                                                            | Fixture / test                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Novel imported but not in library / missing local flags            | AC3 happy path — `importEpub.test.ts` "inserts the novel local+inLibrary"     |
| Category not auto-assigned on local import                         | AC3 happy path — same test, `updateNovelCategoryById(100, [2])`               |
| Unnamed novel imported under a garbage internal name               | Name-fallback test — "derives the novel name from the filename"               |
| 50 MB EPUB balloons to ~94 MB after import                         | AC4 moveFile budget — "calls moveFile exactly once per existing source image" |
| Missing image aborts the whole import                              | AC4 skip test — "skips moveFile for sources that do not exist"                |
| Import failure invisible: toast fires, progress completes silently | AC5 silent-catch pin — "toasts and still terminates progress at 1"            |

## Known gaps (deliberately deferred — do NOT assume covered)

| Gap                                    | Why deferred                              | Tracking                        |
| -------------------------------------- | ----------------------------------------- | ------------------------------- |
| Export → re-import round-trip fidelity | Needs real Nitro parser; v2 candidate     | First entry when reopened       |
| Silent-catch becomes loud failure      | Behavior change; own PR flips the AC5 pin | Follow-up PR after #1997 merges |
| Bionic-style highlighting in RSVP      | Out of scope for #1997 (RSVP follow-up)   | Separate ticket                 |

## Intake protocol

1. Reproduce the bug against current master with the smallest possible EPUB.
2. Encode it as a `FixtureConfig` (or extend `generator.ts` if the seam is new).
3. Add one test named `<symptom> (<issue #>)` that FAILS pre-fix.
4. Fix; test goes green; add the manifest row above.
