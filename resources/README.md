# Bundled miner binaries

These files are **gitignored** — add them locally after cloning; do not commit them.

## Windows (`resources/win32-x64/` or `resources/win32-x86/`)

Unpack the **[KotoDevelopers/cpuminer-yescrypt](https://github.com/KotoDevelopers/cpuminer-yescrypt/releases)** zip for your arch (**x64** vs **x86**) into the matching folder. Keep **all** `minerd-*.exe` files **and** the **DLLs** (`libcurl-4.dll`, `libwinpthread-1.dll`, etc.) in **the same directory** — the app runs the exe with `cwd` set to that folder.

**Kotominer auto-selects** the fastest build your CPU can run. It probes (runs `minerd-*.exe -h`) in this order:

| Order | Executable        | Typical CPUs (from zip `README.txt`)   |
|------:|-------------------|----------------------------------------|
| 1     | `minerd-avx2-sha.exe` | Ryzen (also many modern Intel)      |
| 2     | `minerd-avx2.exe`     | Haswell through Coffee Lake         |
| 3     | `minerd-xop.exe`      | AMD FX                              |
| 4     | `minerd-avx.exe`      | Sandy / Ivy Bridge                  |
| 5     | `minerd-aes-sse42.exe`| Westmere, Sandy / Ivy               |
| 6     | `minerd-sse2.exe`     | Core2, Nehalem (baseline)           |

The first binary that runs without crashing and prints help is cached for a week (see `miner-resolve.js`).

**32-bit Windows:** Electron must be built/run as **ia32**; resources live under `resources/win32-x86/` with the same `minerd-*.exe` names.

### Manual override

To force a single file, copy one exe to the app userData folder as **`cpuminer-koto.exe`** (see `miner-paths.js`). That path wins over the auto-selected `minerd-*.exe`.

---

## Linux (`resources/linux-x64/`, `resources/linux-arm64/`)

Place a single executable named **`cpuminer-koto`** and `chmod +x`. (Multi-variant selection like Windows can be added later.)

---

## Restore after antivirus

If the bundled folder is stripped, use **`KOTOMINER_MINER_MANIFEST_URL`** + SHA256 manifest (see `src/main/miner-restore.js`) or copy files back manually.
