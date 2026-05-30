/**
 * Chess piece recognition service - 100% client-side inference.
 * 
 * Uses a custom-trained CNN model exported as JSON weights + binary buffer.
 * Performs inference using pure JavaScript (no TensorFlow.js dependency),
 * which eliminates all WebGL/CPU backend compatibility issues.
 */

// ─── Class mapping (must match training order) ──────────────────────────────
export const CLASS_NAMES = ['empty', 'K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p'];

// ─── Model cache ────────────────────────────────────────────────────────────
let cachedModel = null;

/**
 * Load model architecture + weights from public/model/
 */
async function loadModel() {
  if (cachedModel) return cachedModel;

  console.log('Cargando modelo de reconocimiento personalizado...');

  const [archResponse, weightsResponse] = await Promise.all([
    fetch('/model/chess_model.json'),
    fetch('/model/chess_model.bin'),
  ]);

  if (!archResponse.ok) throw new Error('No se pudo cargar chess_model.json');
  if (!weightsResponse.ok) throw new Error('No se pudo cargar chess_model.bin');

  const architecture = await archResponse.json();
  const weightsBuffer = await weightsResponse.arrayBuffer();
  const weightsArray = new Float32Array(weightsBuffer);

  // Parse weight tensors from the flat buffer
  const weights = {};
  for (const meta of architecture.weights) {
    const start = meta.offset / 4; // float32 = 4 bytes
    const values = weightsArray.slice(start, start + meta.size);
    weights[meta.name] = {
      data: values,
      shape: meta.shape,
    };
  }

  cachedModel = { architecture, weights };
  const sizeKB = (weightsBuffer.byteLength / 1024).toFixed(1);
  console.log(`Modelo cargado: ${sizeKB} KB de pesos, ${architecture.num_classes} clases`);
  return cachedModel;
}


// ─── Pure JS tensor operations ──────────────────────────────────────────────

/**
 * 2D convolution with padding=1 (same), stride=1.
 * Input: [C_in, H, W], Kernel: [C_out, C_in, kH, kW], Bias: [C_out]
 * Output: [C_out, H, W]
 */
function conv2d(input, kernel, bias, inC, outC, H, W, kH, kW) {
  const padH = Math.floor(kH / 2);
  const padW = Math.floor(kW / 2);
  const output = new Float32Array(outC * H * W);

  for (let oc = 0; oc < outC; oc++) {
    for (let oh = 0; oh < H; oh++) {
      for (let ow = 0; ow < W; ow++) {
        let sum = bias[oc];
        for (let ic = 0; ic < inC; ic++) {
          for (let kh = 0; kh < kH; kh++) {
            for (let kw = 0; kw < kW; kw++) {
              const ih = oh + kh - padH;
              const iw = ow + kw - padW;
              if (ih >= 0 && ih < H && iw >= 0 && iw < W) {
                const inputIdx = ic * H * W + ih * W + iw;
                const kernelIdx = oc * inC * kH * kW + ic * kH * kW + kh * kW + kw;
                sum += input[inputIdx] * kernel[kernelIdx];
              }
            }
          }
        }
        output[oc * H * W + oh * W + ow] = sum;
      }
    }
  }
  return output;
}

/**
 * Batch normalization: y = (x - mean) / sqrt(var + eps) * gamma + beta
 * Operates on [C, H, W], normalizing per channel using running stats.
 */
function batchNorm(input, gamma, beta, runningMean, runningVar, C, H, W) {
  const eps = 1e-5;
  const output = new Float32Array(input.length);
  for (let c = 0; c < C; c++) {
    const mean = runningMean[c];
    const variance = runningVar[c];
    const scale = gamma[c] / Math.sqrt(variance + eps);
    const offset = beta[c] - mean * scale;
    for (let h = 0; h < H; h++) {
      for (let w = 0; w < W; w++) {
        const idx = c * H * W + h * W + w;
        output[idx] = input[idx] * scale + offset;
      }
    }
  }
  return output;
}

/** ReLU activation */
function relu(input) {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] > 0 ? input[i] : 0;
  }
  return output;
}

/** Max pooling 2x2, stride 2. Input: [C, H, W] -> [C, H/2, W/2] */
function maxPool2d(input, C, H, W) {
  const outH = H >> 1;
  const outW = W >> 1;
  const output = new Float32Array(C * outH * outW);
  for (let c = 0; c < C; c++) {
    for (let oh = 0; oh < outH; oh++) {
      for (let ow = 0; ow < outW; ow++) {
        const ih = oh * 2;
        const iw = ow * 2;
        const base = c * H * W;
        const v00 = input[base + ih * W + iw];
        const v01 = input[base + ih * W + iw + 1];
        const v10 = input[base + (ih + 1) * W + iw];
        const v11 = input[base + (ih + 1) * W + iw + 1];
        output[c * outH * outW + oh * outW + ow] = Math.max(v00, v01, v10, v11);
      }
    }
  }
  return output;
}

/** Dense (fully connected) layer: y = Wx + b */
function linear(input, weight, bias, inFeatures, outFeatures) {
  const output = new Float32Array(outFeatures);
  for (let o = 0; o < outFeatures; o++) {
    let sum = bias[o];
    for (let i = 0; i < inFeatures; i++) {
      sum += weight[o * inFeatures + i] * input[i];
    }
    output[o] = sum;
  }
  return output;
}

/** Softmax */
function softmax(input) {
  const output = new Float32Array(input.length);
  let maxVal = -Infinity;
  for (let i = 0; i < input.length; i++) {
    if (input[i] > maxVal) maxVal = input[i];
  }
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    output[i] = Math.exp(input[i] - maxVal);
    sum += output[i];
  }
  for (let i = 0; i < input.length; i++) {
    output[i] /= sum;
  }
  return output;
}


