/**
 * VICE FRAME — Interactive offline GTA-style cover art studio controller.
 * Manages local photo ingestion (drag & drop + file picker), interactive panel crop/pan/zoom,
 * multi-panel layouts, Vice color grades, undo/redo history, and instant native-res PNG export.
 */

import {
  COVER_LAYOUTS,
  POST_SIZES,
  computeSmartCropsForSinglePhoto,
  getLayoutPanels,
  getPostSizeById,
  hitTestPanel,
} from './layouts.js';
import { COLOR_GRADES } from './filters.js';
import { exportCoverToPngBlob, renderCoverArt } from './renderer.js';

const BUILTIN_SAMPLES = [
  { id: 'sample-chopper', name: 'Sunset Chopper', src: './samples/chopper-sunset.jpg' },
  { id: 'sample-convertible', name: 'Coast Cruiser', src: './samples/convertible-coast.jpg' },
  { id: 'sample-speedboat', name: 'Bay Speedboat', src: './samples/speedboat-bay.jpg' },
  { id: 'sample-boulevard', name: 'Neon Boulevard', src: './samples/boulevard-neon.jpg' },
];

const MAX_HISTORY = 35;

/** Default initial state for an immediate jaw-dropping Vice City multi-panel cover. */
function createDefaultState() {
  return {
    sizeId: 'landscape',
    layoutId: 'classic-5',
    gradeId: 'vice-sunset',
    posterStrength: 0.64,
    inkStrength: 0.70,
    grainAmount: 0.36,
    title: 'VICE | HORIZON',
    subtitle: 'Sunset Edition',
    stamp: 'VICE COAST • 2026',
    titlePosition: 'bottom-center',
    titleScale: 0.98,
    showEmblem: true,
    heatStars: 5,
    selectedPanel: 1,
    panels: [
      { photoId: 'sample-chopper', offsetX: 0.02, offsetY: -0.02, zoom: 1.08, flipX: false },
      { photoId: 'sample-convertible', offsetX: 0.02, offsetY: 0.06, zoom: 1.04, flipX: false },
      { photoId: 'sample-boulevard', offsetX: 0.44, offsetY: 0.04, zoom: 1.06, flipX: false },
      { photoId: 'sample-speedboat', offsetX: 0.0, offsetY: 0.04, zoom: 1.08, flipX: false },
      { photoId: 'sample-boulevard', offsetX: -0.46, offsetY: -0.06, zoom: 1.24, flipX: false },
    ],
  };
}

const photosById = new Map();
const photoOrder = [];
let state = createDefaultState();
let undoStack = [];
let redoStack = [];
let renderQueued = false;
let userPhotoSeq = 1;

// DOM Elements
const coverCanvas = document.getElementById('coverCanvas');
const stageDropTarget = document.getElementById('stageDropTarget');
const sizeSelector = document.getElementById('sizeSelector');
const layoutGrid = document.getElementById('layoutGrid');
const gradeGrid = document.getElementById('gradeGrid');
const photoTray = document.getElementById('photoTray');
const multiPhotoInput = document.getElementById('multiPhotoInput');
const singlePhotoInput = document.getElementById('singlePhotoInput');
const activePanelBadge = document.getElementById('activePanelBadge');
const panelZoomSlider = document.getElementById('panelZoomSlider');
const panelZoomVal = document.getElementById('panelZoomVal');
const posterSlider = document.getElementById('posterSlider');
const posterVal = document.getElementById('posterVal');
const inkSlider = document.getElementById('inkSlider');
const inkVal = document.getElementById('inkVal');
const grainSlider = document.getElementById('grainSlider');
const grainVal = document.getElementById('grainVal');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const stampInput = document.getElementById('stampInput');
const emblemToggle = document.getElementById('emblemToggle');
const titlePosPills = document.getElementById('titlePosPills');
const starsRow = document.getElementById('starsRow');
const titleScaleSlider = document.getElementById('titleScaleSlider');
const titleScaleVal = document.getElementById('titleScaleVal');
const stageStatusText = document.getElementById('stageStatusText');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const studioToast = document.getElementById('studioToast');

