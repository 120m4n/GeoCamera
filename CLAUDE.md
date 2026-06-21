# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules

- **Validate every task** with `npm run dev` before marking it done.
- If `npm run dev` fails after **2 retries**: stop, re-read the full context and the primary objective, write a concrete step-by-step action plan, then execute it.
- **Architecture analysis and improvement proposals MUST be presented for client approval before any implementation.** Present findings as a table or list, wait for explicit confirmation, then implement only what is approved.
- **Large changes require client approval + E2E validation in the PWA via MCP Playwright** before committing. A change is "large" if it touches more than one screen, modifies navigation flow, or alters data persistence. Run Playwright against `npm run preview` (or the dev server) and confirm the golden path works end-to-end.

## Dev commands

```bash
npm run dev      # Vite dev server on https://localhost:3000 (HTTPS via .ssl/ certs — required for camera/GPS)
npm run build    # build to dist/ (prerequisite for Capacitor sync)
npm run preview  # preview dist/ locally
open icons/generate-icons.html  # generate PNG icons (needed for iOS apple-touch-icon)
```

**HTTPS is required** for `getUserMedia` and `Geolocation` on real devices. Certs live in `.ssl/`.  
To regenerate: `brew install mkcert && mkcert -install && mkdir .ssl && mkcert -cert-file .ssl/cert.pem -key-file .ssl/key.pem localhost 127.0.0.1`

**Static assets** (`sw.js`, `manifest.json`, `icons/`) live in `public/` — Vite serves them at `/` in dev and copies them to `dist/` on build.

## Stack

**MVP (current scope):** Vanilla TS, ES native modules (`type="module"`), compiled with `esbuild` or `tsc` directly — no heavy bundler. No UI framework.

**Future backend (out of scope until explicitly triggered):** Go + Gin + PostgreSQL + Linode object storage.

## Architecture overview

GeoCamera is a **local-first installable PWA** for geotagged field evidence photos. The capture pipeline:

1. `getUserMedia` live preview + `Geolocation` watch in parallel
2. Capture → canvas snapshot → stencil burned in (GPS coords, ±accuracy, Plus Code, datetime, logo)
3. **Review screen** (always — no skip) → confirm or discard
4. On confirm: (a) auto-download via `<a download>` + Blob URL to `Downloads`/`Files` folder, (b) generate thumbnail + save metadata to IndexedDB, (c) release the full-res blob from memory

**Critical constraint:** once downloaded, the full-res file is outside the PWA's reach forever. The app only retains a compressed thumbnail + metadata in IndexedDB. "FIFO 6" means the in-app index shows the last 6 captures — not that only 6 files exist on the device.

## Module structure (planned, in `src/`)

| File | Responsibility |
|---|---|
| `camera.ts` | `getUserMedia` wrapper, permission handling, front/rear camera selection |
| `geo.ts` | `navigator.geolocation` wrapper, watch vs single fix, accuracy tracking |
| `pluscode.ts` | Open Location Code algorithm (client-side, no network calls) |
| `stencil.ts` | Canvas overlay rendering (coords, Plus Code, datetime, logo) |
| `downloader.ts` | Auto-download trigger (`<a download>` + Blob URL) and thumbnail generation |
| `index.ts` | IndexedDB wrapper for the FIFO-6 metadata index (including embedded thumbnail blobs) |
| `sync.ts` | **Stub only in MVP** — defines `enqueue`/`processQueue` interface, `SYNC_ENABLED = false` |
| `ui/` | Native Web Components (`customElements.define`), no UI library |
| `sw.js` | Service Worker: App Shell cache-first; sync registration present but inactive |

## IndexedDB schema

```ts
interface PhotoIndexEntry {
  id: string;              // UUID (client-generated, reused as PK if backend ever activates)
  filename: string;        // informational reference only — file is not accessible after download
  thumbnailBlob: Blob;     // compressed thumbnail embedded directly in the record
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  plusCode: string;
  capturedAt: string;      // ISO 8601 with timezone offset
  syncStatus: 'local' | 'pending' | 'synced' | 'error'; // always 'local' in MVP
}
```

## Platform constraints that drive design decisions

These are hard limits — not implementation choices:

- **No camera gallery write:** `<a download>` lands in `Downloads`/`Files`, never in the system photo roll. File System Access API doesn't exist on iOS. Web Share API with JPEG has unreliable "Save to Photos" on iOS. This is communicated in onboarding.
- **iOS Background Sync:** not supported. Sync must happen on `visibilitychange`/app resume, never assume real background sync on iOS.
- **IndexedDB purge on iOS:** Safari can evict IndexedDB after 7+ days of inactivity (ITP). Affects the index/thumbnails, not files already downloaded. MVP must be tested over multiple days on real iOS.
- **PWA install:** Android shows `beforeinstallprompt` automatically; iOS requires manual "Share → Add to Home Screen" — onboarding must explain this explicitly.
- **HTTPS required:** `getUserMedia` on iOS only works on HTTPS or `display: standalone` PWA.
- **Always test on real iOS hardware** (not DevTools/simulator) — WebKit behavior diverges from Chromium on camera preview, storage, and download.

## Design system tokens

```css
--bg-base: #0B0E11
--surface: #15191D
--surface-2: #1D2227
--border-subtle: #2A3037
--accent-action: #FF6A1A   /* primary CTA, shutter button */
--accent-positive: #3DDC84 /* confirmations, good GPS */
--accent-warning: #FFC247  /* degraded GPS, warnings */
--text-primary: #F5F3EF
--text-muted: #8B919A
--text-faint: #565C64
```

UI font: `-apple-system, 'Inter', 'Segoe UI', sans-serif`. Numeric data (coordinates, Plus Code, timestamps): `'JetBrains Mono', 'SF Mono', monospace`.

## UX principles (non-negotiable)

- App opens directly to live camera view — no splash or welcome screen
- Shutter button: 84px diameter, centered bottom third (thumb zone), orange (`--accent-action`)
- GPS badge: always visible, shows `±Xm` with color state (warning/positive) — never blocks capture
- Review screen has exactly two actions: **Guardar** and **Descartar** — no editing, no menus
- After save: toast ~1.3s then auto-return to camera. User never navigates away manually
- No bottom nav bar — would compete with shutter. Navigation via corner icon buttons
- Never block capture due to missing/degraded GPS — capture without location is better than no capture

## Backend (future, activate only when needed)

Defined in architecture doc section 3.2 and 5.2. Do not build until at least one of these criteria is met:
- Field evidence must be accessible from outside the capturing device
- Full-resolution originals must be centrally backed up (requires revisiting capture flow — the blob is discarded after download)
- Institutional audit/traceability requirement appears (Emcali context)

Backend stack when activated: Go/Gin, PostgreSQL with `golang-migrate`, Linode object storage, deployed on existing Linode VPS with Traefik.
