import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, Plus, Minus, MoveHorizontal, BookOpen } from 'lucide-react';

const CLASSIC_BOOKS = [
  {
    title: 'Tomo I: Rudimentos',
    subtitle: 'Roberto Grau · 14.8 MB',
    filename: 'Tratado_General_de_Ajedrez_Tomo_I_Rudime.pdf',
    path: '/books/Tratado_General_de_Ajedrez_Tomo_I_Rudime.pdf'
  },
  {
    title: 'Tomo II: Táctica',
    subtitle: 'Roberto Grau · 23.6 MB',
    filename: 'Tratado General de Ajedrez - Tomo II - Tactica.pdf',
    path: '/books/Tratado General de Ajedrez - Tomo II - Tactica.pdf'
  },
  {
    title: 'Tomo III: Conformación de Peones',
    subtitle: 'Roberto Grau · 18.0 MB',
    filename: 'Tratado_General_de_Ajedrez_Tomo_III_Conf.pdf',
    path: '/books/Tratado_General_de_Ajedrez_Tomo_III_Conf.pdf'
  },
  {
    title: 'Tomo IV: Estrategia Superior',
    subtitle: 'Roberto Grau · 18.4 MB',
    filename: 'Tratado_General_de_Ajedrez_Tomo_IV_Estra.pdf',
    path: '/books/Tratado_General_de_Ajedrez_Tomo_IV_Estra.pdf'
  }
];

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
  const [isClassicLoading, setIsClassicLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const localStorageKey = useMemo(() => {
    if (!pdfFile) return '';
    return `chess_study_last_page_${pdfFile.name}_${pdfFile.size}`;
  }, [pdfFile]);

  const localStorageKeyRef = useRef(localStorageKey);
  useEffect(() => {
    localStorageKeyRef.current = localStorageKey;
  }, [localStorageKey]);

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
    if (!pdfViewerApp || !pdfViewerApp.pdfDocument || numPages === 0) return;
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
      // Keep previous object URLs alive during rapid timeline seeking to avoid PDF.js ERR_FILE_NOT_FOUND
      // if (pdfUrlRef.current) {
      //   URL.revokeObjectURL(pdfUrlRef.current);
      // }
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

  /* ===== Video Automation Hook ===== */
  useEffect(() => {
    if (pdfViewerApp) {
      window.__pdfControl = {
        pdfViewerApp,
        setPage: (pageNum) => scrollToPage(pageNum)
      };
    }
    return () => {
      window.__pdfControl = null;
    };
  }, [pdfViewerApp, scrollToPage]);

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
            const key = localStorageKeyRef.current;
            if (key) {
              localStorage.setItem(key, String(e.pageNumber));
            }
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
            
            // Restore last viewed page from localStorage using the mutable ref to avoid stale closure
            const key = localStorageKeyRef.current;
            if (key) {
              const savedPage = localStorage.getItem(key);
              if (savedPage) {
                const parsed = parseInt(savedPage, 10);
                if (parsed >= 1 && parsed <= app.pagesCount) {
                  app.page = parsed;
                  setCurrentPage(parsed);
                }
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

  const handleLoadClassicBook = async (book) => {
    setIsClassicLoading(true);
    try {
      const response = await fetch(book.path);
      if (!response.ok) throw new Error('Error al descargar el libro.');
      const blob = await response.blob();
      const file = new File([blob], book.filename, { type: 'application/pdf' });
      setPdfFile(file);
    } catch (err) {
      console.error('Error loading classic book:', err);
      alert('Error al descargar el libro de ajedrez clásico. Por favor intenta de nuevo.');
    } finally {
      setIsClassicLoading(false);
    }
  };

  const zoomPercentage = Math.round(zoomScale * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />

      {isClassicLoading && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 100,
          backdropFilter: 'blur(4px)',
          borderRadius: 12,
        }}>
          <div className="pulse-glow" style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--accent-color)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Preparando clásico del ajedrez...
          </span>
        </div>
      )}

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
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            gap: 16, overflowY: 'auto', padding: '10px 4px'
          }}>
            {/* Top Upload Zone */}
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
                padding: '24px 20px',
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(var(--accent-color-rgb), 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 10,
              }}>
                <Upload style={{ width: 22, height: 22, color: 'var(--accent-color)' }} />
              </div>

              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Cargar tu propio libro PDF
              </h3>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.4, marginBottom: 14 }}>
                Arrastra tu PDF aquí o haz click para seleccionar tu archivo de ajedrez local.
              </p>

              <div className="glass-button" style={{ padding: '8px 16px', fontSize: 10, height: 30, borderRadius: 6 }}>
                <FileText style={{ width: 12, height: 12 }} />
                Seleccionar Archivo
              </div>
            </div>

            {/* Classics Selection Section */}
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: 6
              }}>
                <BookOpen style={{ width: 12, height: 12, color: 'var(--accent-color)' }} />
                <span>¿No tienes un libro? Comienza con los clásicos de Roberto Grau</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 10,
                width: '100%',
              }}>
                {CLASSIC_BOOKS.map((book, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadClassicBook(book);
                    }}
                    className="glass-panel"
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-glass)',
                      textAlign: 'left',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'var(--border-glass-glow)';
                      e.currentTarget.style.boxShadow = '0 6px 16px var(--shadow-color)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'var(--border-glass)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'rgba(var(--accent-color-rgb), 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <BookOpen style={{ width: 14, height: 14, color: 'var(--accent-color)' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.title}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {book.subtitle}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