let toastTimer = null;
function showToast(message) {
  studioToast.textContent = message;
  studioToast.classList.add('visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => studioToast.classList.remove('visible'), 2500);
}

function cloneState(source) {
  return {
    ...source,
    panels: source.panels.map((p) => ({ ...p })),
  };
}

function pushUndoSnapshot() {
  undoStack.push(cloneState(state));
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack = [];
  syncHistoryButtons();
}

function syncHistoryButtons() {
  undoBtn.disabled = undoStack.length === 0;
  redoBtn.disabled = redoStack.length === 0;
}

function undoChange() {
  if (undoStack.length === 0) return;
  redoStack.push(cloneState(state));
  state = undoStack.pop();
  ensurePanelsMatchLayout();
  syncAllControlsFromState();
  scheduleRender();
}

function redoChange() {
  if (redoStack.length === 0) return;
  undoStack.push(cloneState(state));
  state = redoStack.pop();
  ensurePanelsMatchLayout();
  syncAllControlsFromState();
  scheduleRender();
}

/**
 * Ensures state.panels has one slot per panel in the active layout,
 * automatically filling newly exposed panels from loaded photos.
 */
function ensurePanelsMatchLayout() {
  const layoutPanels = getLayoutPanels(state.layoutId, state.sizeId);
  const count = layoutPanels.length;
  while (state.panels.length < count) {
    const idx = state.panels.length;
    const photoId = photoOrder.length > 0 ? photoOrder[idx % photoOrder.length] : null;
    state.panels.push({
      photoId,
      offsetX: idx >= photoOrder.length ? (idx % 2 === 0 ? 0.14 : -0.14) : 0,
      offsetY: 0,
      zoom: idx >= photoOrder.length ? 1.28 : 1.06,
      flipX: idx >= photoOrder.length && idx % 2 === 1,
    });
  }
  if (state.selectedPanel >= count) {
    state.selectedPanel = Math.max(0, count - 1);
  }
}

/**
 * Configures the live preview canvas dimensions at a sharp, fast interactive scale
 * matching the chosen export aspect ratio.
 */
function syncPreviewCanvasDimensions() {
  const size = getPostSizeById(state.sizeId);
  const previewLongSide = 1280;
  const scale = Math.min(1, previewLongSide / Math.max(size.width, size.height));
  const nextW = Math.round(size.width * scale);
  const nextH = Math.round(size.height * scale);
  if (coverCanvas.width !== nextW || coverCanvas.height !== nextH) {
    coverCanvas.width = nextW;
    coverCanvas.height = nextH;
  }
}

function scheduleRender(showSelection = true) {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    syncPreviewCanvasDimensions();
    renderCoverArt(coverCanvas, state, photosById, {
      highRes: false,
      showSelection,
    });
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

/** Loads built-in local sample photos (all offline relative files under app/samples/). */
async function loadBuiltinSamples() {
  const results = await Promise.allSettled(
    BUILTIN_SAMPLES.map(async (item) => {
      const image = await loadImageElement(item.src);
      return { ...item, image, thumbSrc: item.src, isSample: true };
    }),
  );
  for (const res of results) {
    if (res.status === 'fulfilled') {
      photosById.set(res.value.id, res.value);
      photoOrder.push(res.value.id);
    }
  }
}

/** Reads local image files via FileReader / data URL (never leaves the user's browser). */
function readLocalFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read local file'));
    reader.readAsDataURL(file);
  });
}

