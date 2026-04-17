# Changelog

All notable changes to KotoMiner are documented here.

---

## [1.1.0] - 2026-04-17

### Added
- Benchmark tab: tests all bundled `minerd-*.exe` variants against the live pool and pins the fastest for future sessions
- Tray support: optional minimize-to-tray with Show / Pause / Resume / Quit menu
- Faucet shortcut: in-app link to isekai-pool.com earn activities
- Per-thread hashrate parsing where available in miner output
- Busy UI state during active mining to prevent double-starts
- Clean process cleanup on exit — kills stray `minerd` processes on Windows

### Changed
- Mining state (address, pool URL, pinned CPU variant) now persists across tab changes and app restarts
- Default pool updated to `koto.isekai-pool.com:3032`
- Improved log parsing for pool-accepted share lines and total H/s

### Fixed
- Miner process not terminating cleanly on Windows in some exit paths
- Hashrate display not updating after variant switch

---

## [1.0.0] - Initial release

- Basic Mine / Stop workflow against configurable stratum pool
- CPU variant auto-selection (AVX2 → AVX → SSE2 → generic)
- Hashrate and log display
- Settings: wallet address and pool URL
