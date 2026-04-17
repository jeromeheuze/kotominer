# Build assets (icons)

**electron-builder** reads from this folder (`buildResources: build` in `electron-builder.yml`).

| File | Use |
|------|-----|
| **`icon.ico`** | **Windows** — installer, exe, taskbar. Prefer a multi-size `.ico` (16–256px). |
| **`icon.icns`** | **macOS** — if you ship a Mac build later. |
| **`icon.png`** | **Linux** AppImage/deb (512×512 or 1024×1024 PNG is typical). |

Put your artwork here using those **exact names** so you don’t need extra config.

**Tray icon (future):** use a separate small PNG/ICO (e.g. `tray-icon.png`) and load it from `src/main/` with `path.join(__dirname, '../../build/tray-icon.png')` when you add tray support.
