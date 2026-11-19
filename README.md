# VICE FRAME — Offline GTA-Style Multi-Panel Cover Art Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ajimatimati/vice-cover-art-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ajimatimati/vice-cover-art-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**VICE FRAME** is a 100% offline, zero-dependency static web studio that turns any local photo (or multi-photo set) into vibrant Vice City sunset/neon multi-panel cover art and exports full-resolution PNGs in one click. Every image stays strictly on your own device — zero uploads, zero external scripts, zero network requests.

## Features

- **Real Pixel-Level Illustrated Poster Art Shader (`app/filters.js`)**: Edge-preserving bilateral-style smoothing, smooth-stepped cel quantization, 5 curated 4-stop Vice City luminance-split gradient LUTs (*Vice Sunset*, *Neon Midnight*, *Miami Heatwave*, *Palm Noir*, *Pastel Coast*), Sobel comic ink lineart, atmospheric rim lighting, halftone dots, and tactile 35mm print grain.
- **Angled Multi-Panel Comic Poster Layouts (`app/layouts.js`)**: 5 dynamic slanted polygon layouts (*Classic 5*, *Vice 4 Slash*, *3-Panel + Inset*, *Hero 6 Collage*, *9-Panel Wall*) automatically tailored to each export aspect ratio, framed by razor-sharp pitch-black ink gutters.
- **100% Original Layered Poster Typography (`app/renderer.js`)**: 3D block-extruded condensed display lettering with clipped halftone dot glaze, glowing neon script tagline + brush swash, optional retro sliced sunset disc with arching twin palm silhouettes, toggleable 5-star Heat Meter, and customizable geometric corner stamp — with zero Rockstar logos, official game art, or copyrighted fonts.
- **Fast Photo Workflow (`app/app.js`)**: Drag-and-drop onto any panel or click **+ Upload Photos**; auto-fill all panels from 1 photo with smart multi-angle crops or spread multiple photos across panels; click-drag directly on the canvas to pan, scroll or slide to zoom, flip, reset, undo/redo (`Ctrl+Z` / `Ctrl+Y`), and export exact native PNGs in **1920 × 1080**, **1080 × 1350**, **1080 × 1080**, or **1080 × 1920**.

## Run Locally

Requires Node.js 22+ and a desktop browser:

```bash
node serve.ts
# Open http://localhost:8080
```

Build the deterministic submission artifact:

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](./LICENSE).
