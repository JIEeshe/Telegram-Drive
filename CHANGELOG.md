# Changelog

## [1.0.5] - 2026-03-27

### Security

- **Content Security Policy** - Added CSP rules to `tauri.conf.json` preventing XSS attacks in the webview. Scoped to allow Telegram API connections and local streaming server only.

### Code Quality

- **Merged Context Directories** - Consolidated `contexts/` into `context/` (single directory for all React contexts)
- **Fixed Double Mutex Lock** - Fixed `bandwidth.rs` `check_and_reset()` which dropped then re-acquired the lock unnecessarily
- **Replaced `println!`** - Changed remaining `println!` to `log::info!` for consistent logging
- **Removed Dead Code** - Deleted empty `menu.rs`, stale `commands.rs.bak` (23KB), and `test_upload.txt`
- **Removed Stale Comment** - Cleaned up indecisive developer comment in `lib.rs`

### Repository Hygiene

- **Updated `.gitignore`** - Added patterns for build artifacts (`.dmg`, `.exe`, `.msi`, `.AppImage`), `.rs.bak`, test files, and `.npm-cache`

---


### Bug Fixes

- **Grid Card Overlap Fix** - Cards no longer overlap at any window size. Replaced CSS `aspect-[4/3]` with explicit pixel heights synchronized to the virtualizer's row budget.

### Code Quality

- Removed all `console.log/warn/error` statements (16 total, kept 1 in ErrorBoundary)
- Replaced all `as any` type casts with proper types
- Fixed all Rust Clippy warnings (7 → 0)
- Removed 3 unused npm dependencies (`clsx`, `tailwind-merge`, `@tauri-apps/plugin-opener`)
- Stripped ~40 AI-generated comments across TypeScript and Rust files

---

## [1.0.3] - 2026-02-09

### Bug Fixes

- **Grid Spacing Fix** - Fixed cards overlapping in grid view
- **Dynamic Row Height** - Grid now properly calculates row height based on window size
- **Virtualizer Re-measurement** - Grid correctly updates when resizing window

---

## [1.0.2] - 2026-02-07

### Automated Release Pipeline

- **GitHub Actions Workflow** - Automatic builds triggered on version tags
- **Cross-Platform Builds** - Windows, Linux, macOS (Intel + ARM) built in parallel
- **Signed Updates** - All builds signed with Ed25519 for secure auto-updates
- **Automatic Publishing** - Releases published to GitHub automatically

---

## [1.0.1] - 2026-02-07

### Auto-Update System

- **Automatic Update Checks** - App checks for updates 5 seconds after startup
- **Update Banner** - Beautiful animated banner when new version available
- **One-Click Updates** - Download and install updates with progress indicator
- **Cross-Platform** - Windows, Mac, and Linux users get platform-specific updates

### 🔧 Technical

- Added Tauri updater plugin with Ed25519 signing
- Created `useUpdateCheck` hook for update lifecycle management
- Added `UpdateBanner` component with download progress

---

## [1.0.0] - 2026-02-06 🎉

### First Stable Release

Telegram Drive is now production-ready! This release focuses on performance, reliability, and user experience polish.

### ✨ New Features

- **Virtual Scrolling** - Smooth performance with folders containing 1000+ files
- **Inline Thumbnails** - Image files now display thumbnails directly in the file grid
- **Thumbnail Caching** - Thumbnails are cached locally for instant loading on revisit
- **API Setup Help Guide** - Step-by-step modal explaining how to get Telegram API credentials

### 🚀 Performance Improvements

- Grid and list views now only render visible items (virtualized)
- Responsive column layout adapts to window width
- Lazy loading of thumbnails to reduce initial load time

### 🎨 UI/UX Improvements

- Refined grid spacing (6px gaps between cards)
- Gradient overlay on thumbnail cards for text readability
- Improved light mode support across all components

### 🔧 Technical

- Added `@tanstack/react-virtual` for virtualization
- Separate thumbnail cache directory (`app_data_dir/thumbnails/`)
- FileTypeIcon now supports multiple sizes

---

## [0.6.0] - 2026-02-05

### Reliability Update

- Session persistence (window state, UI state, active folder)
- Network resilience with connection status indicator
- Queue persistence for uploads/downloads
- Light mode UI fixes

---

## [0.5.0] - 2026-02-04

### Drag & Drop Update

- Stable hybrid drag-drop system
- External drop blocker
- GitHub Actions workflow fixes

---

## [0.4.0] - 2026-02-01

### Media & Performance

- Audio/Video streaming player
- Global search filter
- Internal drag & drop between folders