async function ingestUserPhotoFiles(fileList, targetPanelIndex = null) {
  const files = [...fileList].filter((f) => f.type.startsWith('image/'));
  if (files.length === 0) {
    showToast('Select PNG, JPG, or WebP images from your device');
    return;
  }

  pushUndoSnapshot();
  const addedIds = [];

  for (const file of files) {
    try {
      const dataUrl = await readLocalFileAsDataUrl(file);
      const image = await loadImageElement(dataUrl);
      const id = `user-photo-${userPhotoSeq++}`;
      const cleanName = file.name.replace(/\.[^.]+$/, '').slice(0, 18) || `Photo ${userPhotoSeq - 1}`;
      photosById.set(id, { id, name: cleanName, image, thumbSrc: dataUrl, isSample: false });
      photoOrder.unshift(id);
      addedIds.push(id);
    } catch {
      // Skip unreadable files gracefully
    }
  }

  if (addedIds.length === 0) return;

  const panelCount = getLayoutPanels(state.layoutId, state.sizeId).length;
  if (targetPanelIndex !== null && addedIds.length === 1) {
    // Dropped or chosen specifically for one panel
    state.panels[targetPanelIndex] = {
      photoId: addedIds[0],
      offsetX: 0,
      offsetY: 0,
      zoom: 1.04,
      flipX: false,
    };
    state.selectedPanel = targetPanelIndex;
    showToast(`Loaded "${photosById.get(addedIds[0]).name}" into Panel ${targetPanelIndex + 1}`);
  } else if (addedIds.length === 1) {
    // 1 uploaded photo: smartly fill every panel with varied dynamic crops!
    const crops = computeSmartCropsForSinglePhoto(panelCount);
    for (let i = 0; i < panelCount; i++) {
      state.panels[i] = { photoId: addedIds[0], ...crops[i] };
    }
    showToast(`Auto-filled all ${panelCount} panels from "${photosById.get(addedIds[0]).name}"`);
  } else {
    // Multiple uploaded photos: distribute cleanly across panels
    for (let i = 0; i < panelCount; i++) {
      const pid = addedIds[i % addedIds.length];
      const extraZoom = i >= addedIds.length ? 1.32 : 1.05;
      const shiftX = i >= addedIds.length ? (i % 2 === 0 ? 0.14 : -0.14) : 0;
      state.panels[i] = { photoId: pid, offsetX: shiftX, offsetY: 0, zoom: extraZoom, flipX: false };
    }
    showToast(`Distributed ${addedIds.length} local photos across ${panelCount} panels`);
  }

  renderPhotoTray();
  syncActivePanelControls();
  scheduleRender();
}

