import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

// Safe, race-free dynamic script loader for PDF.js CDN
let pdfjsLoadingPromise = null;
function loadPdfJS() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = (err) => {
      pdfjsLoadingPromise = null; // Reset to allow retry
      reject(err);
    };
    document.body.appendChild(script);
  });
  return pdfjsLoadingPromise;
}

export default function PdfPanel({ pdfFile, setPdfFile }) {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.25);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [tempPageInput, setTempPageInput] = useState('1');

  // Book-specific localStorage key to prevent page overlap between different books
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

  // Safe page navigation
  const goToPage = (num) => {
    if (!pdfDoc) return;
    const target = Math.max(1, Math.min(numPages, num));
    setCurrentPage(target);
    localStorage.setItem(localStorageKey, String(target));
  };

  // Sync temp page input with page transitions
  useEffect(() => {
    setTempPageInput(String(currentPage));
  }, [currentPage]);

  const handlePageInputBlur = () => {
    const parsed = parseInt(tempPageInput, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= numPages) {
      goToPage(parsed);
    } else {
      setTempPageInput(String(currentPage));
    }
  };

  const handlePageInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  // Effect 1: Load/Bootstrap PDF.js script and document from IndexedDB Blob/File
  useEffect(() => {
    if (!pdfFile) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let active = true;
    setIsLoading(true);
    setLoadError(null);

    loadPdfJS().then((pdfjs) => {
      if (!active) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!active) return;
        try {
          const typedarray = new Uint8Array(e.target.result);
          const loadingTask = pdfjs.getDocument({
            data: typedarray,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
            cMapPacked: true,
          });
          const doc = await loadingTask.promise;
          if (!active) return;

          setPdfDoc(doc);
          setNumPages(doc.numPages);

          // Retrieve saved page from localStorage
          const savedPage = localStorage.getItem(localStorageKey);
          let pageNum = 1;
          if (savedPage) {
            const parsed = parseInt(savedPage, 10);
            if (parsed >= 1 && parsed <= doc.numPages) {
              pageNum = parsed;
            }
          }
          setCurrentPage(pageNum);
          setIsLoading(false);
        } catch (err) {
          console.error('Error loading PDF document:', err);
          if (active) {
            setLoadError('Error al procesar el PDF. Asegúrate de que es un archivo válido.');
            setIsLoading(false);
          }
        }
      };
      reader.onerror = () => {
        if (active) {
          setLoadError('Error al leer el archivo PDF.');
          setIsLoading(false);
        }
      };
      reader.readAsArrayBuffer(pdfFile);
    }).catch((err) => {
      console.error('Error loading PDFJS script:', err);
      if (active) {
        setLoadError('Error al cargar el motor de visualización PDF.');
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [pdfFile, localStorageKey]);

  // Effect 2: Render single PDF page to Canvas with DPI scale support and task cancellation
  useEffect(() => {
    if (!pdfDoc) return;

    let active = true;
    setIsRendering(true);

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (!active || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        // Cancel the current rendering task if it's already active
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const dpr = window.devicePixelRatio || 1;
        const originalViewport = page.getViewport({ scale: zoomScale });

        canvas.width = originalViewport.width * dpr;
        canvas.height = originalViewport.height * dpr;
        canvas.style.width = `${originalViewport.width}px`;
        canvas.style.height = `${originalViewport.height}px`;

        const renderContext = {
          canvasContext: context,
          viewport: originalViewport,
          transform: [dpr, 0, 0, dpr, 0, 0] // adjust for crisp retina displays
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        if (active) {
          renderTaskRef.current = null;
          setIsRendering(false);
        }
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
          if (active) {
            setIsRendering(false);
          }
        }
      }
    }

    renderPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, zoomScale]);

  // Effect 3: Keyboard navigation listener for ArrowLeft and ArrowRight
  useEffect(() => {
    if (!pdfDoc) return;

    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
        return;
      }
      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfDoc, currentPage, numPages, localStorageKey]);

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
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || isLoading || isRendering}
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
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= numPages || isLoading || isRendering}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Página Siguiente (Flecha Derecha)"
                >
                  <ChevronRight style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Zoom controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  className="glass-button"
                  onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.25))}
                  disabled={isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Reducir Zoom"
                >
                  <Minus style={{ width: 12, height: 12 }} />
                </button>
                
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', minWidth: 38, textAlign: 'center' }}>
                  {Math.round(zoomScale * 100)}%
                </span>

                <button
                  className="glass-button"
                  onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.25))}
                  disabled={isLoading}
                  style={{ padding: '0 8px', height: 26, borderRadius: 6 }}
                  title="Aumentar Zoom"
                >
                  <Plus style={{ width: 12, height: 12 }} />
                </button>
              </div>
            </div>

            {/* Canvas Viewport */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              background: 'rgba(0, 0, 0, 0.15)',
              padding: 16,
              position: 'relative',
            }}>
              {(isLoading || isRendering) && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0, 0, 0, 0.35)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 10,
                  backdropFilter: 'blur(3px)',
                }}>
                  <div className="pulse-glow" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-color)' }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {isLoading ? 'Cargando libro...' : 'Renderizando página...'}
                  </span>
                </div>
              )}

              {loadError ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: 32, textAlign: 'center', color: 'var(--danger-color)', gap: 12
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{loadError}</p>
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  style={{
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    borderRadius: 4,
                    background: '#ffffff',
                  }}
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
              Navegación, zoom y búsqueda de texto incluidos de forma nativa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
