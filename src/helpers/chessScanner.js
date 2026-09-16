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
