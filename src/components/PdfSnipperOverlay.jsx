import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Loader2, AlertCircle, Check, RotateCcw } from 'lucide-react';
import { scanChessboard, detectChessboardInCanvas } from '../helpers/chessScanner';

export default function PdfSnipperOverlay({
  iframeRef,
  currentPage,
  onClose,
  onPositionDetected,
}) {
  const overlayRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [stagedBox, setStagedBox] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Extract selected area from the rendered PDF page canvas
  const processCropAndScan = useCallback(async (box) => {
    if (!box) return;
    if (!iframeRef.current) return;
    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!iframeDoc) return;

    // Find the canvas corresponding to the current page in PDF.js
    const pageEl = iframeDoc.querySelector(`.page[data-page-number="${currentPage}"]`);
    const canvasEl = pageEl?.querySelector('canvas');

    if (!canvasEl) {
      setErrorMessage('No se encontró el lienzo de la página del libro.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const iframeRect = iframeRef.current.getBoundingClientRect();
      const canvasRect = canvasEl.getBoundingClientRect();

      const boxX = box.x ?? box.left ?? 0;
      const boxY = box.y ?? box.top ?? 0;
      const boxW = box.width ?? 0;
      const boxH = box.height ?? 0;

      // Screen coordinates of selection
      const selScreenLeft = overlayRect.left + boxX;
      const selScreenTop = overlayRect.top + boxY;

      // Screen coordinates of the PDF page canvas inside the iframe
      const canvasScreenLeft = iframeRect.left + canvasRect.left;
      const canvasScreenTop = iframeRect.top + canvasRect.top;

      // Ratio between internal bitmap resolution and rendered CSS dimensions
      const scaleX = canvasEl.width / canvasRect.width;
      const scaleY = canvasEl.height / canvasRect.height;

      // Convert selection coordinates to canvas pixel space
      const cropX = Math.max(0, (selScreenLeft - canvasScreenLeft) * scaleX);
      const cropY = Math.max(0, (selScreenTop - canvasScreenTop) * scaleY);
      const cropW = Math.min(canvasEl.width - cropX, boxW * scaleX);
      const cropH = Math.min(canvasEl.height - cropY, boxH * scaleY);

      if (cropW < 20 || cropH < 20) {
        throw new Error('El área seleccionada es demasiado pequeña.');
      }

      // Draw cropped portion to an offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round(cropW);
      offscreen.height = Math.round(cropH);
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(canvasEl, cropX, cropY, cropW, cropH, 0, 0, offscreen.width, offscreen.height);

      // Run local CNN classification
      const scanResult = await scanChessboard(offscreen, { isManualCrop: true });

      if (scanResult.success) {
        onPositionDetected(scanResult);
        onClose();
      } else {
        setErrorMessage(scanResult.error || 'No se pudo identificar una posición de ajedrez válida.');
        setIsScanning(false);
      }
    } catch (err) {
      console.error('[PdfSnipper] Error durante la captura:', err);
      setErrorMessage(err.message || 'Error al procesar el recorte.');
      setIsScanning(false);
    }
  }, [iframeRef, currentPage, onPositionDetected, onClose]);

  // Keyboard navigation (Enter to confirm staged box, Escape to unstage or close)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (stagedBox) {
          setStagedBox(null);
        } else {
          onClose();
        }
      } else if (e.key === 'Enter') {
        if (stagedBox && !isScanning) {
          e.preventDefault();
          processCropAndScan(stagedBox);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, stagedBox, isScanning, processCropAndScan]);

  const getPointerPos = (e) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    return {
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top)),
    };
  };

  const handlePointerDown = (e) => {
    if (isScanning) return;
    if (e.target.closest('[data-snipper-controls]')) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    setStartPos(pos);
    setCurrentPos(pos);
    setIsDragging(true);
    setErrorMessage(null);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || isScanning) return;
    e.preventDefault();
    const pos = getPointerPos(e);
    setCurrentPos(pos);
  };

  const handlePointerUp = (e) => {
    if (!isDragging || !startPos || !currentPos || isScanning) {
      setIsDragging(false);
      return;
    }
    e.preventDefault();
    setIsDragging(false);

    const rawW = Math.abs(currentPos.x - startPos.x);
    const rawH = Math.abs(currentPos.y - startPos.y);

    // Single click detected (< 15px of cursor travel)
    if (rawW < 15 && rawH < 15) {
      if (iframeRef.current && overlayRef.current) {
        const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        const pageEl = iframeDoc?.querySelector(`.page[data-page-number="${currentPage}"]`);
        const canvasEl = pageEl?.querySelector('canvas');

        if (canvasEl) {
          const overlayRect = overlayRef.current.getBoundingClientRect();
          const iframeRect = iframeRef.current.getBoundingClientRect();
          const canvasRect = canvasEl.getBoundingClientRect();

          const canvasScreenLeft = iframeRect.left + canvasRect.left;
          const canvasScreenTop = iframeRect.top + canvasRect.top;
          const scaleX = canvasEl.width / canvasRect.width;
          const scaleY = canvasEl.height / canvasRect.height;

          // Screen coords of click
          const clickScreenX = overlayRect.left + startPos.x;
          const clickScreenY = overlayRect.top + startPos.y;

          // Canvas coords of click
          const clickCanvasX = (clickScreenX - canvasScreenLeft) * scaleX;
          const clickCanvasY = (clickScreenY - canvasScreenTop) * scaleY;

          const detected = detectChessboardInCanvas(canvasEl, clickCanvasX, clickCanvasY);
          if (detected) {
            const boxScreenLeft = canvasScreenLeft + (detected.x / scaleX);
            const boxScreenTop = canvasScreenTop + (detected.y / scaleY);
            const boxScreenWidth = detected.width / scaleX;
            const boxScreenHeight = detected.height / scaleY;

            setStagedBox({
              x: Math.round(boxScreenLeft - overlayRect.left),
              y: Math.round(boxScreenTop - overlayRect.top),
              width: Math.round(boxScreenWidth),
              height: Math.round(boxScreenHeight),
            });
            return;
          }
        }
      }

      // Fallback box if canvas wasn't reachable
      const fallbackW = 220;
      setStagedBox({
        x: Math.max(0, Math.round(startPos.x - fallbackW / 2)),
        y: Math.max(0, Math.round(startPos.y - fallbackW / 2)),
        width: fallbackW,
        height: fallbackW,
      });
      return;
    }

    // Manual drag rectangle
    if (rawW >= 15 && rawH >= 15) {
      setStagedBox({
        x: Math.round(Math.min(startPos.x, currentPos.x)),
        y: Math.round(Math.min(startPos.y, currentPos.y)),
        width: Math.round(rawW),
        height: Math.round(rawH),
      });
    }
  };

  // Active drag selection box
  const selectionBox = isDragging && startPos && currentPos ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  } : null;

  // Active cutout window: either currently dragging or staged box
  const activeBox = (isDragging && selectionBox && selectionBox.width > 5 && selectionBox.height > 5)
    ? { x: selectionBox.left, y: selectionBox.top, width: selectionBox.width, height: selectionBox.height }
    : (!isDragging && stagedBox && stagedBox.width > 15 && stagedBox.height > 15)
    ? stagedBox
    : null;

  const overlayH = overlayRef.current?.clientHeight || 600;
  const overlayW = overlayRef.current?.clientWidth || 800;

  return (
    <div
      ref={overlayRef}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 60,
        cursor: isScanning ? 'wait' : 'crosshair',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Dimmed & Blurred Backdrop with Cutout Spotlight for the chessboard */}
      {!activeBox ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.28)',
            backdropFilter: 'blur(1.5px)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      ) : (
        <>
          {/* Top dimmed panel */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, activeBox.y),
              background: 'rgba(0, 0, 0, 0.38)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Bottom dimmed panel */}
          <div
            style={{
              position: 'absolute',
              top: activeBox.y + activeBox.height,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.38)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Left dimmed panel */}
          <div
            style={{
              position: 'absolute',
              top: activeBox.y,
              height: activeBox.height,
              left: 0,
              width: Math.max(0, activeBox.x),
              background: 'rgba(0, 0, 0, 0.38)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
          {/* Right dimmed panel */}
          <div
            style={{
              position: 'absolute',
              top: activeBox.y,
              height: activeBox.height,
              left: activeBox.x + activeBox.width,
              right: 0,
              background: 'rgba(0, 0, 0, 0.38)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        </>
      )}

      {/* Top Helper Banner */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 70,
          background: 'var(--bg-glass-active)',
          border: '1px solid var(--border-glass-glow)',
          backdropFilter: 'blur(12px)',
          borderRadius: 24,
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          pointerEvents: 'auto',
          maxWidth: '90%',
        }}
        data-snipper-controls="true"
      >
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(var(--accent-color-rgb), 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-color)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isScanning
            ? 'Analizando tablero y piezas mágicamente...'
            : stagedBox
            ? '¿El recuadro cubre todo el tablero? Presiona Enter o "Copiar tablero"'
            : 'Haz clic sobre el tablero o arrastra un recuadro para seleccionarlo'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="glass-button"
          style={{
            padding: '2px 6px',
            height: 22,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            cursor: 'pointer',
            flexShrink: 0
          }}
          title="Cancelar y salir (Esc)"
        >
          <X style={{ width: 12, height: 12 }} />
          <span>Esc</span>
        </button>
      </div>

      {/* Error Toast */}
      {errorMessage && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 70,
            background: 'rgba(239, 68, 68, 0.92)',
            color: '#ffffff',
            borderRadius: 10,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Scanning Spinner Indicator */}
      {isScanning && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            zIndex: 85,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(var(--accent-color-rgb), 0.2)',
            border: '1px solid var(--accent-color)',
            boxShadow: '0 0 20px rgba(var(--accent-color-rgb), 0.4)',
          }}>
            <Loader2 style={{ width: 24, height: 24, color: 'var(--accent-color)', animation: 'spin 1s linear infinite' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Extrayendo posición...
          </span>
        </div>
      )}

      {/* Dragging Selection Marquee */}
      {isDragging && selectionBox && selectionBox.width > 2 && selectionBox.height > 2 && (
        <div
          style={{
            position: 'absolute',
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px dashed var(--accent-color)',
            background: 'transparent',
            boxShadow: '0 0 16px rgba(var(--accent-color-rgb), 0.4)',
            pointerEvents: 'none',
            borderRadius: 4,
            zIndex: 50,
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: -22,
              right: 0,
              background: 'var(--accent-color)',
              color: '#ffffff',
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.04em',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            {Math.round(selectionBox.width)} × {Math.round(selectionBox.height)}
          </div>
        </div>
      )}

      {/* Intermediate Staged Box (Preview Before Scanning) */}
      {!isDragging && stagedBox && stagedBox.width > 15 && stagedBox.height > 15 && (
        <>
          <div
            style={{
              position: 'absolute',
              left: stagedBox.x,
              top: stagedBox.y,
              width: stagedBox.width,
              height: stagedBox.height,
              border: '2px solid var(--accent-color)',
              background: 'transparent',
              boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.4), 0 0 22px rgba(var(--accent-color-rgb), 0.55)',
              borderRadius: 4,
              pointerEvents: 'none',
              zIndex: 65,
              transition: 'all 0.15s ease-out',
            }}
          >
            {/* Corner Bracket Accents */}
            <div style={{ position: 'absolute', top: -3, left: -3, width: 8, height: 8, borderTop: '3px solid #ffffff', borderLeft: '3px solid #ffffff' }} />
            <div style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderTop: '3px solid #ffffff', borderRight: '3px solid #ffffff' }} />
            <div style={{ position: 'absolute', bottom: -3, left: -3, width: 8, height: 8, borderBottom: '3px solid #ffffff', borderLeft: '3px solid #ffffff' }} />
            <div style={{ position: 'absolute', bottom: -3, right: -3, width: 8, height: 8, borderBottom: '3px solid #ffffff', borderRight: '3px solid #ffffff' }} />

            {/* Dimension Badge */}
            <div
              style={{
                position: 'absolute',
                top: -22,
                left: 0,
                background: 'var(--bg-glass-active)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass)',
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 4,
                letterSpacing: '0.04em',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
              }}
            >
              {Math.round(stagedBox.width)} × {Math.round(stagedBox.height)} px
            </div>
          </div>

          {/* Floating Confirmation Toolbar Attached to Box */}
          <div
            data-snipper-controls="true"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: Math.max(10, Math.min(overlayW - 270, stagedBox.x + stagedBox.width / 2 - 130)),
              top: stagedBox.y + stagedBox.height + 12 > overlayH - 52
                ? Math.max(10, stagedBox.y - 44)
                : stagedBox.y + stagedBox.height + 12,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              zIndex: 75,
              background: 'var(--bg-glass-active)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-glass-glow)',
              borderRadius: 20,
              padding: '5px 10px',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.45)',
              pointerEvents: 'auto',
            }}
          >
            <button
              onClick={() => processCropAndScan(stagedBox)}
              className="glow-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 14,
                background: 'var(--accent-color)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
              }}
              title="Confirmar y reconocer posición (Enter)"
            >
              <Check style={{ width: 13, height: 13 }} />
              <span>Copiar tablero</span>
              <span style={{
                fontSize: 9,
                opacity: 0.9,
                background: 'rgba(255, 255, 255, 0.25)',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 800
              }}>Enter</span>
            </button>

            <button
              onClick={() => setStagedBox(null)}
              className="glass-button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: 14,
                cursor: 'pointer',
              }}
              title="Descartar recuadro y volver a seleccionar (Esc)"
            >
              <RotateCcw style={{ width: 12, height: 12 }} />
              <span>Reintentar</span>
              <span style={{ fontSize: 9, opacity: 0.6 }}>Esc</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