/** Builds compact vector preview thumbnails for the 5 multi-panel layout buttons. */
function buildLayoutMiniSvg(layoutId) {
  const panels = getLayoutPanels(layoutId, 'landscape');
  const polygons = panels
    .map((p, idx) => {
      const pts = p.points.map(([x, y]) => `${(x * 40 + 2).toFixed(1)},${(y * 24 + 2).toFixed(1)}`).join(' ');
      const shade = p.floating ? '#ff2e93' : idx % 2 === 0 ? '#3a2d66' : '#2a204d';
      return `<polygon points="${pts}" fill="${shade}" stroke="#080510" stroke-width="1.6"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 44 28" aria-hidden="true">${polygons}</svg>`;
}

function buildStaticUiControls() {
  // 1. Export post sizes
  sizeSelector.innerHTML = '';
  for (const size of POST_SIZES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'size-pill';
    btn.dataset.sizeId = size.id;
    btn.innerHTML = `${size.label}<span>${size.shortLabel}</span>`;
    btn.addEventListener('click', () => {
      if (state.sizeId === size.id) return;
      pushUndoSnapshot();
      state.sizeId = size.id;
      ensurePanelsMatchLayout();
      syncAllControlsFromState();
      scheduleRender();
      showToast(`Canvas set to ${size.label} (${size.shortLabel})`);
    });
    sizeSelector.appendChild(btn);
  }

  // 2. Multi-panel layouts
  layoutGrid.innerHTML = '';
  for (const layout of COVER_LAYOUTS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn';
    btn.dataset.layoutId = layout.id;
    btn.title = layout.description;
    btn.innerHTML = `${buildLayoutMiniSvg(layout.id)}<span>${layout.name}</span>`;
    btn.addEventListener('click', () => {
      if (state.layoutId === layout.id) return;
      pushUndoSnapshot();
      state.layoutId = layout.id;
      ensurePanelsMatchLayout();
      syncAllControlsFromState();
      scheduleRender();
    });
    layoutGrid.appendChild(btn);
  }

  // 3. Color grades
  gradeGrid.innerHTML = '';
  for (const grade of COLOR_GRADES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-btn';
    btn.dataset.gradeId = grade.id;
    const gradCss = `linear-gradient(115deg, ${grade.swatches.join(', ')})`;
    btn.innerHTML = `<span class="grade-swatch" style="background:${gradCss}"></span><span>${grade.name.split(' ')[0]}</span>`;
    btn.title = grade.name;
    btn.addEventListener('click', () => {
      if (state.gradeId === grade.id) return;
      pushUndoSnapshot();
      state.gradeId = grade.id;
      syncAllControlsFromState();
      scheduleRender();
    });
    gradeGrid.appendChild(btn);
  }

  // 4. Heat Stars (click active last star again to set 0)
  starsRow.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'star-btn';
    btn.dataset.star = String(i);
    btn.textContent = '★';
    btn.title = `Set ${i} Heat Stars`;
    btn.addEventListener('click', () => {
      pushUndoSnapshot();
      state.heatStars = state.heatStars === i ? 0 : i;
      syncAllControlsFromState();
      scheduleRender();
    });
    starsRow.appendChild(btn);
  }
}

function renderPhotoTray() {
  photoTray.innerHTML = '';
  const activeSlot = state.panels[state.selectedPanel];
  const activePhotoId = activeSlot ? activeSlot.photoId : null;

  for (const pid of photoOrder.slice(0, 9)) {
    const photo = photosById.get(pid);
    if (!photo) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `photo-thumb${pid === activePhotoId ? ' assigned' : ''}`;
    btn.title = `Click to place "${photo.name}" into Panel ${state.selectedPanel + 1}`;
    btn.innerHTML = `<img src="${photo.thumbSrc}" alt="${photo.name}"><span class="photo-thumb-label">${photo.name}</span>`;
    btn.addEventListener('click', () => {
      pushUndoSnapshot();
      ensurePanelsMatchLayout();
      state.panels[state.selectedPanel] = {
        photoId: pid,
        offsetX: 0,
        offsetY: 0,
        zoom: 1.05,
        flipX: false,
      };
      renderPhotoTray();
      syncActivePanelControls();
      scheduleRender();
    });
    photoTray.appendChild(btn);
  }

  // Always show a tactile "+ Add" drop/upload tile inside the tray
  const addTile = document.createElement('button');
  addTile.type = 'button';
  addTile.className = 'photo-add-tile';
  addTile.innerHTML = '<span>＋</span><span>Add Photo</span>';
  addTile.addEventListener('click', () => multiPhotoInput.click());
  photoTray.appendChild(addTile);
}

function syncActivePanelControls() {
  const layoutPanels = getLayoutPanels(state.layoutId, state.sizeId);
  const idx = Math.max(0, Math.min(layoutPanels.length - 1, state.selectedPanel));
  const descriptor = layoutPanels[idx];
  const slot = state.panels[idx] ?? { zoom: 1 };

  activePanelBadge.textContent = `Panel ${idx + 1} • ${descriptor.label}`;
  panelZoomSlider.value = String(slot.zoom ?? 1);
  panelZoomVal.textContent = `${(slot.zoom ?? 1).toFixed(2)}×`;
}

function syncAllControlsFromState() {
  for (const btn of sizeSelector.querySelectorAll('.size-pill')) {
    btn.classList.toggle('active', btn.dataset.sizeId === state.sizeId);
  }
  for (const btn of layoutGrid.querySelectorAll('.layout-btn')) {
    btn.classList.toggle('active', btn.dataset.layoutId === state.layoutId);
  }
  for (const btn of gradeGrid.querySelectorAll('.grade-btn')) {
    btn.classList.toggle('active', btn.dataset.gradeId === state.gradeId);
  }
  for (const btn of titlePosPills.querySelectorAll('.pos-pill')) {
    btn.classList.toggle('active', btn.dataset.pos === state.titlePosition);
  }
  for (const btn of starsRow.querySelectorAll('.star-btn')) {
    btn.classList.toggle('lit', Number(btn.dataset.star) <= state.heatStars);
  }

  posterSlider.value = String(state.posterStrength);
  posterVal.textContent = `${Math.round(state.posterStrength * 100)}%`;
  inkSlider.value = String(state.inkStrength);
  inkVal.textContent = `${Math.round(state.inkStrength * 100)}%`;
  grainSlider.value = String(state.grainAmount);
  grainVal.textContent = `${Math.round(state.grainAmount * 100)}%`;

  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  stampInput.value = state.stamp;
  emblemToggle.checked = Boolean(state.showEmblem);
  titleScaleSlider.value = String(state.titleScale ?? 1);
  titleScaleVal.textContent = `${Math.round((state.titleScale ?? 1) * 100)}%`;

  const activeSize = getPostSizeById(state.sizeId);
  stageStatusText.textContent = `${activeSize.label} (${activeSize.shortLabel}) PNG Ready • Click any panel to pan & zoom • 100% Private & Offline`;

  syncActivePanelControls();
  renderPhotoTray();
  syncHistoryButtons();
}

/** Converts client pointer coordinates to internal coverCanvas pixel coordinates. */
function pointerToCanvasCoords(evt) {
  const rect = coverCanvas.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * coverCanvas.width,
    y: ((evt.clientY - rect.top) / rect.height) * coverCanvas.height,
  };
}