// ─── Forward pass ───────────────────────────────────────────────────────────

/**
 * Run the full CNN forward pass for a single 32x32 grayscale tile.
 * @param {Float32Array} input - [1, 32, 32] normalized to [0, 1]
 * @param {Object} weights - model weights dictionary
 * @returns {{ classIdx: number, confidence: number, probs: Float32Array }}
 */
function forwardPass(input, weights) {
  const w = weights;

  // ── Conv block 1: [1, 32, 32] -> [32, 16, 16] ──
  let x = conv2d(input,
    w['features.0.weight'].data, w['features.0.bias'].data,
    1, 32, 32, 32, 3, 3);
  x = batchNorm(x,
    w['features.1.weight'].data, w['features.1.bias'].data,
    w['features.1.running_mean'].data, w['features.1.running_var'].data,
    32, 32, 32);
  x = relu(x);
  x = maxPool2d(x, 32, 32, 32);

  // ── Conv block 2: [32, 16, 16] -> [64, 8, 8] ──
  x = conv2d(x,
    w['features.4.weight'].data, w['features.4.bias'].data,
    32, 64, 16, 16, 3, 3);
  x = batchNorm(x,
    w['features.5.weight'].data, w['features.5.bias'].data,
    w['features.5.running_mean'].data, w['features.5.running_var'].data,
    64, 16, 16);
  x = relu(x);
  x = maxPool2d(x, 64, 16, 16);

  // ── Conv block 3: [64, 8, 8] -> [128, 4, 4] ──
  x = conv2d(x,
    w['features.8.weight'].data, w['features.8.bias'].data,
    64, 128, 8, 8, 3, 3);
  x = batchNorm(x,
    w['features.9.weight'].data, w['features.9.bias'].data,
    w['features.9.running_mean'].data, w['features.9.running_var'].data,
    128, 8, 8);
  x = relu(x);
  x = maxPool2d(x, 128, 8, 8);

  // ── Classifier: flatten [128*4*4=2048] -> 256 -> 13 ──
  // (flatten is implicit - x is already flat as Float32Array)
  x = linear(x,
    w['classifier.1.weight'].data, w['classifier.1.bias'].data,
    128 * 4 * 4, 256);
  x = relu(x);
  // No dropout at inference time
  
  const logits = linear(x,
    w['classifier.4.weight'].data, w['classifier.4.bias'].data,
    256, 13);

  const probs = softmax(logits);

  // Find argmax
  let maxProb = -1;
  let maxIdx = 0;
  for (let i = 0; i < probs.length; i++) {
    if (probs[i] > maxProb) {
      maxProb = probs[i];
      maxIdx = i;
    }
  }

  return { classIdx: maxIdx, confidence: maxProb, probs };
}


// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Recognize chess pieces from a board canvas image.
 * @param {HTMLCanvasElement} boardCanvas - Canvas containing the cropped board
 * @returns {Promise<string>} FEN string
 */
export async function recognizeBoard(boardCanvas) {
  const model = await loadModel();

  console.log(`Procesando tablero: ${boardCanvas.width}×${boardCanvas.height}px`);

  const sw = boardCanvas.width / 8;
  const sh = boardCanvas.height / 8;

  // Verify canvas has actual content
  const debugCtx = boardCanvas.getContext('2d');
  const fullImg = debugCtx.getImageData(0, 0, boardCanvas.width, boardCanvas.height);
  let minP = 255, maxP = 0;
  for (let i = 0; i < fullImg.data.length; i += 4) {
    const g = Math.round(fullImg.data[i] * 0.299 + fullImg.data[i+1] * 0.587 + fullImg.data[i+2] * 0.114);
    if (g < minP) minP = g;
    if (g > maxP) maxP = g;
  }
  console.log(`Píxeles del recorte: Mín=${minP}, Máx=${maxP}`);
  if (minP === maxP) {
    console.warn('¡ADVERTENCIA! Canvas completamente uniforme.');
  }

  // Process all 64 squares
  const results = [];

  console.group('Clasificación de 64 casillas');
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      // Extract 32x32 grayscale tile
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = 32;
      tileCanvas.height = 32;
      const ctx = tileCanvas.getContext('2d');
      ctx.drawImage(boardCanvas, c * sw, r * sh, sw, sh, 0, 0, 32, 32);

      // Convert to grayscale in canvas
      const imgData = ctx.getImageData(0, 0, 32, 32);
      const pixels = imgData.data;
      const grayInput = new Float32Array(32 * 32);
      
      for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] * 0.299 + pixels[i+1] * 0.587 + pixels[i+2] * 0.114) / 255.0;
        grayInput[i / 4] = gray;
      }

      // Run forward pass
      const { classIdx, confidence, probs } = forwardPass(grayInput, model.weights);
      const pieceName = CLASS_NAMES[classIdx];
      
      const file = String.fromCharCode(97 + c);
      const rank = 8 - r;
      
      console.log(
        `${file}${rank} → ${pieceName === 'empty' ? '·' : pieceName} (${(confidence * 100).toFixed(1)}%)`
      );

      results.push({ row: r, col: c, classIdx, confidence, pieceName });
    }
  }
  console.groupEnd();

  // Build FEN string
  const fenRows = [];
  for (let r = 0; r < 8; r++) {
    let rowStr = '';
    let emptyCount = 0;

    for (let c = 0; c < 8; c++) {
      const result = results[r * 8 + c];
      const piece = result.pieceName;

      if (piece === 'empty') {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        rowStr += piece;
      }
    }

    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    fenRows.push(rowStr);
  }

  const piecePlacement = fenRows.join('/');
  console.log('FEN reconocido:', piecePlacement);

  return `${piecePlacement} w KQkq - 0 1`;
}
