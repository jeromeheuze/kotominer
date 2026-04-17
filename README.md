# KotoMiner

**KotoMiner** is a desktop CPU miner for [KOTO](https://ko-to.org) on Windows. It wraps the official [KotoDevelopers/cpuminer-yescrypt](https://github.com/KotoDevelopers/cpuminer-yescrypt) binaries, auto-selects the fastest CPU variant for your machine, and provides a clean Mine / Benchmark / Settings workflow.

Default pool: **[koto.isekai-pool.com](https://koto.isekai-pool.com)**

---

## Download

**[→ Kotominer-Setup-1.1.0.exe](https://github.com/jeromeheuze/kotominer/releases/tag/v1.1.0)** (Windows installer)

> Linux: not packaged in this release. Build from source — see [Building](#building).

---

## Quick Start

1. Install via the NSIS setup wizard
2. Enter your KOTO wallet address in **Settings**
3. Run **Benchmark** once to find your fastest CPU variant
4. Hit **Mine** — done

Your mining state (address, pool URL, pinned variant) survives tab changes and app restarts.

---

## ⚠️ Antivirus Warning

Windows Defender and most AV tools flag `minerd-*.exe` as a false positive. This is normal for any CPU miner binary. The bundled executables are the unmodified official builds from [KotoDevelopers/cpuminer-yescrypt](https://github.com/KotoDevelopers/cpuminer-yescrypt).

**To restore quarantined files in Windows Defender:**

1. Open **Windows Security** → **Virus & threat protection**
2. Click **Protection history**
3. Find the quarantined `minerd-*.exe` entry
4. Click **Actions** → **Restore**
5. Add an exclusion for the KotoMiner install folder:
   - **Windows Security** → **Virus & threat protection settings** → **Add or remove exclusions**
   - Add folder: `C:\Program Files\KotoMiner\` (or your install path)

Alternatively, download the miners directly from the [KotoDevelopers releases](https://github.com/KotoDevelopers/cpuminer-yescrypt/releases) and place them in the app's `miners/` folder.

---

## Features

| Feature | Details |
|---|---|
| **Mine** | Start/stop against any stratum pool URL and wallet address |
| **Benchmark** | Tests all bundled `minerd-*.exe` variants against the live pool; pins the fastest |
| **Hashrate & Logs** | Parses pool-accepted lines, total H/s, and per-thread rates |
| **CPU Auto-select** | Picks AVX2 → AVX → SSE2 → generic based on your CPU |
| **Tray** | Optional minimize-to-tray with Show / Pause / Resume / Quit menu |
| **Faucet** | In-app link to [isekai-pool.com](https://isekai-pool.com) earn activities for free KOTO |
| **Clean exit** | Quitting stops the miner and cleans up stray `minerd` processes |

---

## Default Pool

KotoMiner ships pre-configured for **isekai-pool.com**:

| Setting | Value |
|---|---|
| Stratum URL | `stratum+tcp://koto.isekai-pool.com:3032` |
| Algorithm | yescryptR8G |
| Min payout | 0.1 KOTO |
| Pool fee | 1% |

You can point it at any KOTO stratum pool via Settings.

**→ Pool stats:** [koto.isekai-pool.com/stats](https://koto.isekai-pool.com/stats)  
**→ Earn free KOTO:** [isekai-pool.com](https://isekai-pool.com)

---

## CPU Variants

KotoMiner bundles and benchmarks the following builds:

| Binary | Requires |
|---|---|
| `minerd-avx2.exe` | AVX2 (Haswell 2013+) |
| `minerd-avx.exe` | AVX (Sandy Bridge 2011+) |
| `minerd-sse2.exe` | SSE2 (any x86-64) |
| `minerd.exe` | Generic fallback |

Run **Benchmark** after install to pin the fastest variant for your machine. The result is saved and used for all future mining sessions.

---

## Building

Requirements: Node.js 18+, npm

```bash
git clone https://github.com/jeromeheuze/kotominer.git
cd kotominer
npm install
npm start
```

To build the Windows installer:

```bash
npm run build
# outputs: dist/Kotominer-Setup-x.x.x.exe
```

---

## Notes

- **No auto-update** — grab new releases from this repo or [koto.isekai-pool.com](https://koto.isekai-pool.com)
- **Algorithm:** yescrypt (KOTO stratum)
- **Mining backend:** [KotoDevelopers/cpuminer-yescrypt](https://github.com/KotoDevelopers/cpuminer-yescrypt)
- **Does not bundle a wallet** — use the official [Koto wallet](https://ko-to.org) to receive payouts

---

## About KOTO

KOTO (コト) is a Japanese privacy-focused CPU-mineable cryptocurrency based on Zcash. It uses the yescryptR8G algorithm, making it ASIC-resistant and accessible to anyone with a standard CPU.

- Official site: [ko-to.org](https://ko-to.org)
- Block explorer: [insight.kotocoin.info](https://insight.kotocoin.info)
- Pool: [koto.isekai-pool.com](https://koto.isekai-pool.com)

---

## License

MIT — see [LICENSE](LICENSE)

Mining backend binaries are copyright KotoDevelopers, distributed under their respective licenses.
