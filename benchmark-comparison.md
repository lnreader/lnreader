## Backup restore benchmark: v2 vs v3

Compared the legacy v2 backup (`1.bench.zip`) with the new v3 backup (`2.bench.zip`). Both runs restored **7,323 novels** with **0 failures**, 9 categories, and 14 plugins.

### End-to-end result

| Metric | Legacy v2 | New v3 | Change |
|---|---:|---:|---:|
| Total restore time | 5m 15.6s | 4m 11.0s | **64.7s faster (20.5%)** |

Total time is measured from `local:start` through `local:finalize:done`.

### Restore phases

| Phase | Legacy v2 | New v3 | Change |
|---|---:|---:|---:|
| Copy | 12.8s | 13.2s | 0.5s slower |
| Outer unzip | 46.3s | 30.2s | **16.1s faster (34.7%)** |
| Novel validation | 46.7s | 24.9s | **21.9s faster (46.8%)** |
| Novel restore loop | 206.8s | 179.0s | **27.8s faster (13.4%)** |

### Novel restore timing breakdown

| Operation | Legacy v2 | New v3 | Change |
|---|---:|---:|---:|
| Read | 52.5s | 16.6s | **35.9s faster (68.4%)** |
| Parse | 45.5s | 32.7s | **12.8s faster (28.2%)** |
| Database | 135.5s | 136.7s | 1.3s slower (0.9%) |
| Covers | 19.6s | 17.8s | 1.8s faster (9.0%) |

The v3 run reduced end-to-end restore time by **about one minute**. The largest per-operation improvement was reading novel data, while database time was effectively unchanged. The phase durations and per-operation timings are reported separately from the benchmark logs; the operation timings should not be summed as if they were sequential phases.
