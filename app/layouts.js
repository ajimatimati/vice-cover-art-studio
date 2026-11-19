/**
 * VICE FRAME — Multi-panel poster geometry, aspect presets, and polygon hit-testing.
 * Every panel is defined in normalized [0..1] coordinates with crisp shared cut lines
 * so slanted comic-book ink gutters have mathematically uniform thickness at any size.
 */

export const POST_SIZES = [
  { id: 'landscape', label: '1920 × 1080', shortLabel: '16:9 Wide', width: 1920, height: 1080 },
  { id: 'portrait', label: '1080 × 1350', shortLabel: '4:5 Post', width: 1080, height: 1350 },
  { id: 'square', label: '1080 × 1080', shortLabel: '1:1 Square', width: 1080, height: 1080 },
  { id: 'story', label: '1080 × 1920', shortLabel: '9:16 Story', width: 1080, height: 1920 },
];

export const COVER_LAYOUTS = [
  {
    id: 'classic-5',
    name: 'Classic 5',
    description: 'Iconic top-left chopper corner with 5 slanted poster panels',
    panelCount: 5,
  },
  {
    id: 'vice-4',
    name: 'Vice 4 Slash',
    description: '4 bold diagonal-cut feature panels with maximum breathing room',
    panelCount: 4,
  },
  {
    id: 'inset-4',
    name: '3-Panel + Inset',
    description: '3 sweeping panoramic panels with a floating inked action inset',
    panelCount: 4,
  },
  {
    id: 'hero-6',
    name: 'Hero 6 Collage',
    description: '6-panel asymmetric box-art collage with vertical flank frames',
    panelCount: 6,
  },
  {
    id: 'wall-9',
    name: '9-Panel Wall',
    description: 'High-energy 3×3 slanted poster wall with hero center feature',
    panelCount: 9,
  },
];

export function getPostSizeById(sizeId) {
  return POST_SIZES.find((size) => size.id === sizeId) ?? POST_SIZES[0];
}

/**
 * Returns panel polygon descriptors for the chosen layout and aspect ratio.
 * Each panel has:
 *   - id: numeric index
 *   - label: semantic role hint shown in the studio UI
 *   - points: normalized [[x, y], ...] clockwise polygon vertices in [0..1]
 *   - floating: optional boolean (drawn above base panels with outer drop shadow)
 *   - defaultCrop: { x, y, zoom } subtle artistic default framing
 */
