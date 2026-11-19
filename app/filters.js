/**
 * VICE FRAME — Real pixel-level GTA illustrated poster art shader & color-grade engine.
 * Runs 100% offline on HTML5 Canvas 2D with zero dependencies:
 *   1. Fast edge-preserving bilateral smooth (painterly gouache brushwork surfaces)
 *   2. Smooth-stepped cel quantization + vivid vibrance boost
 *   3. 4-stop Vice City luminance-split gradient LUT (preserves local neon/water colors)
 *   4. Sobel gradient ink edge detector (hand-inked comic poster lineart)
 *   5. Cached stylized surfaces per photo for instant 60 FPS interactive pan & zoom
 */

export const COLOR_GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    swatches: ['#190730', '#ff1f8e', '#ff7b3b', '#ffe68a'],
    lut: [
      [18, 6, 40],     // deep twilight violet shadow
      [172, 24, 126],  // electric magenta mid-low
      [255, 110, 62],  // sunset coral-tangerine mid-high
      [255, 238, 162], // warm sunlit gold highlight
    ],
    gradeMix: 0.46,
    saturation: 1.42,
    contrast: 1.22,
    inkColor: [10, 3, 20],
    titleGradient: ['#fffce3', '#ff8c38', '#ff1788'],
    scriptColor: '#ff42d4',
    scriptGlow: 'rgba(255, 32, 168, 0.96)',
    sunColors: ['#fff7bf', '#ff7b3b', '#ff148a'],
    rimOverlay: ['rgba(255, 118, 52, 0.14)', 'rgba(255, 28, 144, 0.16)', 'rgba(18, 218, 255, 0.11)'],
  },
  {
    id: 'neon-midnight',
    name: 'Neon Midnight',
    swatches: ['#060b22', '#00dcff', '#e024ff', '#f0ffff'],
    lut: [
      [7, 10, 34],
      [14, 116, 192],
      [224, 42, 224],
      [226, 252, 255],
    ],
    gradeMix: 0.50,
    saturation: 1.44,
    contrast: 1.26,
    inkColor: [5, 7, 20],
    titleGradient: ['#ecffff', '#2ef2ff', '#ff22c8'],
    scriptColor: '#3ef6ff',
    scriptGlow: 'rgba(0, 238, 255, 0.96)',
    sunColors: ['#e8ffff', '#00d4ff', '#e020ff'],
    rimOverlay: ['rgba(0, 234, 255, 0.15)', 'rgba(218, 34, 255, 0.16)', 'rgba(8, 12, 42, 0.14)'],
  },
  {
    id: 'miami-heatwave',
    name: 'Miami Heatwave',
    swatches: ['#26071c', '#e82942', '#ff8c24', '#fff5b8'],
    lut: [
      [34, 7, 26],
      [208, 36, 66],
      [255, 134, 30],
      [255, 246, 184],
    ],
    gradeMix: 0.48,
    saturation: 1.42,
    contrast: 1.23,
    inkColor: [18, 4, 14],
    titleGradient: ['#fffce0', '#ffaa22', '#ff2640'],
    scriptColor: '#ffdf4d',
    scriptGlow: 'rgba(255, 112, 20, 0.96)',
    sunColors: ['#fff9c2', '#ff8624', '#eb1e46'],
    rimOverlay: ['rgba(255, 172, 34, 0.16)', 'rgba(255, 48, 70, 0.15)', 'rgba(34, 8, 26, 0.12)'],
  },
  {
    id: 'palm-noir',
    name: 'Palm Noir',
    swatches: ['#090912', '#2f2954', '#ff5470', '#58f2e8'],
    lut: [
      [10, 10, 20],
      [56, 52, 92],
      [230, 102, 136],
      [212, 252, 248],
    ],
    gradeMix: 0.52,
    saturation: 1.15,
    contrast: 1.34,
    inkColor: [5, 5, 10],
    titleGradient: ['#ffffff', '#a2faf4', '#ff4d8d'],
    scriptColor: '#ff4f8b',
    scriptGlow: 'rgba(255, 56, 122, 0.95)',
    sunColors: ['#f0fffe', '#52f2e8', '#ff4d8d'],
    rimOverlay: ['rgba(82, 242, 232, 0.14)', 'rgba(255, 68, 128, 0.14)', 'rgba(6, 6, 14, 0.24)'],
  },
  {
    id: 'pastel-coast',
    name: 'Pastel Coast',
    swatches: ['#1d1e48', '#ff7eb6', '#4ef2e0', '#fff2c2'],
    lut: [
      [26, 30, 74],
      [96, 124, 198],
      [255, 136, 190],
      [255, 244, 206],
    ],
    gradeMix: 0.42,
    saturation: 1.32,
    contrast: 1.12,
    inkColor: [20, 18, 48],
    titleGradient: ['#fff9e6', '#ff94cc', '#49f0e4'],
    scriptColor: '#56f5e8',
    scriptGlow: 'rgba(255, 110, 196, 0.92)',
    sunColors: ['#fff6cc', '#ff85c0', '#52f0e4'],
    rimOverlay: ['rgba(255, 130, 198, 0.16)', 'rgba(80, 240, 228, 0.14)', 'rgba(32, 26, 78, 0.12)'],
  },
];

