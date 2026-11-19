/**
 * VICE FRAME — High-resolution multi-panel GTA-style cover art canvas compositor.
 * Renders angled ink-framed panels, painterly stylized photos, retro palm-sun emblem,
 * layered 3D halftone display lettering, neon cursive script tagline, heat stars,
 * and original geometric corner stamp. Zero external assets or trademarked artwork.
 */

import {
  buildPanelPolygonPath,
  getLayoutPanels,
  getPolygonBounds,
  resolvePanelPixelPolygon,
} from './layouts.js';
import {
  applyPosterArtPipeline,
  drawHalftoneAndGrainOverlay,
  getColorGradeById,
} from './filters.js';

const DISPLAY_FONT_STACK = '"Arial Black", "Impact", "Haettenschweiler", "Franklin Gothic Heavy", "Liberation Sans", sans-serif';
const SCRIPT_FONT_STACK = '"Segoe Script", "Brush Script MT", "Snell Roundhand", "Georgia", cursive';
const STAMP_FONT_STACK = '"Trebuchet MS", "Segoe UI", "Liberation Sans", sans-serif';

/**
 * Draws one stylized photo clipped inside its angled polygon panel with pan, zoom, and flip.
 */
export function drawClippedPanelPhoto(ctx, pixelPoly, photoEntry, panelState, filterOpts) {
  const bounds = getPolygonBounds(pixelPoly);
  ctx.save();
  buildPanelPolygonPath(ctx, pixelPoly);
  ctx.clip();

  // Deep cosmic backing fill in case a panel has no photo yet
  const bg = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h);
  bg.addColorStop(0, '#1e1038');
  bg.addColorStop(1, '#090612');
  ctx.fillStyle = bg;
  ctx.fillRect(bounds.x - 2, bounds.y - 2, bounds.w + 4, bounds.h + 4);

  if (photoEntry && photoEntry.image) {
    const surface = applyPosterArtPipeline(photoEntry, filterOpts);
    const zoom = Math.max(1, Math.min(3.2, panelState.zoom ?? 1));
    const offsetX = panelState.offsetX ?? 0;
    const offsetY = panelState.offsetY ?? 0;
    const flipX = Boolean(panelState.flipX);

    const coverScale = Math.max(bounds.w / surface.width, bounds.h / surface.height) * zoom;
    const drawW = surface.width * coverScale;
    const drawH = surface.height * coverScale;

    // Clamp pan slightly generously while keeping full panel coverage
    const maxPanX = Math.max(0, (drawW - bounds.w) * 0.5);
    const maxPanY = Math.max(0, (drawH - bounds.h) * 0.5);
    const shiftX = Math.max(-maxPanX, Math.min(maxPanX, offsetX * bounds.w));
    const shiftY = Math.max(-maxPanY, Math.min(maxPanY, offsetY * bounds.h));

    ctx.translate(bounds.cx + shiftX, bounds.cy + shiftY);
    if (flipX) ctx.scale(-1, 1);
    ctx.drawImage(surface, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
  } else {
    // Clean geometric placeholder hint for empty panels
    ctx.fillStyle = 'rgba(255, 110, 199, 0.16)';
    ctx.font = `700 ${Math.round(Math.min(bounds.w, bounds.h) * 0.08)}px ${STAMP_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP PHOTO HERE', bounds.cx, bounds.cy);
  }

  // Subtle glossy top-edge sunlight gleam inside each panel
  const sheen = ctx.createLinearGradient(bounds.x, bounds.y, bounds.x, bounds.y + bounds.h * 0.35);
  sheen.addColorStop(0, 'rgba(255, 245, 220, 0.10)');
  sheen.addColorStop(1, 'rgba(255, 245, 220, 0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h * 0.35);

  ctx.restore();
}

/**
 * Strokes thick comic-book pure-black ink gutters between panels and the outer poster border.
 */
export function drawPanelInkBorders(ctx, panelPolys, width, height, frameMargin, gutterWidth) {
  ctx.save();
  ctx.strokeStyle = '#06040b';
  ctx.lineWidth = gutterWidth;
  ctx.lineJoin = 'miter';
  ctx.miterLimit = 4;

  for (const poly of panelPolys) {
    buildPanelPolygonPath(ctx, poly);
    ctx.stroke();
  }

  // Solid outer poster black ink frame so edges are razor-clean
  ctx.fillStyle = '#06040b';
  ctx.fillRect(0, 0, width, frameMargin);
  ctx.fillRect(0, height - frameMargin, width, frameMargin);
  ctx.fillRect(0, 0, frameMargin, height);
  ctx.fillRect(width - frameMargin, 0, frameMargin, height);

  // Subtle hairline neon accent pinstripe just inside the outer poster ink border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = Math.max(1.5, width * 0.0014);
  ctx.strokeRect(
    frameMargin + ctx.lineWidth * 0.5,
    frameMargin + ctx.lineWidth * 0.5,
    width - frameMargin * 2 - ctx.lineWidth,
    height - frameMargin * 2 - ctx.lineWidth,
  );
  ctx.restore();
}

/**
 * Draws a procedural silhouetted tropical palm tree arching gracefully behind the emblem.
 */
function drawVectorPalmSilhouette(ctx, baseX, baseY, scale, leanDir) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(leanDir * scale, scale);

  // Curved tapered palm trunk
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.quadraticCurveTo(18, -95, 42, -182);
  ctx.lineTo(52, -180);
  ctx.quadraticCurveTo(32, -92, 10, 0);
  ctx.closePath();
  ctx.fill();

  // Crown of arching tropical fronds
  const cx = 47;
  const cy = -180;
  const fronds = [
    [-108, -32, -52, -62],
    [-92, 22, -46, -24],
    [-46, -98, -14, -64],
    [14, -104, 14, -56],
    [94, -56, 52, -58],
    [110, 8, 56, -26],
    [76, 54, 46, 12],
  ];

  for (const [tx, ty, cpx, cpy] of fronds) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(cx + cpx, cy + cpy - 12, cx + tx, cy + ty);
    ctx.quadraticCurveTo(cx + cpx * 0.85, cy + cpy + 12, cx, cy + 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws the original sliced Vice Sunset retro sun disc + sweeping twin palm silhouettes
 * bursting dramatically around the upper crown of the main title block.
 */
export function drawRetroSunPalmEmblem(ctx, cx, cy, radius, grade) {
  ctx.save();

  // Soft wide Vice neon horizon bloom behind the emblem disc
  ctx.shadowColor = grade.scriptGlow;
  ctx.shadowBlur = radius * 0.65;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.07, 0, Math.PI * 2);
  ctx.fillStyle = '#05030a';
  ctx.fill();
  ctx.shadowBlur = 0;

  // Clip sun interior for retro horizontal Venetian-blind sunset slices
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const sunGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  sunGrad.addColorStop(0, grade.sunColors[0]);
  sunGrad.addColorStop(0.5, grade.sunColors[1]);
  sunGrad.addColorStop(1, grade.sunColors[2]);
  ctx.fillStyle = sunGrad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // Crisp outrun horizontal sunset bars across lower half of disc
  ctx.fillStyle = '#06030c';
  const stripePositions = [0.06, 0.22, 0.37, 0.51, 0.65, 0.78, 0.90];
  const stripeHeights = [0.024, 0.032, 0.042, 0.052, 0.064, 0.076, 0.09];
  for (let i = 0; i < stripePositions.length; i++) {
    const sy = cy + radius * stripePositions[i];
    const sh = radius * stripeHeights[i];
    ctx.fillRect(cx - radius - 2, sy, radius * 2 + 4, sh);
  }
  ctx.restore();

  // Crisp pitch-black outer rim stroke around the retro sun disc
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(5, radius * 0.085);
  ctx.strokeStyle = '#05030a';
  ctx.stroke();

  // Unclipped twin silhouetted palm trees arching ABOVE & OUTSIDE the sun rim for unmistakable coastal drama!
  const palmScale = radius / 128;
  ctx.save();
  ctx.shadowColor = grade.scriptGlow;
  ctx.shadowBlur = radius * 0.22;
  ctx.fillStyle = '#05030a';
  drawVectorPalmSilhouette(ctx, cx - radius * 1.02, cy + radius * 0.76, palmScale * 1.02, 1);
  drawVectorPalmSilhouette(ctx, cx + radius * 1.04, cy + radius * 0.80, palmScale * 0.94, -1);
  ctx.restore();

  ctx.restore();
}

/**
 * Splits user title text cleanly into 1 or 2 bold poster lines.
 */
function parseTitleLines(rawTitle) {
  const cleaned = (rawTitle || '').trim();
  if (!cleaned) return [];
  if (cleaned.includes('\n')) {
    return cleaned.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  }
  if (cleaned.includes('|')) {
    return cleaned.split('|').map((s) => s.trim()).filter(Boolean).slice(0, 2);
  }
  const words = cleaned.split(/\s+/);
  if (words.length >= 2 && cleaned.length >= 9) {
    const splitAt = Math.ceil(words.length / 2);
    return [words.slice(0, splitAt).join(' '), words.slice(splitAt).join(' ')];
  }
  return [cleaned];
}

/**
 * Renders the signature multi-layered GTA-style bold condensed poster title:
 * 3D block ink extrusion + thick rounded comic stroke + luminous vertical gradient
 * + clipped subtle diagonal halftone sheen + crisp glossy highlight rim.
 */
export function drawPosterTitleLockup(ctx, state, width, height, grade) {
  const lines = parseTitleLines(state.title);
  const subtitle = (state.subtitle || '').trim();
  if (lines.length === 0 && !subtitle) return;

  const minSide = Math.min(width, height);
  const scaleMul = state.titleScale ?? 1;
  const baseFontSize = Math.round(minSide * (lines.length > 1 ? 0.122 : 0.142) * scaleMul);
  const lineGap = baseFontSize * 0.85;
  const blockH = lines.length > 1 ? baseFontSize + lineGap : baseFontSize;

  // Determine anchor position based on user placement choice
  let anchorX = width * 0.5;
  let anchorY = height * 0.775;
  let align = 'center';

  if (state.titlePosition === 'center') {
    anchorX = width * 0.5;
    anchorY = height * 0.51;
    align = 'center';
  } else if (state.titlePosition === 'bottom-left') {
    anchorX = width * 0.065;
    anchorY = height * 0.80;
    align = 'left';
  } else if (state.titlePosition === 'top-left') {
    anchorX = width * 0.065;
    anchorY = height * 0.21;
    align = 'left';
  }

  // Optional retro sun + palms graphic emblem perched prominently behind the title lockup
  if (state.showEmblem && lines.length > 0) {
    const emblemRadius = Math.round(minSide * 0.168 * scaleMul);
    const emblemX = align === 'center' ? anchorX : anchorX + emblemRadius * 1.35;
    const emblemY = anchorY - blockH * 0.34;
    drawRetroSunPalmEmblem(ctx, emblemX, emblemY, emblemRadius, grade);
  }

  if (lines.length > 0) {
    // Render main lettering onto a clean offscreen layer so halftone dot sheen clips cleanly inside letters
    const pad = Math.round(baseFontSize * 0.9);
    const layer = document.createElement('canvas');
    layer.width = width;
    layer.height = height;
    const lctx = layer.getContext('2d');

    // Compute auto horizontal fit scale so long custom captions never overflow
    lctx.font = `900 ${baseFontSize}px ${DISPLAY_FONT_STACK}`;
    let maxLineW = 0;
    for (const line of lines) {
      maxLineW = Math.max(maxLineW, lctx.measureText(line.toUpperCase()).width);
    }
    const condensedX = 0.82;
    const availableW = align === 'center' ? width * 0.84 : width * 0.78;
    const fitScaleX = Math.min(condensedX, (availableW / Math.max(1, maxLineW)) * 0.96);

    const startY = anchorY - ((lines.length - 1) * lineGap) * 0.5;
    const extrudeDepth = Math.max(5, Math.round(baseFontSize * 0.095));
    const outlineWidth = Math.max(10, Math.round(baseFontSize * 0.19));

    // Pass 1: Heavy 3D comic block extrusion + solid black outer ink outline directly on main ctx
    ctx.save();
    ctx.font = `900 ${baseFontSize}px ${DISPLAY_FONT_STACK}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    for (let li = 0; li < lines.length; li++) {
      const upper = lines[li].toUpperCase();
      const ly = startY + li * lineGap;

      // Soft neon drop shadow glow behind extrusion
      ctx.save();
      ctx.translate(anchorX, ly);
      ctx.transform(fitScaleX, -0.045, -0.09, 1, 0, 0);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
      ctx.shadowBlur = baseFontSize * 0.34;
      ctx.shadowOffsetX = extrudeDepth;
      ctx.shadowOffsetY = extrudeDepth * 1.1;
      ctx.lineWidth = outlineWidth;
      ctx.strokeStyle = '#05030a';
      ctx.strokeText(upper, 0, 0);
      ctx.restore();

      // Stepped solid 3D extrusion ink layers
      for (let d = extrudeDepth; d >= 1; d--) {
        ctx.save();
        ctx.translate(anchorX + d * 0.78, ly + d * 1.02);
        ctx.transform(fitScaleX, -0.045, -0.09, 1, 0, 0);
        ctx.lineWidth = outlineWidth;
        ctx.strokeStyle = '#06030c';
        ctx.strokeText(upper, 0, 0);
        ctx.fillStyle = '#06030c';
        ctx.fillText(upper, 0, 0);
        ctx.restore();
      }

      // Main crisp black outline on front plane
      ctx.save();
      ctx.translate(anchorX, ly);
      ctx.transform(fitScaleX, -0.045, -0.09, 1, 0, 0);
      ctx.lineWidth = outlineWidth;
      ctx.strokeStyle = '#07040e';
      ctx.strokeText(upper, 0, 0);
      ctx.restore();
    }
    ctx.restore();

    // Pass 2: Gradient fill + clipped halftone dot texture on offscreen layer
    lctx.save();
    lctx.font = `900 ${baseFontSize}px ${DISPLAY_FONT_STACK}`;
    lctx.textAlign = align;
    lctx.textBaseline = 'middle';

    for (let li = 0; li < lines.length; li++) {
      const upper = lines[li].toUpperCase();
      const ly = startY + li * lineGap;
      lctx.save();
      lctx.translate(anchorX, ly);
      lctx.transform(fitScaleX, -0.045, -0.09, 1, 0, 0);

      const textGrad = lctx.createLinearGradient(0, -baseFontSize * 0.50, 0, baseFontSize * 0.44);
      textGrad.addColorStop(0, grade.titleGradient[0]);
      textGrad.addColorStop(0.46, grade.titleGradient[1]);
      textGrad.addColorStop(1, grade.titleGradient[2]);
      lctx.fillStyle = textGrad;
      lctx.fillText(upper, 0, 0);
      lctx.restore();
    }
    lctx.restore();

    // Clipped halftone sheen + chrome bevel highlight inside the letters only
    lctx.save();
    lctx.globalCompositeOperation = 'source-atop';
    const dotStep = Math.max(5, Math.round(baseFontSize * 0.068));
    lctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let y = Math.max(0, anchorY - blockH); y < Math.min(height, anchorY + blockH); y += dotStep) {
      const shift = ((Math.round(y / dotStep)) % 2) * (dotStep * 0.5);
      for (let x = Math.max(0, pad * 0.1); x < width; x += dotStep) {
        lctx.beginPath();
        lctx.arc(x + shift, y, dotStep * 0.21, 0, Math.PI * 2);
        lctx.fill();
      }
    }

    // Top specular highlight streak across upper portion of title
    const spec = lctx.createLinearGradient(0, startY - baseFontSize * 0.55, 0, startY + baseFontSize * 0.1);
    spec.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    spec.addColorStop(0.42, 'rgba(255, 255, 255, 0.08)');
    spec.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
    lctx.fillStyle = spec;
    lctx.fillRect(0, 0, width, height);
    lctx.restore();

    // Composite glossy gradient letters onto main canvas
    ctx.drawImage(layer, 0, 0);

    // Crisp inner hairline rim stroke for razor-sharp print clarity
    ctx.save();
    ctx.font = `900 ${baseFontSize}px ${DISPLAY_FONT_STACK}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (let li = 0; li < lines.length; li++) {
      const upper = lines[li].toUpperCase();
      const ly = startY + li * lineGap;
      ctx.save();
      ctx.translate(anchorX, ly);
      ctx.transform(fitScaleX, -0.045, -0.09, 1, 0, 0);
      ctx.lineWidth = Math.max(1.5, baseFontSize * 0.018);
      ctx.strokeStyle = 'rgba(255, 252, 235, 0.72)';
      ctx.strokeText(upper, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // Pass 3: Sweeping glowing neon cursive script tagline right beneath the title
  if (subtitle) {
    const subY = lines.length > 0
      ? anchorY + (lines.length * lineGap) * 0.46 + baseFontSize * 0.16
      : anchorY;
    const subX = align === 'center' ? anchorX + baseFontSize * 0.14 : anchorX + baseFontSize * 0.12;
    drawNeonScriptSubtitle(ctx, subtitle, subX, subY, Math.round(baseFontSize * 0.48), align, grade);
  }
}

/**
 * Draws a vibrant glowing neon script ribbon tagline with dark backing contrast stroke,
 * dual neon bloom, bright pastel tube core, and sweeping neon brush swash.
 */
export function drawNeonScriptSubtitle(ctx, text, x, y, fontSize, align, grade) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.085);

  ctx.font = `italic 700 ${fontSize}px ${SCRIPT_FONT_STACK}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const swashStart = align === 'center' ? -textW * 0.48 : 0;
  const swashEnd = align === 'center' ? textW * 0.52 : textW;

  // Heavy dark ink backing so neon script pops cleanly over bright highlights
  ctx.lineWidth = Math.max(9, fontSize * 0.28);
  ctx.strokeStyle = '#07030f';
  ctx.strokeText(text, 0, 0);

  // Outer neon glow tube pass
  ctx.shadowColor = grade.scriptGlow;
  ctx.shadowBlur = fontSize * 0.55;
  ctx.lineWidth = Math.max(4, fontSize * 0.11);
  ctx.strokeStyle = grade.scriptColor;
  ctx.strokeText(text, 0, 0);

  // Bright luminous neon pastel core
  ctx.shadowBlur = fontSize * 0.22;
  ctx.fillStyle = '#fff5fc';
  ctx.fillText(text, 0, 0);

  // Dynamic sweeping neon brush underline swash
  ctx.beginPath();
  ctx.moveTo(swashStart, fontSize * 0.52);
  ctx.quadraticCurveTo(
    (swashStart + swashEnd) * 0.5,
    fontSize * 0.30,
    swashEnd,
    fontSize * 0.46,
  );
  ctx.lineCap = 'round';
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(6, fontSize * 0.17);
  ctx.strokeStyle = '#07030f';
  ctx.stroke();

  ctx.shadowColor = grade.scriptGlow;
  ctx.shadowBlur = fontSize * 0.35;
  ctx.lineWidth = Math.max(2.5, fontSize * 0.075);
  ctx.strokeStyle = grade.scriptColor;
  ctx.stroke();

  ctx.restore();
}