export function getLayoutPanels(layoutId, sizeId) {
  const isWide = sizeId === 'landscape';
  const isTall = sizeId === 'portrait' || sizeId === 'story';

  if (layoutId === 'vice-4') {
    if (isWide) {
      return [
        { id: 0, label: 'Top-Left Aerial', points: [[0, 0], [0.43, 0], [0.39, 0.48], [0, 0.52]] },
        { id: 1, label: 'Top-Right Hero', points: [[0.43, 0], [1, 0], [1, 0.55], [0.39, 0.48]] },
        { id: 2, label: 'Bottom-Left Action', points: [[0, 0.52], [0.56, 0.50], [0.52, 1], [0, 1]] },
        { id: 3, label: 'Bottom-Right Night', points: [[0.56, 0.50], [1, 0.55], [1, 1], [0.52, 1]] },
      ];
    }
    if (isTall) {
      return [
        { id: 0, label: 'Top-Left Aerial', points: [[0, 0], [0.48, 0], [0.44, 0.34], [0, 0.38]] },
        { id: 1, label: 'Top-Right Skyline', points: [[0.48, 0], [1, 0], [1, 0.36], [0.44, 0.34]] },
        { id: 2, label: 'Center Feature', points: [[0, 0.38], [1, 0.36], [1, 0.69], [0, 0.72]] },
        { id: 3, label: 'Bottom Boulevard', points: [[0, 0.72], [1, 0.69], [1, 1], [0, 1]] },
      ];
    }
    return [
      { id: 0, label: 'Top-Left Aerial', points: [[0, 0], [0.46, 0], [0.42, 0.47], [0, 0.51]] },
      { id: 1, label: 'Top-Right Feature', points: [[0.46, 0], [1, 0], [1, 0.53], [0.42, 0.47]] },
      { id: 2, label: 'Bottom-Left Coast', points: [[0, 0.51], [0.55, 0.49], [0.51, 1], [0, 1]] },
      { id: 3, label: 'Bottom-Right Neon', points: [[0.55, 0.49], [1, 0.53], [1, 1], [0.51, 1]] },
    ];
  }

  if (layoutId === 'inset-4') {
    if (isWide) {
      return [
        { id: 0, label: 'Left Strip', points: [[0, 0], [0.35, 0], [0.29, 1], [0, 1]] },
        { id: 1, label: 'Center Panorama', points: [[0.35, 0], [0.71, 0], [0.65, 1], [0.29, 1]] },
        { id: 2, label: 'Right Strip', points: [[0.71, 0], [1, 0], [1, 1], [0.65, 1]] },
        { id: 3, label: 'Action Inset', floating: true, points: [[0.035, 0.055], [0.305, 0.04], [0.285, 0.42], [0.025, 0.44]] },
      ];
    }
    return [
      { id: 0, label: 'Top Horizon', points: [[0, 0], [1, 0], [1, 0.34], [0, 0.38]] },
      { id: 1, label: 'Mid Panorama', points: [[0, 0.38], [1, 0.34], [1, 0.68], [0, 0.72]] },
      { id: 2, label: 'Lower Strip', points: [[0, 0.72], [1, 0.68], [1, 1], [0, 1]] },
      { id: 3, label: 'Hero Inset', floating: true, points: [[0.56, 0.045], [0.955, 0.035], [0.94, 0.31], [0.535, 0.33]] },
    ];
  }

  if (layoutId === 'hero-6') {
    if (isWide) {
      return [
        { id: 0, label: 'Top-Left Chopper', points: [[0, 0], [0.30, 0], [0.27, 0.42], [0, 0.45]] },
        { id: 1, label: 'Center-Top Action', points: [[0.30, 0], [0.72, 0], [0.69, 0.56], [0.27, 0.42]] },
        { id: 2, label: 'Right Tall Flank', points: [[0.72, 0], [1, 0], [1, 0.60], [0.69, 0.56]] },
        { id: 3, label: 'Bottom-Left Cruise', points: [[0, 0.45], [0.36, 0.45], [0.33, 1], [0, 1]] },
        { id: 4, label: 'Bottom-Center Wave', points: [[0.36, 0.45], [0.69, 0.56], [0.66, 1], [0.33, 1]] },
        { id: 5, label: 'Bottom-Right Neon', points: [[0.69, 0.56], [1, 0.60], [1, 1], [0.66, 1]] },
      ];
    }
    return [
      { id: 0, label: 'Top-Left Chopper', points: [[0, 0], [0.46, 0], [0.42, 0.28], [0, 0.31]] },
      { id: 1, label: 'Top-Right Tower', points: [[0.46, 0], [1, 0], [1, 0.29], [0.42, 0.28]] },
      { id: 2, label: 'Mid-Left Hero', points: [[0, 0.31], [0.62, 0.285], [0.58, 0.66], [0, 0.69]] },
      { id: 3, label: 'Mid-Right Action', points: [[0.62, 0.285], [1, 0.29], [1, 0.64], [0.58, 0.66]] },
      { id: 4, label: 'Bottom-Left Water', points: [[0, 0.69], [0.49, 0.665], [0.45, 1], [0, 1]] },
      { id: 5, label: 'Bottom-Right Night', points: [[0.49, 0.665], [1, 0.64], [1, 1], [0.45, 1]] },
    ];
  }

  if (layoutId === 'wall-9') {
    const xCols = [
      [0, 0.34, 0.67, 1],
      [0, 0.32, 0.69, 1],
      [0, 0.35, 0.66, 1],
      [0, 0.33, 0.68, 1],
    ];
    const yRows = [
      [0, 0.34, 0.67, 1],
      [0, 0.32, 0.69, 1],
      [0, 0.35, 0.66, 1],
      [0, 0.33, 0.68, 1],
    ];
    const panels = [];
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        panels.push({
          id: idx,
          label: `Grid Panel ${idx + 1}`,
          points: [
            [xCols[r][c], yRows[c][r]],
            [xCols[r][c + 1], yRows[c + 1][r]],
            [xCols[r + 1][c + 1], yRows[c + 1][r + 1]],
            [xCols[r + 1][c], yRows[c][r + 1]],
          ],
        });
        idx++;
      }
    }
    return panels;
  }

  // Default: 'classic-5' — Signature iconic GTA-style asymmetric 5-panel cover layout
  if (isWide) {
    return [
      { id: 0, label: 'Top-Left Chopper', points: [[0, 0], [0.33, 0], [0.30, 0.45], [0, 0.48]] },
      { id: 1, label: 'Top-Center Hero', points: [[0.33, 0], [0.71, 0], [0.68, 0.54], [0.30, 0.45]] },
      { id: 2, label: 'Right Feature', points: [[0.71, 0], [1, 0], [1, 1], [0.65, 1], [0.68, 0.54]] },
      { id: 3, label: 'Bottom-Left Water', points: [[0, 0.48], [0.35, 0.46], [0.32, 1], [0, 1]] },
      { id: 4, label: 'Bottom-Center Neon', points: [[0.35, 0.46], [0.68, 0.54], [0.65, 1], [0.32, 1]] },
    ];
  }
  if (isTall) {
    return [
      { id: 0, label: 'Top-Left Chopper', points: [[0, 0], [0.47, 0], [0.43, 0.31], [0, 0.34]] },
      { id: 1, label: 'Top-Right Skyline', points: [[0.47, 0], [1, 0], [1, 0.33], [0.43, 0.31]] },
      { id: 2, label: 'Center Feature', points: [[0, 0.34], [1, 0.33], [1, 0.67], [0, 0.70]] },
      { id: 3, label: 'Bottom-Left Water', points: [[0, 0.70], [0.51, 0.685], [0.47, 1], [0, 1]] },
      { id: 4, label: 'Bottom-Right Night', points: [[0.51, 0.685], [1, 0.67], [1, 1], [0.47, 1]] },
    ];
  }
  // Square 1:1 classic-5
  return [
    { id: 0, label: 'Top-Left Chopper', points: [[0, 0], [0.44, 0], [0.40, 0.40], [0, 0.43]] },
    { id: 1, label: 'Top-Right Feature', points: [[0.44, 0], [1, 0], [1, 0.44], [0.40, 0.40]] },
    { id: 2, label: 'Middle-Left Action', points: [[0, 0.43], [0.57, 0.415], [0.53, 1], [0, 1]] },
    { id: 3, label: 'Middle-Right Boat', points: [[0.57, 0.415], [1, 0.44], [1, 0.72], [0.55, 0.71]] },
    { id: 4, label: 'Bottom-Right Neon', points: [[0.55, 0.71], [1, 0.72], [1, 1], [0.53, 1]] },
  ];
}

