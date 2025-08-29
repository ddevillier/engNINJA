# EngNinja Pro (Windows)

A pro-level, offline-friendly tiler for engineering PDFs.

* **Auto mode:** Square tiles with independent X/Y overlap (percent or pixels), uniform parameters across all pages.
* **Manual mode:** Click to place tiles (pastel overlays), **Alt+Click** to place dead-space masks, keyboard nudge & delete.
* **Exports:** Per-page or whole-PDF ZIPs of PNG tiles **plus** JSON manifests.
* **Persistence:** Autosaves your work locally (IndexedDB + localStorage). Service worker enables offline-first usage.

---

## 1) System requirements (Windows)

* **Windows 10/11**
* **Node.js LTS** (recommended ≥ 18.x). Download from [https://nodejs.org](https://nodejs.org)
* A modern browser (Edge, Chrome, or Firefox). Edge/Chrome recommended for large PDFs.

Verify in PowerShell:

```powershell
node -v
npm -v
```

---

## 2) Install & run (dev)

1. **Unzip** the project to a convenient path, e.g.:

   ```
   C:\Users\<you>\Documents\engninja-pro
   ```

2. Open **Windows PowerShell** and run:

   ```powershell
   cd C:\Users\<you>\Documents\engninja-pro
   npm install
   npm run dev
   ```

3. Open the local URL shown by Vite (usually `http://localhost:5173/`).

> **Note:** Service workers are allowed on `localhost`, so offline features work during dev.

---

## 3) Build & preview (prod)

Create a production build:

```powershell
npm run build
npm run preview
```

Then open the preview URL to test the built app.

To host elsewhere (IIS, static host, etc.), deploy the contents of `dist/`.

---

## 4) Using EngNinja Pro

### 4.1 Start / Resume

* **Start a new project:** click **Choose PDF** and select a multi-page PDF. Pages render at **300 DPI** by default.
* **Resume work:** recent projects appear under **Resume** (state is stored locally on your machine).

### 4.2 Modes

* **Auto mode (default):** parameters apply to all pages (toggle **Apply to all pages**).
  Controls include:

  * Tile Size: **128, 256, 512, 1024, 2048**
  * Overlap Units: **Percent** or **Pixels**
  * Overlap X / Y
  * DPI (default **300**)
  * Margin (px)
  * Snap to grid (for manual mode placement consistency)

* **Manual mode:** click on the page to place tiles. Each placement shows a pastel overlay box.

### 4.3 Dead-space masks (manual mode)

* **Alt + Click** to place a **mask tile** (red-tinted).
* Masks are **listed in the manifest** and **excluded** from exports.

### 4.4 Selecting, nudging, deleting (manual mode)

* **Click** a tile to select it (thicker white outline).
* **Arrow Keys**: move by 1 px; **Shift + Arrow**: move by 10 px.
* **Delete** / **Backspace**: remove selected tile.

### 4.5 Export

* **Export Current Page**: downloads a ZIP containing page tiles and `page-<N>/manifest.json`.
* **Export All Pages**: downloads one ZIP with all pages and a root `manifest.json`.

**Manifest contents** (abbrev):

```json
{
  "pages": [
    {
      "page": 1,
      "mode": "auto|manual",
      "params": { "...": "tiling parameters" },
      "tiles": [
        { "index": 0, "x": 0, "y": 0, "w": 512, "h": 512, "filename": "page-1/auto/tile-0-0x0.png" }
      ],
      "masks": [
        { "id": "uuid", "x": 100, "y": 200, "size": 512 }
      ]
    }
  ]
}
```

* In **manual** exports, mask tiles are omitted from images but documented in the manifest.

---

## 5) Data storage & persistence

* **PDF file**: stored in **IndexedDB** under a project-scoped key.
* **Project state** (parameters, manual tiles): stored via localStorage using the `engninja-pro-store` key (Zustand persist).
* Your work **stays on your machine** (no server upload). Clearing browser data will remove it.

---

## 6) Service worker (offline-first)

* A cache-first service worker (`public/sw.js`) is registered on page load.
* Once visited, core assets will load offline.
* If you deploy new versions and don’t see changes:

  1. **Hard refresh** (Ctrl+F5)
  2. Or open **DevTools → Application → Service Workers**, click **Unregister** and refresh.

---

## 7) Performance tips

* **Large PDFs @ 300 DPI** can be memory-intensive. If rendering is slow:

  * Try reducing **DPI** temporarily while placing tiles; raise before export.
  * Use smaller **Tile Size** or increase overlaps sparingly.
  * Prefer Edge/Chrome for better canvas performance.
* Edge tiles are automatically covered even when stride doesn’t divide page size neatly.

---

## 8) Keyboard reference

| Action         | Shortcut           |
| -------------- | ------------------ |
| Select tile    | Click tile         |
| Place tile     | Click empty area   |
| Place **mask** | **Alt + Click**    |
| Nudge 1px      | Arrow keys         |
| Nudge 10px     | **Shift + Arrow**  |
| Delete tile    | Delete / Backspace |

---

## 9) Troubleshooting (Windows)

* **Nothing happens on npm install**
  Corporate proxies can block npm. Set your company registry if required or use a network that allows `registry.npmjs.org`.

* **Browser says it’s out of memory**
  Close other heavy tabs, reduce DPI, or tile size, and retry.

* **PDF won’t load**
  Verify the file is a valid PDF and not password-protected.

* **I can’t see my recent work**
  Ensure you’re on the same browser/profile and you haven’t cleared site data. Check **Home → Resume** list.

---

## 10) Project structure (quick look)

```
engninja-pro/
  public/
    sw.js                # service worker (offline-first)
  src/
    components/
      CanvasView.tsx     # PDF render + overlay + interactions
      ExportPanel.tsx    # Export ZIPs + manifests
      PageSidebar.tsx    # Thumbnails / page navigation
      Toolbar.tsx        # Mode & tiling controls
    lib/
      colors.ts          # Pastel color generator
      pdf.ts             # pdf.js helpers (300 DPI render)
      storage.ts         # IndexedDB access helpers
      tiler.ts           # Auto tiling + math helpers
      zipper.ts          # JSZip export helpers
    routes/
      Home.tsx           # Upload / Resume
      Project.tsx        # Workspace shell
    store.ts             # Zustand store + persistence
    types.ts             # Types for state / tiles
  index.html
  vite.config.ts
  package.json
  tailwind.config.js
  tsconfig.json
```

---

## 11) License

Add your project’s license here.

---

## 12) Credits

* PDF rendering via `pdfjs-dist`
* State via `zustand`
* Zipping via `jszip`
* Build via Vite + React + Tailwind
