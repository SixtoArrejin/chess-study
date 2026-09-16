import * as ort from 'onnxruntime-web/wasm';
import {
  findChessboardCorners,
  snapCorners,
  extractTiles,
  rgbaToGray,
  probsToPlacement,
  resolveOrientation,
  placementToFen
} from '@scoriiu/fenshot';
import { fenToPositionObject } from './chessHelpers.js';

// Configure ONNX Runtime WebAssembly location (served statically from public/ort/)
ort.env.wasm.wasmPaths = '/ort/';
ort.env.wasm.numThreads = 1;

let sessionPromise = null;

/**
 * Initializes and caches the ONNX InferenceSession for chess tile classification.
 */
export async function getScannerSession() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create('/models/chess-tiles-v2.onnx', {
      executionProviders: ['wasm'],
    }).catch((err) => {
      sessionPromise = null;
      console.error('[chessScanner] Error al cargar modelo ONNX:', err);
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * Warm up the scanner model in the background.
 */
export function warmUpScanner() {
  getScannerSession().catch(() => undefined);
}

/**
 * Converts various image inputs (Canvas, ImageData, ImageBitmap, HTMLImageElement, Blob/File)
 * to a 0-255 grayscale Float32Array { data, width, height } via ITU-R 601 luma.
 */
async function sourceToGray(source) {
  let canvas;
  let ctx;

  if (source instanceof ImageData) {
    return rgbaToGray(source.data, source.width, source.height);
  }

  if (source instanceof HTMLCanvasElement) {
    canvas = source;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return rgbaToGray(imgData.data, canvas.width, canvas.height);
  }

  // If source is Blob, File, HTMLImageElement or ImageBitmap
  let imgBitmap = source;
  if (source instanceof Blob || source instanceof File) {
    imgBitmap = await createImageBitmap(source);
  } else if (source instanceof HTMLImageElement) {
    if (!source.complete) {
      await new Promise((res, rej) => {
        source.onload = res;
        source.onerror = rej;
      });
    }
    imgBitmap = source;
  }

  const w = imgBitmap.naturalWidth || imgBitmap.width;
  const h = imgBitmap.naturalHeight || imgBitmap.height;

  canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imgBitmap, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  return rgbaToGray(imgData.data, w, h);
}

/**
 * Main scanner function: takes an image/crop of a chessboard, runs multi-candidate
 * corner arbitration, classifies tiles with the CNN, and outputs position data.
 *
 * @param {HTMLCanvasElement|ImageData|HTMLImageElement|Blob|File} imageSource
 * @param {Object} [options]
 * @param {boolean} [options.isManualCrop=false] - True if user manually selected the bounding box
 * @returns {Promise<{
 *   success: boolean,
 *   fen: string,
 *   piecesObject: Object,
 *   orientation: 'white'|'black',
 *   confidence: number,
 *   minConfidence: number,
 *   corners: Object
 * }>}
 */
export async function scanChessboard(imageSource, _options = {}) {
  try {
    const session = await getScannerSession();
    const gray = await sourceToGray(imageSource);

    const { width, height } = gray;
    if (width < 32 || height < 32) {
      return { success: false, error: 'La imagen o recorte es demasiado pequeño.' };
    }

    // Helper to evaluate a candidate corner box
    const evaluateCandidate = async (candidate) => {
      const tiles = extractTiles(gray, candidate);
      const out = await session.run({
        tiles: new ort.Tensor('float32', tiles, [64, 1024]),
      });
      const read = probsToPlacement(out['probs'].data);
      return {
        ...read,
        corners: candidate,
      };
    };

    const candidates = [];

    // 1. Auto-detected corners using gradient peaks
    try {
      const autoCorners = findChessboardCorners(gray);
      if (autoCorners) {
        // Valid bounds check
        if (autoCorners.x1 > autoCorners.x0 && autoCorners.y1 > autoCorners.y0) {
          candidates.push(autoCorners);
          const snapped = snapCorners(gray, autoCorners);
          candidates.push(snapped);
        }
      }
    } catch (e) {
      console.warn('[chessScanner] Corner detection error:', e);
    }

    // 2. Direct crop candidates (especially important for book diagrams / user manual snips)
    // Candidate: Exact image boundaries
    candidates.push({ x0: 0, y0: 0, x1: width, y1: height });

    // Inset candidates (removes borders, shadows, line margins)
    const pad1 = Math.round(Math.min(width, height) * 0.015);
    if (pad1 > 0) {
      candidates.push({ x0: pad1, y0: pad1, x1: width - pad1, y1: height - pad1 });
    }
    const pad2 = Math.round(Math.min(width, height) * 0.035);
    if (pad2 > pad1) {
      candidates.push({ x0: pad2, y0: pad2, x1: width - pad2, y1: height - pad2 });
    }
    const pad3 = Math.round(Math.min(width, height) * 0.06);
    if (pad3 > pad2) {
      candidates.push({ x0: pad3, y0: pad3, x1: width - pad3, y1: height - pad3 });
    }

    // Evaluate each candidate
    let bestResult = null;
    let highestScore = -Infinity;

    for (const cand of candidates) {
      try {
        const result = await evaluateCandidate(cand);
        // Score favors both high mean confidence and avoids zero-confidence tiles
        const score = result.meanConfidence * 0.7 + result.minConfidence * 0.3;
        if (score > highestScore) {
          highestScore = score;
          bestResult = result;
        }
      } catch (err) {
        console.warn('[chessScanner] Error evaluating candidate:', err);
      }
    }

    if (!bestResult) {
      return {
        success: false,
        error: 'No se pudo detectar un tablero en el área seleccionada.',
      };
    }

    // Determine orientation (white vs black at bottom)
    const { placement, orientation } = resolveOrientation(bestResult.placement);
    
    // Infer default castling/en-passant and format FEN
    const fullFen = placementToFen(placement, 'w');
    const piecesObject = fenToPositionObject(fullFen);

    const pieceCount = Object.keys(piecesObject).length;
    if (pieceCount === 0) {
      return {
        success: false,
        error: 'El tablero detectado parece estar vacío.',
        confidence: bestResult.meanConfidence,
      };
    }

    return {
      success: true,
      fen: fullFen,
      placement,
      piecesObject,
      orientation: orientation || 'white',
      confidence: Math.round(bestResult.meanConfidence * 100),
      minConfidence: Math.round(bestResult.minConfidence * 100),
      corners: bestResult.corners,
    };
  } catch (err) {
    console.error('[chessScanner] Unhandled scan error:', err);
    return {
      success: false,
      error: err.message || 'Error inesperado durante el reconocimiento.',
    };
  }
}

/**
 * Centered square fallback around click point.
 */
function createFallbackBox(width, height, cx, cy) {
  const fallbackSize = Math.max(40, Math.min(260, Math.round(Math.min(width, height) * 0.4)));
  const half = Math.round(fallbackSize / 2);
  const fbX = Math.max(0, Math.min(width - fallbackSize, cx - half));
  const fbY = Math.max(0, Math.min(height - fallbackSize, cy - half));
  return {
    x: fbX,
    y: fbY,
    width: fallbackSize,
    height: fallbackSize,
    method: 'fallback',
  };
}

/**
 * Detects the bounding box of a chessboard near (clickX, clickY) on an HTMLCanvasElement.
 * Uses a hybrid approach:
 * 1. Continuous outer border detection (ideal for book diagrams like Grau).
 * 2. Grid corner peak detection via @scoriiu/fenshot (for borderless digital boards).
 * 3. Centered square fallback.
 *
 * @param {HTMLCanvasElement} canvasEl
 * @param {number} clickX - X coordinate in canvas pixel coordinates
 * @param {number} clickY - Y coordinate in canvas pixel coordinates
 * @returns {{ x: number, y: number, width: number, height: number, method: string }}
 */
export function detectChessboardInCanvas(canvasEl, clickX, clickY) {
  if (!canvasEl || !canvasEl.width || !canvasEl.height) {
    return { x: 0, y: 0, width: 200, height: 200, method: 'fallback' };
  }

  const width = canvasEl.width;
  const height = canvasEl.height;

  const cx = Math.max(0, Math.min(width - 1, Math.round(clickX)));
  const cy = Math.max(0, Math.min(height - 1, Math.round(clickY)));

  const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return createFallbackBox(width, height, cx, cy);
  }

  // Define a localized search region around the click to keep processing fast (~2-5ms)
  const maxSpan = Math.min(Math.round(Math.min(width, height) * 0.85), 750);
  const minSpan = 35;

  const minX = Math.max(0, cx - maxSpan);
  const maxX = Math.min(width - 1, cx + maxSpan);
  const minY = Math.max(0, cy - maxSpan);
  const maxY = Math.min(height - 1, cy + maxSpan);
  const regionW = maxX - minX + 1;
  const regionH = maxY - minY + 1;

  if (regionW < minSpan || regionH < minSpan) {
    return createFallbackBox(width, height, cx, cy);
  }

  const imgData = ctx.getImageData(minX, minY, regionW, regionH);
  const data = imgData.data;
  const grayImg = new Uint8Array(regionW * regionH);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    grayImg[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  const localClickX = cx - minX;
  const localClickY = cy - minY;

  // Strategy 1: Look for continuous solid frame around click
  const vRuns = [];
  const darkThresh = 165;
  const tolerance = Math.max(30, Math.round(minSpan * 0.6));

  for (let x = 0; x < regionW; x++) {
    let runStart = -1;
    let gapCount = 0;
    for (let y = 0; y < regionH; y++) {
      const isDark = grayImg[y * regionW + x] < darkThresh;
      if (isDark) {
        if (runStart === -1) runStart = y;
        gapCount = 0;
      } else {
        if (runStart !== -1) {
          gapCount++;
          if (gapCount > 2) {
            const endY = y - gapCount;
            const len = endY - runStart;
            if (len >= minSpan && runStart <= localClickY + tolerance && endY >= localClickY - tolerance) {
              vRuns.push({ x, y0: runStart, y1: endY, len });
            }
            runStart = -1;
            gapCount = 0;
          }
        }
      }
    }
    if (runStart !== -1) {
      const endY = regionH - gapCount;
      const len = endY - runStart;
      if (len >= minSpan && runStart <= localClickY + tolerance && endY >= localClickY - tolerance) {
        vRuns.push({ x, y0: runStart, y1: endY, len });
      }
    }
  }

  const hRuns = [];
  for (let y = 0; y < regionH; y++) {
    let runStart = -1;
    let gapCount = 0;
    for (let x = 0; x < regionW; x++) {
      const isDark = grayImg[y * regionW + x] < darkThresh;
      if (isDark) {
        if (runStart === -1) runStart = x;
        gapCount = 0;
      } else {
        if (runStart !== -1) {
          gapCount++;
          if (gapCount > 2) {
            const endX = x - gapCount;
            const len = endX - runStart;
            if (len >= minSpan && runStart <= localClickX + tolerance && endX >= localClickX - tolerance) {
              hRuns.push({ y, x0: runStart, x1: endX, len });
            }
            runStart = -1;
            gapCount = 0;
          }
        }
      }
    }
    if (runStart !== -1) {
      const endX = regionW - gapCount;
      const len = endX - runStart;
      if (len >= minSpan && runStart <= localClickX + tolerance && endX >= localClickX - tolerance) {
        hRuns.push({ y, x0: runStart, x1: endX, len });
      }
    }
  }

  const lefts = vRuns.filter(r => r.x <= localClickX);
  const rights = vRuns.filter(r => r.x >= localClickX);
  const tops = hRuns.filter(r => r.y <= localClickY);
  const bottoms = hRuns.filter(r => r.y >= localClickY);

  let bestBox = null;
  let bestScore = -Infinity;

  for (const l of lefts) {
    for (const r of rights) {
      const w = r.x - l.x;
      if (w < minSpan || w > maxSpan) continue;

      const y0 = Math.max(l.y0, r.y0);
      const y1 = Math.min(l.y1, r.y1);
      const h = y1 - y0;

      const aspect = Math.min(w, h) / Math.max(w, h);
      if (aspect < 0.8) continue; // Chessboards are square

      let score = aspect * 100;
      const hasTop = tops.some(t => Math.abs(t.y - y0) <= 8);
      const hasBottom = bottoms.some(b => Math.abs(b.y - y1) <= 8);
      if (hasTop) score += 50;
      if (hasBottom) score += 50;

      // Distance penalty: prefer borders whose center is closest to click
      const centerDist = Math.hypot((l.x + r.x) / 2 - localClickX, (y0 + y1) / 2 - localClickY);
      score -= centerDist * 0.1;

      if (score > bestScore) {
        bestScore = score;
        bestBox = {
          x: minX + l.x,
          y: minY + y0,
          width: w,
          height: h,
        };
      }
    }
  }

  if (bestBox && bestScore >= 120) {
    return { ...bestBox, method: 'solid-frame', score: bestScore };
  }

  // Strategy 2: Grid detection with findChessboardCorners in windows
  const windowSizes = [Math.round(minSpan * 2.5), 200, 280, 360];
  for (const ws of windowSizes) {
    if (ws > regionW && ws > regionH) continue;
    const wX0 = Math.max(0, Math.min(regionW - ws, localClickX - Math.round(ws / 2)));
    const wY0 = Math.max(0, Math.min(regionH - ws, localClickY - Math.round(ws / 2)));
    const wW = Math.min(ws, regionW - wX0);
    const wH = Math.min(ws, regionH - wY0);

    const subData = new Float32Array(wW * wH);
    for (let y = 0; y < wH; y++) {
      for (let x = 0; x < wW; x++) {
        subData[y * wW + x] = grayImg[(wY0 + y) * regionW + (wX0 + x)];
      }
    }
    try {
      const c = findChessboardCorners({ data: subData, width: wW, height: wH });
      if (c && c.x1 > c.x0 && c.y1 > c.y0) {
        const gw = c.x1 - c.x0;
        const gh = c.y1 - c.y0;
        const aspect = Math.min(gw, gh) / Math.max(gw, gh);
        if (aspect >= 0.85 && gw >= minSpan) {
          return {
            x: minX + wX0 + c.x0,
            y: minY + wY0 + c.y0,
            width: gw,
            height: gh,
            method: 'grid-peaks',
          };
        }
      }
    } catch {
      // Ignore corner detection errors
    }
  }

  // Strategy 3: Fallback centered square
  return createFallbackBox(width, height, cx, cy);
}

