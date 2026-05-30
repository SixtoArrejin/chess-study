import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, Plus, Minus, MoveHorizontal } from 'lucide-react';

export default function PdfPanel({ pdfFile, setPdfFile }) {
  const fileInputRef = useRef(null);
  const iframeRef = useRef(null);
  const pdfUrlRef = useRef(null);
  const checkAppIntervalRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfViewerApp, setPdfViewerApp] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [tempPageInput, setTempPageInput] = useState('1');

  // Fit and Zoom states: start fitted horizontally ('width') by default
  const [fitMode, setFitMode] = useState('width');
  const [zoomScale, setZoomScale] = useState(1.0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const localStorageKey = useMemo(() => {
    if (!pdfFile) return '';
    return `chess_study_last_page_${pdfFile.name}_${pdfFile.size}`;
  }, [pdfFile]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') setPdfFile(file);
    else if (file) alert('Por favor, selecciona un archivo PDF válido.');
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') setPdfFile(file);
    else if (file) alert('Por favor, selecciona un archivo PDF válido.');
  };

  // Scroll to a specific page
  const scrollToPage = (pageNum) => {
    if (!pdfViewerApp) return;
    const target = Math.max(1, Math.min(numPages, pageNum));
    pdfViewerApp.page = target;
    setCurrentPage(target);
    localStorage.setItem(localStorageKey, String(target));
  };

  // Handle keyboard page flipping (ArrowLeft & ArrowRight)
  useEffect(() => {
    if (!pdfViewerApp || numPages === 0) return;

    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfViewerApp, currentPage, numPages, localStorageKey]);

  // Sync temp input box with page scrolling
  useEffect(() => {
    setTempPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageInputBlur = () => {
    const parsed = parseInt(tempPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      scrollToPage(parsed);
    } else {
      setTempPageInput(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Helper to apply zoom & fit settings to PDF.js
  const applyZoomAndFit = useCallback((app, mode, scale) => {
    if (!app || !app.pdfViewer) return;
    const currentVal = app.pdfViewer.currentScaleValue;
    if (mode === 'width') {
      if (currentVal !== 'page-width') {
        app.pdfViewer.currentScaleValue = 'page-width';
      }
    } else if (mode === 'height') {
      if (currentVal !== 'page-fit') {
        app.pdfViewer.currentScaleValue = 'page-fit';
      }
    } else {
      const currentScale = app.pdfViewer.currentScale;
      // Prevent feedback loops: only set if scale differs substantially and is not already active
      if (Math.abs(currentScale - scale) > 0.01 && currentVal !== String(scale)) {
        app.pdfViewer.currentScaleValue = String(scale);
      }
    }
  }, []);

  // Open the PDF File inside the PDF.js Web Viewer
  const openFileInViewer = useCallback(async (app, file) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      const objectUrl = URL.createObjectURL(file);
      pdfUrlRef.current = objectUrl;
      
      // Load file into PDFViewerApplication
      await app.open({ url: objectUrl });
    } catch (err) {
      console.error('Error opening PDF inside iframe:', err);
      setLoadError('Error al procesar el archivo PDF.');
      setIsLoading(false);
    }
  }, []);

  // Monitor pdfFile state changes to open or close the document
  useEffect(() => {
    if (!pdfViewerApp) return;

    if (pdfFile) {
      openFileInViewer(pdfViewerApp, pdfFile);
    } else {
      pdfViewerApp.close();
      setNumPages(0);
      setCurrentPage(1);
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    }
  }, [pdfFile, pdfViewerApp, openFileInViewer]);

  // Apply zoom and fit when states change in React
  useEffect(() => {
    if (!pdfViewerApp) return;
    applyZoomAndFit(pdfViewerApp, fitMode, zoomScale);
  }, [fitMode, zoomScale, pdfViewerApp, applyZoomAndFit]);

  // Sync overflow-x styling based on fitMode to prevent horizontal scrollbars on fit-width, but allow it on zoom
  useEffect(() => {
    if (!iframeRef.current || !pdfViewerApp) return;
    const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!iframeDoc) return;
    const viewerContainer = iframeDoc.getElementById('viewerContainer');
    if (!viewerContainer) return;
    
    if (fitMode === 'width') {
      viewerContainer.style.setProperty('overflow-x', 'hidden', 'important');
    } else {
      viewerContainer.style.setProperty('overflow-x', 'auto', 'important');
    }
  }, [fitMode, pdfViewerApp]);

  // Clean up Object URL and Interval on unmount
  useEffect(() => {
    return () => {
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
      }
      if (checkAppIntervalRef.current) {
        clearInterval(checkAppIntervalRef.current);
      }
    };
  }, []);

  // Callback to initialize iframe communication
  const handleIframeLoad = () => {
    if (!iframeRef.current) return;
    const iframeWindow = iframeRef.current.contentWindow;
    if (!iframeWindow) return;

    if (checkAppIntervalRef.current) {
      clearInterval(checkAppIntervalRef.current);
    }

    // Wait for the PDFViewerApplication to exist and be ready
    checkAppIntervalRef.current = setInterval(() => {
      const app = iframeWindow.PDFViewerApplication;
      if (app && app.initializedPromise) {
        clearInterval(checkAppIntervalRef.current);
        checkAppIntervalRef.current = null;

        app.initializedPromise.then(() => {
          setPdfViewerApp(app);

          // Configure EventBus listeners for page changes and initialization
          app.eventBus.on('pagechanging', (e) => {
            setCurrentPage(e.pageNumber);
            localStorage.setItem(localStorageKey, String(e.pageNumber));
          });

          app.eventBus.on('scalechanging', (e) => {
            setZoomScale(e.scale);
            const val = app.pdfViewer.currentScaleValue;
            if (val === 'page-width') {
              setFitMode('width');
            } else if (val === 'page-fit') {
              setFitMode('height');
            } else {
              setFitMode('custom');
            }
          });

          const onPagesInit = () => {
            setNumPages(app.pagesCount);
            
            // Restore last viewed page from localStorage
            const savedPage = localStorage.getItem(localStorageKey);
            if (savedPage) {
              const parsed = parseInt(savedPage, 10);
              if (parsed >= 1 && parsed <= app.pagesCount) {
                app.page = parsed;
                setCurrentPage(parsed);
              }
            }

            // Apply starting Zoom & Fit settings
            applyZoomAndFit(app, fitMode, zoomScale);
            setIsLoading(false);
          };

          app.eventBus.on('pagesinit', onPagesInit);
          app.eventBus.on('pagesloaded', onPagesInit);

          // Trigger loading if file is already ready
          if (pdfFile) {
            openFileInViewer(app, pdfFile);
          }
        });
      }
    }, 50);
  };

  const handleZoomIn = () => {
    setFitMode('custom');
    setZoomScale(prev => Math.min(3.0, prev + 0.1));
  };

  const handleZoomOut = () => {
    setFitMode('custom');
    setZoomScale(prev => Math.max(0.3, prev - 0.1));
  };

  const zoomPercentage = Math.round(zoomScale * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />

      <div style={{ flex: 1, padding: 10, overflow: 'hidden', display: 'flex' }}>
        {pdfFile ? (
          <div style={{
            width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--border-glass)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-glass)',
          }}>
            {/* Toolbar */}
            <div style={{
              height: 44,
              borderBottom: '1px solid var(--border-glass)',
              background: 'var(--bg-glass-active)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              gap: 8,
              zIndex: 5,
            }}>
              {/* Pagination controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="glass-button"
                  onClick={() => scrollToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Página Anterior (Flecha Izquierda)"
                >
                  <ChevronLeft style={{ width: 14, height: 14 }} />
                </button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <span>Página</span>
                  <input
                    type="text"
                    value={tempPageInput}
                    onChange={(e) => setTempPageInput(e.target.value)}
                    onBlur={handlePageInputBlur}
                    onKeyDown={handlePageInputKeyDown}
                    disabled={isLoading}
                    style={{
                      width: 38,
                      height: 24,
                      background: 'rgba(0, 0, 0, 0.05)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 4,
                      textAlign: 'center',
                      color: 'var(--text-primary)',
                      fontSize: 11,
                      fontWeight: 600,
                      outline: 'none',
                    }}
                  />
                  <span>de {numPages || '?'}</span>
                </div>

                <button
                  className="glass-button"
                  onClick={() => scrollToPage(currentPage + 1)}
                  disabled={currentPage >= numPages || isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Página Siguiente (Flecha Derecha)"
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* PDF Aspect Ratio Fitting Controls */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  className={`glass-button ${fitMode === 'width' ? 'active-outline' : ''}`}
                  onClick={() => setFitMode('width')}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Ajustar al Ancho"
                >
                  <MoveHorizontal style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Zoom controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="glass-button"
                  onClick={handleZoomOut}
                  disabled={isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Reducir Zoom"
                >
                  <Minus style={{ width: 12, height: 12 }} />
                </button>
                
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>
                  {zoomPercentage}%
                </span>

                <button
                  className="glass-button"
                  onClick={handleZoomIn}
                  disabled={isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Aumentar Zoom"
                >
                  <Plus style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>

            {/* High Performance PDF.js Iframe Viewport */}
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                background: 'rgba(0, 0, 0, 0.15)',
                position: 'relative',
              }}
            >
              {isLoading && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 10,
                  backdropFilter: 'blur(3px)',
                }}>
                  <div className="pulse-glow" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-color)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Cargando libro...
                  </span>
                </div>
              )}

              {loadError ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 32, textAlign: 'center', color: 'var(--danger-color)', gap: 12, height: '100%'
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{loadError}</p>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src="/pdfjs/web/viewer.html"
                  onLoad={handleIframeLoad}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: 'transparent',
                  }}
                  title="Visualizador PDF"
                />
              )}
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              width: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 14,
              border: isDragOver ? '2px solid var(--accent-color)' : '2px dashed var(--border-glass-glow)',
              background: isDragOver ? 'rgba(var(--accent-color-rgb), 0.06)' : 'var(--bg-glass)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(var(--accent-color-rgb), 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Upload style={{ width: 28, height: 28, color: 'var(--accent-color)' }} />
            </div>

            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Cargar Libro PDF
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 300, lineHeight: 1.6, marginBottom: 20 }}>
              Arrastra y suelta un archivo PDF aquí, o haz click para seleccionar tu libro de ajedrez.
            </p>

            <div className="glass-button" style={{ padding: '10px 20px', fontSize: 11 }}>
              <FileText style={{ width: 14, height: 14 }} />
              Seleccionar Archivo
            </div>

            <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 24, maxWidth: 260, lineHeight: 1.5, borderTop: '1px solid var(--border-glass)', paddingTop: 14 }}>
              Navegación por scroll continuo, selección de texto nativo y auto-ajuste de pantalla incluidos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
