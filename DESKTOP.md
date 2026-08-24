# Dotstell Desktop App

Windows, macOS, and Linux desktop builds powered by [Tauri v2](https://tauri.app).

The desktop app is a native shell that loads `dotstell.app` via WebView at runtime — no bundled frontend build needed. No Electron — the OS's own webview is used, so installers are ~10 MB instead of 150 MB+.

---

## Prerequisites

### 1. Rust (required by Tauri)

- **Windows / Linux**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **macOS**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

After installing, restart your terminal and verify:
```bash
rustc --version   # rustc 1.x.x
cargo --version   # cargo 1.x.x
```

### 2. Platform dependencies

**Windows** — WebView2 Runtime (pre-installed on Windows 10/11 with Edge). If missing:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

**macOS** — Xcode Command Line Tools:
```bash
xcode-select --install
```

**Linux (Ubuntu / Debian)** — webkit2gtk and supporting libraries:
```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

---

## Running in development

```bash
pnpm install
pnpm desktop:dev
```

Opens the Tauri window pointing at the live `dotstell.app`. No local Next.js server needed.

---

## Building a release installer

```bash
pnpm install
pnpm desktop:build
```

Output files:

| Platform | Location | Format |
|---|---|---|
| Windows | `src-tauri/target/release/bundle/msi/` | `.msi` installer |
| Windows | `src-tauri/target/release/bundle/nsis/` | `.exe` installer |
| macOS | `src-tauri/target/release/bundle/dmg/` | `.dmg` disk image |
| macOS | `src-tauri/target/release/bundle/macos/` | `.app` bundle |
| Linux | `src-tauri/target/release/bundle/appimage/` | `.AppImage` |
| Linux | `src-tauri/target/release/bundle/deb/` | `.deb` package |

---

## Cross-platform CI releases

Tagged releases (e.g. `v0.3.0`) automatically trigger `.github/workflows/release.yml`, which builds for all four platforms in parallel:

- macOS Apple Silicon (`aarch64-apple-darwin`)
- macOS Intel (`x86_64-apple-darwin`)
- Windows (`x86_64`)
- Linux (`x86_64` — AppImage + deb)

The workflow creates a draft GitHub release with all binaries attached. Publish it manually after reviewing.

---

## Notes

- The desktop app connects to Supabase over the internet exactly like the web app. No local database.
- Builds are currently unsigned. macOS: right-click → Open on first launch. Windows: More info → Run anyway on SmartScreen.
