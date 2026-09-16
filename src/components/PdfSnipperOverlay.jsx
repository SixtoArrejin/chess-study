import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import { scanChessboard } from '../helpers/chessScanner';

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
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Extract selected area from the rendered PDF page canvas
  const processCropAndScan = useCallback(async (box) => {
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

      // Screen coordinates of selection
      const selScreenLeft = overlayRect.left + box.x;
      const selScreenTop = overlayRect.top + box.y;

      // Screen coordinates of the PDF page canvas inside the iframe
      const canvasScreenLeft = iframeRect.left + canvasRect.left;
      const canvasScreenTop = iframeRect.top + canvasRect.top;

      // Ratio between internal bitmap resolution and rendered CSS dimensions
      const scaleX = canvasEl.width / canvasRect.width;
      const scaleY = canvasEl.height / canvasRect.height;

      // Convert selection coordinates to canvas pixel space
      const cropX = Math.max(0, (selScreenLeft - canvasScreenLeft) * scaleX);
      const cropY = Math.max(0, (selScreenTop - canvasScreenTop) * scaleY);
      const cropW = Math.min(canvasEl.width - cropX, box.width * scaleX);
      const cropH = Math.min(canvasEl.height - cropY, box.height * scaleY);

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

    let x = Math.min(startPos.x, currentPos.x);
    let y = Math.min(startPos.y, currentPos.y);
    let width = Math.abs(currentPos.x - startPos.x);
    let height = Math.abs(currentPos.y - startPos.y);

    // If user simply clicked without dragging a significant rectangle,
    // take an expanded box around the click point to capture the board
    if (width < 25 && height < 25) {
      const clickBoxSize = 340;
      x = Math.max(0, startPos.x - clickBoxSize / 2);
      y = Math.max(0, startPos.y - clickBoxSize / 2);
      width = clickBoxSize;
      height = clickBoxSize;
    }

    processCropAndScan({ x, y, width, height });
  };

  // Calculate bounding box for the visual selection rectangle
  const selectionBox = isDragging && startPos && currentPos ? {
    left: Math.min(startPos.x, currentPos.x),
    top: Math.min(startPos.y, currentPos.y),
    width: Math.abs(currentPos.x - startPos.x),
    height: Math.abs(currentPos.y - startPos.y),
  } : null;

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
        background: 'rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(1.5px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
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
        }}
      >
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(var(--accent-color-rgb), 0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-color)' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
          {isScanning
            ? 'Analizando tablero y piezas mágicamente...'
            : 'Arrastra un recuadro o haz clic sobre el tablero para copiarlo'}
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
          }}
          title="Cancelar (Esc)"
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
            zIndex: 65,
            background: 'rgba(0, 0, 0, 0.4)',
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
      {selectionBox && selectionBox.width > 2 && selectionBox.height > 2 && (
        <div
          style={{
            position: 'absolute',
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px dashed var(--accent-color)',
            background: 'rgba(var(--accent-color-rgb), 0.15)',
            boxShadow: '0 0 16px rgba(var(--accent-color-rgb), 0.4), inset 0 0 12px rgba(var(--accent-color-rgb), 0.1)',
            pointerEvents: 'none',
            borderRadius: 4,
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
    </div>
  );
}
