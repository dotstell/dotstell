# Dotstell Desktop App

Windows and macOS desktop builds powered by [Tauri v2](https://tauri.app).

The desktop app wraps the same Next.js frontend in a native shell.
No Electron — the OS's own webview is used, so installers are ~10 MB instead of 150 MB+.

---

## Prerequisites

### 1. Rust (required by Tauri)

Download and run the installer for your platform:

- **Windows**: https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe
- **macOS**: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

After installing, restart your terminal and verify:
```bash
rustc --version   # should print rustc 1.x.x
cargo --version   # should print cargo 1.x.x
```

### 2. Windows: WebView2 Runtime

Already installed on Windows 10/11 (ships with Edge). If missing:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 3. macOS: Xcode Command Line Tools

```bash
xcode-select --install
```

---

## Running in development

```bash
pnpm install
pnpm desktop:dev
```

This starts the Next.js dev server on port 3000 and opens the Tauri window pointing at it.
Hot reload works exactly as in the browser.

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

---

## Cross-platform builds (CI)

To build for Windows from macOS (or vice versa) you need GitHub Actions.
A workflow file will be added at `.github/workflows/desktop-release.yml`
that builds for both platforms on every tagged release.

---

## Notes

- The desktop app connects to Supabase over the internet exactly like the web app.
  No local database — all data stays in your Supabase project.
- `TAURI_BUILD=1` triggers `output: "export"` in `next.config.ts` for static export.
- The corporate SSL proxy var (`NODE_TLS_REJECT_UNAUTHORIZED`) is passed through
  the build scripts automatically.