function setupCanvasInteractions() {
  let dragging = false;
  let dragMoved = false;
  let dragPanelIdx = -1;
  let startX = 0;
  let startY = 0;
  let startOffsetX = 0;
  let startOffsetY = 0;
  let preDragState = null;

  coverCanvas.addEventListener('pointerdown', (evt) => {
    const pos = pointerToCanvasCoords(evt);
    const minSide = Math.min(coverCanvas.width, coverCanvas.height);
    const frameMargin = Math.round(minSide * 0.022);
    const panels = getLayoutPanels(state.layoutId, state.sizeId);
    const hit = hitTestPanel(panels, coverCanvas.width, coverCanvas.height, frameMargin, pos.x, pos.y);
    if (hit < 0) return;

    state.selectedPanel = hit;
    syncActivePanelControls();
    renderPhotoTray();
    scheduleRender();

    dragging = true;
    dragMoved = false;
    dragPanelIdx = hit;
    startX = pos.x;
    startY = pos.y;
    startOffsetX = state.panels[hit].offsetX ?? 0;
    startOffsetY = state.panels[hit].offsetY ?? 0;
    preDragState = cloneState(state);

    coverCanvas.classList.add('dragging');
    coverCanvas.setPointerCapture(evt.pointerId);
  });

  coverCanvas.addEventListener('pointermove', (evt) => {
    if (!dragging || dragPanelIdx < 0) return;
    const pos = pointerToCanvasCoords(evt);
    const dx = (pos.x - startX) / (coverCanvas.width * 0.42);
    const dy = (pos.y - startY) / (coverCanvas.height * 0.42);
    if (Math.hypot(pos.x - startX, pos.y - startY) > 3) dragMoved = true;

    const slot = state.panels[dragPanelIdx];
    slot.offsetX = Math.max(-1.2, Math.min(1.2, startOffsetX + dx));
    slot.offsetY = Math.max(-1.2, Math.min(1.2, startOffsetY + dy));
    scheduleRender();
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    coverCanvas.classList.remove('dragging');
    if (dragMoved && preDragState) {
      undoStack.push(preDragState);
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack = [];
      syncHistoryButtons();
    }
    preDragState = null;
  };

  coverCanvas.addEventListener('pointerup', endDrag);
  coverCanvas.addEventListener('pointercancel', endDrag);

  // Smooth wheel zoom directly over any panel
  coverCanvas.addEventListener(
    'wheel',
    (evt) => {
      evt.preventDefault();
      const pos = pointerToCanvasCoords(evt);
      const minSide = Math.min(coverCanvas.width, coverCanvas.height);
      const frameMargin = Math.round(minSide * 0.022);
      const panels = getLayoutPanels(state.layoutId, state.sizeId);
      const hit = hitTestPanel(panels, coverCanvas.width, coverCanvas.height, frameMargin, pos.x, pos.y);
      const idx = hit >= 0 ? hit : state.selectedPanel;
      if (idx < 0 || !state.panels[idx]) return;

      state.selectedPanel = idx;
      const slot = state.panels[idx];
      const delta = evt.deltaY < 0 ? 0.08 : -0.08;
      slot.zoom = Math.max(1, Math.min(2.8, Number(((slot.zoom ?? 1) + delta).toFixed(2))));
      syncActivePanelControls();
      scheduleRender();
    },
    { passive: false },
  );
}

function setupDragAndDrop() {
  let dragCounter = 0;

  window.addEventListener('dragenter', (evt) => {
    evt.preventDefault();
    dragCounter++;
    stageDropTarget.classList.add('drag-over');
  });

  window.addEventListener('dragover', (evt) => {
    evt.preventDefault();
  });

  window.addEventListener('dragleave', () => {
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) stageDropTarget.classList.remove('drag-over');
  });

  window.addEventListener('drop', (evt) => {
    evt.preventDefault();
    dragCounter = 0;
    stageDropTarget.classList.remove('drag-over');
    if (!evt.dataTransfer || evt.dataTransfer.files.length === 0) return;

    // Check whether user dropped directly onto a specific canvas panel
    const rect = coverCanvas.getBoundingClientRect();
    let targetPanel = null;
    if (
      evt.dataTransfer.files.length === 1 &&
      evt.clientX >= rect.left &&
      evt.clientX <= rect.right &&
      evt.clientY >= rect.top &&
      evt.clientY <= rect.bottom
    ) {
      const pos = pointerToCanvasCoords(evt);
      const minSide = Math.min(coverCanvas.width, coverCanvas.height);
      const frameMargin = Math.round(minSide * 0.022);
      const panels = getLayoutPanels(state.layoutId, state.sizeId);
      const hit = hitTestPanel(panels, coverCanvas.width, coverCanvas.height, frameMargin, pos.x, pos.y);
      if (hit >= 0) targetPanel = hit;
    }

    ingestUserPhotoFiles(evt.dataTransfer.files, targetPanel);
  });
}