export function getColorGradeById(gradeId) {
  return COLOR_GRADES.find((g) => g.id === gradeId) ?? COLOR_GRADES[0];
}

const stylizedCache = new Map();
const MAX_CACHE_ENTRIES = 24;

export function clearFilterCache() {
  stylizedCache.clear();
}

function clampByte(value) {
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

/**
 * Evaluates a smooth 4-stop RGB gradient lookup table for normalized luminance t in [0..1].
 */
function sampleGradeLut(lut, t) {
  const scaled = Math.max(0, Math.min(1, t)) * 3;
  const idx = Math.min(2, Math.floor(scaled));
  const frac = scaled - idx;
  const a = lut[idx];
  const b = lut[idx + 1];
  return [
    a[0] + (b[0] - a[0]) * frac,
    a[1] + (b[1] - a[1]) * frac,
    a[2] + (b[2] - a[2]) * frac,
  ];
}

/**
 * Smooth-stepped posterization curve: yields bold painted cel-shading steps
 * without brittle raw 8-bit color banding.
 */
function smoothQuantizeChannel(normVal, levels, sharpness) {
  const scaled = normVal * levels;
  const base = Math.floor(scaled);
  const frac = scaled - base;
  // Steep S-curve pushes values smoothly toward flat cel-shaded plateaus
  const k = 1 + sharpness * 7;
  const s = frac < 0.5
    ? 0.5 * Math.pow(2 * frac, k)
    : 1 - 0.5 * Math.pow(2 * (1 - frac), k);
  return Math.max(0, Math.min(1, (base + s) / levels));
}

/**
 * Soft-light blend helper in [0..1] for vivid painterly tint integration.
 */
function softLight(base, blend) {
  return blend < 0.5
    ? base - (1 - 2 * blend) * base * (1 - base)
    : base + (2 * blend - 1) * (Math.sqrt(Math.max(0, base)) - base);
}

/**
 * Runs a fast edge-preserving 3×3 bilateral-style smoothing pass so textures become
 * sleek painted surfaces while crisp subject contours remain sharp for ink outlines.
 */
function edgePreservingSmooth(src, width, height, rangeSigma) {
  const dst = new Uint8ClampedArray(src.length);
  const invRange = 1 / (2 * rangeSigma * rangeSigma);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - 1);
    const y2 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = src[idx];
      const cg = src[idx + 1];
      const cb = src[idx + 2];
      const cLum = 0.299 * cr + 0.587 * cg + 0.114 * cb;

      let sr = cr * 2.0;
      let sg = cg * 2.0;
      let sb = cb * 2.0;
      let wSum = 2.0;

      const x0 = Math.max(0, x - 1);
      const x2 = Math.min(width - 1, x + 1);

      for (let ny = y0; ny <= y2; ny++) {
        const rowOff = ny * width;
        for (let nx = x0; nx <= x2; nx++) {
          if (nx === x && ny === y) continue;
          const nIdx = (rowOff + nx) * 4;
          const nr = src[nIdx];
          const ng = src[nIdx + 1];
          const nb = src[nIdx + 2];
          const diff = 0.299 * nr + 0.587 * ng + 0.114 * nb - cLum;
          const w = Math.exp(-(diff * diff) * invRange);
          sr += nr * w;
          sg += ng * w;
          sb += nb * w;
          wSum += w;
        }
      }

      dst[idx] = sr / wSum;
      dst[idx + 1] = sg / wSum;
      dst[idx + 2] = sb / wSum;
      dst[idx + 3] = 255;
    }
  }
  return dst;
}