function drawFivePointStar(ctx, cx, cy, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Draws the optional top-right 5-star Heat Meter and bottom corner geometric stamp badge.
 * 100% original geometric vector styling — zero Rockstar or ESRB trademarks.
 */
export function drawHeatStarsAndStamp(ctx, state, width, height, frameMargin, grade) {
  const minSide = Math.min(width, height);

  // 1. Optional 5-Star Heat Meter (top-right inside frame)
  const stars = Math.max(0, Math.min(5, Math.round(state.heatStars ?? 0)));
  if (stars > 0) {
    const starR = Math.round(minSide * 0.024);
    const gap = starR * 2.35;
    const padX = frameMargin + minSide * 0.036;
    const padY = frameMargin + minSide * 0.044;
    const startX = width - padX - (5 - 1) * gap;

    ctx.save();
    for (let i = 0; i < 5; i++) {
      const sx = startX + i * gap;
      const sy = padY;
      const active = i < stars;

      drawFivePointStar(ctx, sx, sy, starR, starR * 0.44);
      ctx.lineWidth = Math.max(3.5, starR * 0.28);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#06030c';
      ctx.stroke();

      if (active) {
        ctx.shadowColor = grade.scriptGlow;
        ctx.shadowBlur = starR * 0.7;
        const sg = ctx.createLinearGradient(sx, sy - starR, sx, sy + starR);
        sg.addColorStop(0, '#fff7c2');
        sg.addColorStop(0.55, '#ffb733');
        sg.addColorStop(1, grade.scriptColor);
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = 'rgba(18, 12, 32, 0.76)';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 2. Original Geometric Corner Stamp Badge (bottom-left or bottom-right)
  const stampText = (state.stamp || '').trim().toUpperCase();
  if (!stampText) return;

  const fontSize = Math.round(minSide * 0.019);
  ctx.save();
  ctx.font = `800 ${fontSize}px ${STAMP_FONT_STACK}`;
  const textW = ctx.measureText(stampText).width;
  const padH = fontSize * 0.85;
  const boxW = textW + padH * 2 + fontSize * 1.1;
  const boxH = fontSize * 2.15;

  const placeRight = state.titlePosition === 'bottom-left';
  const bx = placeRight
    ? width - frameMargin - minSide * 0.028 - boxW
    : frameMargin + minSide * 0.028;
  const by = height - frameMargin - minSide * 0.028 - boxH;

  // Heavy inked badge plate
  ctx.fillStyle = 'rgba(8, 5, 16, 0.92)';
  ctx.fillRect(bx, by, boxW, boxH);
  ctx.lineWidth = Math.max(3, minSide * 0.004);
  ctx.strokeStyle = '#06030c';
  ctx.strokeRect(bx, by, boxW, boxH);

  // Left neon accent color bar inside stamp
  const barGrad = ctx.createLinearGradient(bx, by, bx, by + boxH);
  barGrad.addColorStop(0, grade.titleGradient[0]);
  barGrad.addColorStop(0.5, grade.titleGradient[1]);
  barGrad.addColorStop(1, grade.titleGradient[2]);
  ctx.fillStyle = barGrad;
  ctx.fillRect(bx + 4, by + 4, fontSize * 0.52, boxH - 8);

  // Crisp inner white outline
  ctx.lineWidth = Math.max(1.2, minSide * 0.0016);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.strokeRect(bx + 3, by + 3, boxW - 6, boxH - 6);

  ctx.fillStyle = '#fff9f2';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(stampText, bx + fontSize * 0.52 + padH * 0.85, by + boxH * 0.53);
  ctx.restore();
}

/**
 * Draws the subtle cyan active-panel editor selection outline on the interactive preview canvas.
 * Never invoked during PNG export.
 */
function drawEditorSelectionHighlight(ctx, pixelPoly, panelIndex, width) {
  const bounds = getPolygonBounds(pixelPoly);
  ctx.save();
  buildPanelPolygonPath(ctx, pixelPoly);
  ctx.lineWidth = Math.max(3, width * 0.0038);
  ctx.strokeStyle = '#3ef6ff';
  ctx.shadowColor = 'rgba(0, 238, 255, 0.9)';
  ctx.shadowBlur = 14;
  ctx.stroke();

  // Compact panel badge pill in upper-left of selected panel
  const pillFont = Math.max(12, Math.round(width * 0.012));
  const label = `PANEL ${panelIndex + 1} • DRAG TO PAN`;
  ctx.shadowBlur = 0;
  ctx.font = `700 ${pillFont}px ${STAMP_FONT_STACK}`;
  const tw = ctx.measureText(label).width;
  const px = bounds.x + 14;
  const py = bounds.y + 14;
  const pw = tw + 18;
  const ph = pillFont + 12;

  ctx.fillStyle = 'rgba(8, 12, 28, 0.86)';
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#3ef6ff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px, py, pw, ph);

  ctx.fillStyle = '#d4fcff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, px + 9, py + ph * 0.52);
  ctx.restore();
}

/**
 * Master compositor: draws the complete multi-panel GTA cover art onto `canvas`.
 */
export function renderCoverArt(canvas, state, photosById, options = {}) {
  const { highRes = false, showSelection = false } = options;
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');

  const minSide = Math.min(width, height);
  const frameMargin = Math.round(minSide * 0.022);
  const gutterWidth = Math.round(minSide * 0.016);
  const grade = getColorGradeById(state.gradeId);
  const panels = getLayoutPanels(state.layoutId, state.sizeId);
  const filterOpts = {
    gradeId: state.gradeId,
    posterStrength: state.posterStrength,
    inkStrength: state.inkStrength,
    highRes,
  };

  // Solid ink backdrop
  ctx.fillStyle = '#06040b';
  ctx.fillRect(0, 0, width, height);

  const basePolys = [];
  const floatingEntries = [];

  // 1. Draw all base panels first
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const pixelPoly = resolvePanelPixelPolygon(panel, width, height, frameMargin);
    if (panel.floating) {
      floatingEntries.push({ index: i, pixelPoly });
      continue;
    }
    basePolys.push(pixelPoly);
    const slot = state.panels[i] ?? { photoId: null, offsetX: 0, offsetY: 0, zoom: 1, flipX: false };
    const photo = slot.photoId ? photosById.get(slot.photoId) : null;
    drawClippedPanelPhoto(ctx, pixelPoly, photo, slot, filterOpts);
  }

  // 2. Unified Vice atmospheric rim lighting, halftone, vignette, and print grain across base photos
  drawHalftoneAndGrainOverlay(ctx, width, height, grade, state.grainAmount);

  // 3. Razor-sharp pitch-black comic ink gutters & outer frame drawn ABOVE rim lighting so borders stay deep black
  drawPanelInkBorders(ctx, basePolys, width, height, frameMargin, gutterWidth);

  // 4. Draw floating inset panels (with dramatic inked drop shadow) above base grid
  for (const entry of floatingEntries) {
    const slot = state.panels[entry.index] ?? { photoId: null, offsetX: 0, offsetY: 0, zoom: 1, flipX: false };
    const photo = slot.photoId ? photosById.get(slot.photoId) : null;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = Math.round(minSide * 0.032);
    ctx.shadowOffsetX = Math.round(minSide * 0.01);
    ctx.shadowOffsetY = Math.round(minSide * 0.014);
    buildPanelPolygonPath(ctx, entry.pixelPoly);
    ctx.fillStyle = '#05030a';
    ctx.fill();
    ctx.restore();

    drawClippedPanelPhoto(ctx, entry.pixelPoly, photo, slot, filterOpts);

    ctx.save();
    buildPanelPolygonPath(ctx, entry.pixelPoly);
    ctx.lineWidth = gutterWidth * 1.1;
    ctx.strokeStyle = '#05030a';
    ctx.lineJoin = 'miter';
    ctx.stroke();
    ctx.restore();
  }

  // 5. Optional Heat Stars + original corner stamp badge
  drawHeatStarsAndStamp(ctx, state, width, height, frameMargin, grade);

  // 6. Iconic bold display title lockup + retro sun/palm emblem + glowing neon script subtitle
  drawPosterTitleLockup(ctx, state, width, height, grade);

  // 7. Interactive editor-only active panel highlight (never baked into exported PNGs!)
  if (showSelection && state.selectedPanel >= 0 && state.selectedPanel < panels.length) {
    const selectedPoly = resolvePanelPixelPolygon(panels[state.selectedPanel], width, height, frameMargin);
    drawEditorSelectionHighlight(ctx, selectedPoly, state.selectedPanel, width);
  }
}

/**
 * Renders the cover at exact native target resolution (e.g. 1920×1080, 1080×1350, 1080×1080)
 * and resolves with a clean PNG Blob ready for instant local download.
 */
export function exportCoverToPngBlob(state, photosById, targetWidth, targetHeight) {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = targetWidth;
  exportCanvas.height = targetHeight;
  renderCoverArt(exportCanvas, state, photosById, { highRes: true, showSelection: false });
  return new Promise((resolve, reject) => {
    exportCanvas.toBlob((blob) => {
      if (blob) resolve({ blob, canvas: exportCanvas });
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}