function bindEventListeners() {
  document.getElementById('uploadPhotosBtn').addEventListener('click', () => multiPhotoInput.click());
  document.getElementById('replacePanelPhotoBtn').addEventListener('click', () => singlePhotoInput.click());

  multiPhotoInput.addEventListener('change', (evt) => {
    if (evt.target.files?.length) ingestUserPhotoFiles(evt.target.files, null);
    evt.target.value = '';
  });

  singlePhotoInput.addEventListener('change', (evt) => {
    if (evt.target.files?.length) ingestUserPhotoFiles(evt.target.files, state.selectedPanel);
    evt.target.value = '';
  });

  document.getElementById('spreadPhotosBtn').addEventListener('click', () => {
    if (photoOrder.length === 0) return;
    pushUndoSnapshot();
    const count = getLayoutPanels(state.layoutId, state.sizeId).length;
    for (let i = 0; i < count; i++) {
      state.panels[i] = {
        photoId: photoOrder[i % photoOrder.length],
        offsetX: i >= photoOrder.length ? (i % 2 === 0 ? 0.16 : -0.16) : 0,
        offsetY: 0,
        zoom: i >= photoOrder.length ? 1.32 : 1.06,
        flipX: i >= photoOrder.length && i % 2 === 1,
      };
    }
    syncAllControlsFromState();
    scheduleRender();
    showToast(`Spread ${Math.min(photoOrder.length, count)} photos across all panels`);
  });

  document.getElementById('fillAllFromPanelBtn').addEventListener('click', () => {
    const current = state.panels[state.selectedPanel];
    if (!current?.photoId) return;
    pushUndoSnapshot();
    const count = getLayoutPanels(state.layoutId, state.sizeId).length;
    const crops = computeSmartCropsForSinglePhoto(count);
    for (let i = 0; i < count; i++) {
      state.panels[i] = { photoId: current.photoId, ...crops[i] };
    }
    syncAllControlsFromState();
    scheduleRender();
    showToast('Auto-filled all panels with multi-angle crops of selected photo');
  });

  panelZoomSlider.addEventListener('input', () => {
    const slot = state.panels[state.selectedPanel];
    if (!slot) return;
    slot.zoom = Number(panelZoomSlider.value);
    panelZoomVal.textContent = `${slot.zoom.toFixed(2)}×`;
    scheduleRender();
  });

  document.getElementById('flipPanelBtn').addEventListener('click', () => {
    const slot = state.panels[state.selectedPanel];
    if (!slot) return;
    pushUndoSnapshot();
    slot.flipX = !slot.flipX;
    scheduleRender();
  });

  document.getElementById('resetPanelBtn').addEventListener('click', () => {
    const slot = state.panels[state.selectedPanel];
    if (!slot) return;
    pushUndoSnapshot();
    slot.offsetX = 0;
    slot.offsetY = 0;
    slot.zoom = 1.04;
    slot.flipX = false;
    syncActivePanelControls();
    scheduleRender();
  });

  posterSlider.addEventListener('input', () => {
    state.posterStrength = Number(posterSlider.value);
    posterVal.textContent = `${Math.round(state.posterStrength * 100)}%`;
    scheduleRender();
  });

  inkSlider.addEventListener('input', () => {
    state.inkStrength = Number(inkSlider.value);
    inkVal.textContent = `${Math.round(state.inkStrength * 100)}%`;
    scheduleRender();
  });

  grainSlider.addEventListener('input', () => {
    state.grainAmount = Number(grainSlider.value);
    grainVal.textContent = `${Math.round(state.grainAmount * 100)}%`;
    scheduleRender();
  });

  titleInput.addEventListener('input', () => {
    state.title = titleInput.value;
    scheduleRender();
  });

  subtitleInput.addEventListener('input', () => {
    state.subtitle = subtitleInput.value;
    scheduleRender();
  });

  stampInput.addEventListener('input', () => {
    state.stamp = stampInput.value;
    scheduleRender();
  });

  emblemToggle.addEventListener('change', () => {
    pushUndoSnapshot();
    state.showEmblem = emblemToggle.checked;
    scheduleRender();
  });

  titleScaleSlider.addEventListener('input', () => {
    state.titleScale = Number(titleScaleSlider.value);
    titleScaleVal.textContent = `${Math.round(state.titleScale * 100)}%`;
    scheduleRender();
  });

  for (const pill of titlePosPills.querySelectorAll('.pos-pill')) {
    pill.addEventListener('click', () => {
      pushUndoSnapshot();
      state.titlePosition = pill.dataset.pos;
      syncAllControlsFromState();
      scheduleRender();
    });
  }

  undoBtn.addEventListener('click', undoChange);
  redoBtn.addEventListener('click', redoChange);

  window.addEventListener('keydown', (evt) => {
    const tag = evt.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'z') {
      evt.preventDefault();
      if (evt.shiftKey) redoChange();
      else undoChange();
    } else if ((evt.ctrlKey || evt.metaKey) && evt.key.toLowerCase() === 'y') {
      evt.preventDefault();
      redoChange();
    }
  });

  document.getElementById('randomizeBtn').addEventListener('click', () => {
    pushUndoSnapshot();
    const layoutIdx = (COVER_LAYOUTS.findIndex((l) => l.id === state.layoutId) + 1) % COVER_LAYOUTS.length;
    const gradeIdx = (COLOR_GRADES.findIndex((g) => g.id === state.gradeId) + 1) % COLOR_GRADES.length;
    state.layoutId = COVER_LAYOUTS[layoutIdx].id;
    state.gradeId = COLOR_GRADES[gradeIdx].id;
    ensurePanelsMatchLayout();
    syncAllControlsFromState();
    scheduleRender();
    showToast(`Style: ${COVER_LAYOUTS[layoutIdx].name} • ${COLOR_GRADES[gradeIdx].name}`);
  });

  document.getElementById('exportPngBtn').addEventListener('click', async () => {
    const size = getPostSizeById(state.sizeId);
    try {
      const { blob } = await exportCoverToPngBlob(state, photosById, size.width, size.height);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const slug = (state.title || 'vice-frame').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
      link.download = `${slug}-${size.width}x${size.height}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      showToast(`Exported ${size.width} × ${size.height} PNG!`);
    } catch {
      showToast('Export failed — please try again');
    }
  });
}

/**
 * Applies optional query parameters for direct preset launching and clean cover previews.
 */
function applyQueryPresetIfPresent() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('size')) state.sizeId = params.get('size');
  if (params.has('layout')) state.layoutId = params.get('layout');
  if (params.has('grade')) state.gradeId = params.get('grade');
  if (params.has('title')) state.title = params.get('title');
  if (params.has('subtitle')) state.subtitle = params.get('subtitle');
  if (params.has('stamp')) state.stamp = params.get('stamp');
  if (params.has('pos')) state.titlePosition = params.get('pos');
  if (params.has('scale')) state.titleScale = Number(params.get('scale'));
  if (params.has('stars')) state.heatStars = Number(params.get('stars'));
  if (params.has('emblem')) state.showEmblem = params.get('emblem') !== '0';
  if (params.has('panel')) state.selectedPanel = Number(params.get('panel'));
  ensurePanelsMatchLayout();
}

async function bootstrapStudio() {
  buildStaticUiControls();
  await loadBuiltinSamples();
  applyQueryPresetIfPresent();
  syncAllControlsFromState();
  setupCanvasInteractions();
  setupDragAndDrop();
  bindEventListeners();
  scheduleRender(true);

  // Expose live export helper on window for verification & automated screenshot capture
  window.__VICE_FRAME__ = {
    getState: () => cloneState(state),
    renderExportDataUrl: async () => {
      const size = getPostSizeById(state.sizeId);
      const { canvas } = await exportCoverToPngBlob(state, photosById, size.width, size.height);
      return { width: size.width, height: size.height, dataUrl: canvas.toDataURL('image/png') };
    },
    setPanelPhoto: (panelIdx, photoId, crop = {}) => {
      ensurePanelsMatchLayout();
      if (state.panels[panelIdx]) {
        state.panels[panelIdx] = { ...state.panels[panelIdx], photoId, ...crop };
        syncAllControlsFromState();
        scheduleRender(true);
      }
    },
  };
}

bootstrapStudio();