/**
 * Computes Sobel edge magnitude per pixel on a luminance buffer for comic ink outlines.
 */
export function detectComicInkEdges(luma, width, height) {
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    const rowPrev = (y - 1) * width;
    const rowCurr = y * width;
    const rowNext = (y + 1) * width;
    for (let x = 1; x < width - 1; x++) {
      const tl = luma[rowPrev + x - 1];
      const tc = luma[rowPrev + x];
      const tr = luma[rowPrev + x + 1];
      const ml = luma[rowCurr + x - 1];
      const mr = luma[rowCurr + x + 1];
      const bl = luma[rowNext + x - 1];
      const bc = luma[rowNext + x];
      const br = luma[rowNext + x + 1];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edges[rowCurr + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/**
 * Core pixel pass combining painterly cel-quantization, vibrant Vice color LUT grading,
 * and dark comic ink edge darkening.
 */
export function applyCelQuantizationAndGrade(imageData, grade, posterStrength, inkStrength) {
  const { width, height, data } = imageData;
  const smooth = posterStrength > 0.05
    ? edgePreservingSmooth(data, width, height, 26)
    : data;

  const luma = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = (0.299 * smooth[i] + 0.587 * smooth[i + 1] + 0.114 * smooth[i + 2]) / 255;
  }

  const edges = inkStrength > 0.02 ? detectComicInkEdges(luma, width, height) : null;
  const lut = grade.lut;
  const ink = grade.inkColor;
  const sat = grade.saturation;
  const contrast = grade.contrast;
  const gradeMix = grade.gradeMix;
  const levels = Math.round(10 - posterStrength * 4.5); // 10 down to ~5.5 smooth cel steps

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let r = smooth[i] / 255;
    let g = smooth[i + 1] / 255;
    let b = smooth[i + 2] / 255;

    // 1. Punchy poster S-curve contrast
    r = Math.max(0, Math.min(1, (r - 0.5) * contrast + 0.5));
    g = Math.max(0, Math.min(1, (g - 0.5) * contrast + 0.5));
    b = Math.max(0, Math.min(1, (b - 0.5) * contrast + 0.5));

    // 2. Boost vibrance / saturation so coastal blues, sunsets, and neons sing
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    r = Math.max(0, Math.min(1, l + (r - l) * sat));
    g = Math.max(0, Math.min(1, l + (g - l) * sat));
    b = Math.max(0, Math.min(1, l + (b - l) * sat));

    // 3. Smooth cel-shaded luminance banding (preserves hue cleanly!)
    if (posterStrength > 0.02) {
      const qL = smoothQuantizeChannel(l, levels, posterStrength);
      const targetL = l + (qL - l) * (0.72 * posterStrength);
      const ratio = l > 0.008 ? targetL / l : 1;
      r = Math.max(0, Math.min(1, r * ratio));
      g = Math.max(0, Math.min(1, g * ratio));
      b = Math.max(0, Math.min(1, b * ratio));
    }

    // 4. Split-tone Vice City gradient-map blend (stronger in shadows & highlights)
    const lumNow = 0.299 * r + 0.587 * g + 0.114 * b;
    const [lr, lg, lb] = sampleGradeLut(lut, lumNow);
    const nr = lr / 255;
    const ng = lg / 255;
    const nb = lb / 255;

    // Soft-light gives electric neon glow while keeping authentic scene color identity
    const slR = softLight(r, nr);
    const slG = softLight(g, ng);
    const slB = softLight(b, nb);

    // Extra deep-shadow tinting & warm highlight sheen
    const shadowBoost = Math.pow(1 - lumNow, 2) * 0.22;
    const mixAmt = Math.min(0.75, gradeMix + shadowBoost);

    r = r * (1 - mixAmt) + (slR * 0.68 + nr * 0.32) * mixAmt;
    g = g * (1 - mixAmt) + (slG * 0.68 + ng * 0.32) * mixAmt;
    b = b * (1 - mixAmt) + (slB * 0.68 + nb * 0.32) * mixAmt;

    // 5. Crisp comic ink edge overlay along strong contours only
    if (edges !== null) {
      const mag = edges[p];
      const low = 0.42 - inkStrength * 0.16;
      const high = low + 0.36;
      if (mag > low) {
        const t = Math.min(1, (mag - low) / (high - low));
        const inkAlpha = t * t * inkStrength * 0.88;
        r = r * (1 - inkAlpha) + (ink[0] / 255) * inkAlpha;
        g = g * (1 - inkAlpha) + (ink[1] / 255) * inkAlpha;
        b = b * (1 - inkAlpha) + (ink[2] / 255) * inkAlpha;
      }
    }

    data[i] = clampByte(Math.round(r * 255));
    data[i + 1] = clampByte(Math.round(g * 255));
    data[i + 2] = clampByte(Math.round(b * 255));
    data[i + 3] = 255;
  }
}

/**
 * Produces (and caches) a stylized offscreen canvas for a source photo.
 * Uses crisp preview resolution interactively and full high resolution on PNG export.
 */
export function applyPosterArtPipeline(photoEntry, options) {
  const { gradeId, posterStrength, inkStrength, highRes = false } = options;
  const maxDim = highRes ? 1120 : 680;
  const key = `${photoEntry.id}|${gradeId}|${Math.round(posterStrength * 100)}|${Math.round(inkStrength * 100)}|${maxDim}`;

  if (stylizedCache.has(key)) {
    return stylizedCache.get(key);
  }

  const img = photoEntry.image;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(16, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(16, Math.round((img.naturalHeight || img.height) * scale));

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);

  const grade = getColorGradeById(gradeId);
  const imageData = ctx.getImageData(0, 0, w, h);
  applyCelQuantizationAndGrade(imageData, grade, posterStrength, inkStrength);
  ctx.putImageData(imageData, 0, 0);

  if (stylizedCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = stylizedCache.keys().next().value;
    stylizedCache.delete(oldestKey);
  }
  stylizedCache.set(key, offscreen);
  return offscreen;
}

/**
 * Draws a subtle screen-print halftone pattern, sunlit neon rim wash,
 * crisp edge vignette, and fine 35mm print grain over the panel collage.
 */
export function drawHalftoneAndGrainOverlay(ctx, width, height, grade, grainAmount) {
  // 1. Unifying diagonal sunset / neon rim wash
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const rimGrad = ctx.createLinearGradient(0, 0, width, height);
  rimGrad.addColorStop(0, grade.rimOverlay[0]);
  rimGrad.addColorStop(0.5, grade.rimOverlay[1]);
  rimGrad.addColorStop(1, grade.rimOverlay[2]);
  ctx.fillStyle = rimGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Subtle print vignette framing
  ctx.save();
  const vGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.48,
    Math.min(width, height) * 0.34,
    width * 0.5,
    height * 0.5,
    Math.hypot(width, height) * 0.62,
  );
  vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vGrad.addColorStop(0.75, 'rgba(8, 4, 18, 0.14)');
  vGrad.addColorStop(1, 'rgba(5, 2, 14, 0.42)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if (grainAmount <= 0.01) return;

  // 3. Deterministic repeating halftone + tactile 35mm print grain tile
  const tileSize = 96;
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const tctx = tile.getContext('2d');
  const imgData = tctx.createImageData(tileSize, tileSize);
  const buf = imgData.data;

  // Deterministic LCG PRNG so exports and screenshots are 100% reproducible
  let seed = 0x5f3759df;
  for (let i = 0; i < buf.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 0xff;
    buf[i] = v;
    buf[i + 1] = v;
    buf[i + 2] = v;
    buf[i + 3] = Math.round(grainAmount * 30);
  }
  tctx.putImageData(imgData, 0, 0);

  // Subtle graphic comic halftone dots
  tctx.fillStyle = `rgba(255, 220, 245, ${(grainAmount * 0.08).toFixed(3)})`;
  const step = 8;
  for (let y = 0; y < tileSize; y += step) {
    const shift = ((y / step) % 2) * (step * 0.5);
    for (let x = 0; x < tileSize; x += step) {
      tctx.beginPath();
      tctx.arc((x + shift) % tileSize, y, 1.15, 0, Math.PI * 2);
      tctx.fill();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}
