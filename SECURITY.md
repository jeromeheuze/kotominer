# Security

## Antivirus False Positives

The bundled `minerd-*.exe` binaries are flagged by Windows Defender and most antivirus tools. **This is a known false positive** that affects all CPU miner software.

The binaries are unmodified official builds from [KotoDevelopers/cpuminer-yescrypt](https://github.com/KotoDevelopers/cpuminer-yescrypt). You can verify this by comparing SHA256 hashes against the official release assets.

**To verify bundled binary hashes:**
```powershell
Get-FileHash "C:\Program Files\KotoMiner\miners\minerd-avx2.exe" -Algorithm SHA256
```

Compare the output against hashes published in each [KotoMiner release](https://github.com/jeromeheuze/kotominer/releases).

## Reporting a Vulnerability

If you discover a security issue in KotoMiner itself (not the mining backend), please open a GitHub issue or contact via the pool site at [koto.isekai-pool.com](https://koto.isekai-pool.com).

Do not include your wallet private keys or seed phrases in any bug report.