/**
 * Maps normalized [0..1] polygon vertices into pixel coordinates inside the outer poster frame.
 */
export function resolvePanelPixelPolygon(panel, width, height, frameMargin) {
  const innerW = width - frameMargin * 2;
  const innerH = height - frameMargin * 2;
  return panel.points.map(([nx, ny]) => [
    frameMargin + nx * innerW,
    frameMargin + ny * innerH,
  ]);
}

export function buildPanelPolygonPath(ctx, pixelPoints) {
  ctx.beginPath();
  for (let i = 0; i < pixelPoints.length; i++) {
    const [x, y] = pixelPoints[i];
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function getPolygonBounds(pixelPoints) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of pixelPoints) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5,
  };
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Finds which panel index lies under canvas pixel coordinates (px, py).
 * Checks floating panels first so overlays receive priority clicks.
 */
export function hitTestPanel(panels, width, height, frameMargin, px, py) {
  for (let i = panels.length - 1; i >= 0; i--) {
    if (!panels[i].floating) continue;
    const poly = resolvePanelPixelPolygon(panels[i], width, height, frameMargin);
    if (pointInPolygon(px, py, poly)) return i;
  }
  for (let i = panels.length - 1; i >= 0; i--) {
    if (panels[i].floating) continue;
    const poly = resolvePanelPixelPolygon(panels[i], width, height, frameMargin);
    if (pointInPolygon(px, py, poly)) return i;
  }
  return -1;
}

/**
 * Generates varied dynamic crop/zoom focal compositions when filling every panel
 * from a single user photo, creating an instant comic-action multi-angle montage.
 */
export function computeSmartCropsForSinglePhoto(panelCount) {
  const presets = [
    { offsetX: -0.18, offsetY: -0.12, zoom: 1.38, flipX: false },
    { offsetX: 0.04, offsetY: 0.0, zoom: 1.06, flipX: false },
    { offsetX: 0.2, offsetY: 0.08, zoom: 1.44, flipX: true },
    { offsetX: -0.14, offsetY: 0.16, zoom: 1.32, flipX: false },
    { offsetX: 0.16, offsetY: -0.14, zoom: 1.52, flipX: false },
    { offsetX: 0.0, offsetY: 0.12, zoom: 1.24, flipX: true },
    { offsetX: -0.22, offsetY: 0.02, zoom: 1.46, flipX: false },
    { offsetX: 0.12, offsetY: -0.06, zoom: 1.28, flipX: true },
    { offsetX: -0.04, offsetY: -0.18, zoom: 1.35, flipX: false },
  ];
  const crops = [];
  for (let i = 0; i < panelCount; i++) {
    crops.push({ ...presets[i % presets.length] });
  }
  return crops;
}
