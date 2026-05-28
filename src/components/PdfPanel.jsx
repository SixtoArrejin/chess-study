import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Upload, FileText, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';

// Safe, race-free dynamic script loader for PDF.js CDN
let pdfjsLoadingPromise = null;
function loadPdfJS() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsLoadingPromise) return pdfjsLoadingPromise;

  pdfjsLoadingPromise = new Promise((resolve, reject) => {
    // Inject PDF.js stylesheet for text selection support
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    script.onerror = (err) => {
      pdfjsLoadingPromise = null;
      reject(err);
    };
    document.body.appendChild(script);
  });
  return pdfjsLoadingPromise;
}

// Sub-component to render a single PDF page on demand (lazy loading) with canvas and Text Layer for text selection
function PdfPage({ pdfDoc, pageNum, dimensions, isVisible }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsRendered(false);
      return;
    }

    let active = true;

    async function drawPage() {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (!active || !canvasRef.current || !textLayerRef.current) return;

        const canvas = canvasRef.current;
        const textLayerDiv = textLayerRef.current;
        const context = canvas.getContext('2d');

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const dpr = window.devicePixelRatio || 1;
        const originalViewport = page.getViewport({ scale: 1 });
        
        // Calculate the scale to match the target dimensions exactly
        const scale = dimensions.width / originalViewport.width;
        const viewport = page.getViewport({ scale });

        // Size the canvas for high DPI displays
        canvas.width = viewport.width * dpr;
        canvas.height = viewport.height * dpr;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: [dpr, 0, 0, dpr, 0, 0]
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        
        if (!active) return;
        
        // Render Text Layer on top of canvas for copy-paste selection
        textLayerDiv.innerHTML = '';
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        
        if (!active) return;

        window.pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
          textDivs: []
        });

        setIsRendered(true);
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageNum}:`, err);
        }
      }
    }

    drawPage();

    return () => {
      active = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, pageNum, dimensions, isVisible]);

  return (
    <div
      className="pdf-page-placeholder"
      data-page-number={pageNum}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        position: 'relative',
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        borderRadius: 4,
        background: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          borderRadius: 4,
          display: isRendered ? 'block' : 'none'
        }}
      />
      
      {/* Interactive Text Selection Layer overlay */}
      <div
        ref={textLayerRef}
        className="textLayer"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          borderRadius: 4,
          zIndex: 2,
          pointerEvents: 'auto',
        }}
      />

      {!isRendered && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          color: 'var(--text-muted)'
        }}>
          <div className="pulse-glow" style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-color)' }} />
          <span style={{ fontSize: 9, fontWeight: 600 }}>Cargando página {pageNum}...</span>
        </div>
      )}
    </div>
  );
}

export default function PdfPanel({ pdfFile, setPdfFile }) {
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);
  
  // Callback ref mechanism to attach ResizeObserver reliably even on conditional mounts
  const resizeObserverRef = useRef(null);
  const viewportElementRef = useRef(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [tempPageInput, setTempPageInput] = useState('1');

  // Fit and Zoom states: start fitted vertically ('height') by default
  const [fitMode, setFitMode] = useState('height');
  const [zoomScale, setZoomScale] = useState(1.0);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Track the size of the panel dynamically using ResizeObserver
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [pageAspectRatio, setPageAspectRatio] = useState(0.707); // standard A4 ratio fallback
  const [visiblePages, setVisiblePages] = useState(new Set([1]));

  const localStorageKey = useMemo(() => {
    if (!pdfFile) return '';
    return `chess_study_last_page_${pdfFile.name}_${pdfFile.size}`;
  }, [pdfFile]);

  const viewportRef = useCallback((node) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    if (node !== null) {
      viewportElementRef.current = node;
      
      // Set initial dimensions immediately so there's no layout delay
      setContainerSize({
        width: node.clientWidth,
        height: node.clientHeight
      });

      const observer = new ResizeObserver((entries) => {
        if (!entries || !entries.length) return;
        const entry = entries[0];
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      });
      observer.observe(node);
      resizeObserverRef.current = observer;
    } else {
      viewportElementRef.current = null;
    }
  }, []);

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

  // Scroll smoothly to a specific page
  const scrollToPage = (pageNum) => {
    if (!viewportElementRef.current || !pdfDoc) return;
    const target = Math.max(1, Math.min(numPages, pageNum));
    const element = viewportElementRef.current.querySelector(`.pdf-page-placeholder[data-page-number="${target}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCurrentPage(target);
      localStorage.setItem(localStorageKey, String(target));
    }
  };

  // Handle keyboard page flipping (ArrowLeft & ArrowRight)
  useEffect(() => {
    if (!pdfDoc) return;

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
  }, [pdfDoc, currentPage, numPages, localStorageKey]);

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

  // Bootstrap PDFJS script loading & open IndexedDB PDF file
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

          // Find the true aspect ratio of the first page to size our lazy loading divs correctly
          const pageOne = await doc.getPage(1);
          const viewportOne = pageOne.getViewport({ scale: 1 });
          setPageAspectRatio(viewportOne.width / viewportOne.height);

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
  }, [pdfFile]);

  // One-time restore scroll position on reload/load
  useEffect(() => {
    if (pdfDoc && numPages > 0) {
      const timer = setTimeout(() => {
        const savedPage = localStorage.getItem(localStorageKey);
        if (savedPage) {
          const parsed = parseInt(savedPage, 10);
          if (parsed >= 1 && parsed <= numPages) {
            scrollToPage(parsed);
          }
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pdfDoc, numPages, localStorageKey]);

  // Calculate dynamic dimensions for pages based on container size, fit mode, and zoom level
  const pageDimensions = useMemo(() => {
    if (containerSize.width === 0 || containerSize.height === 0) {
      return { width: 450, height: 450 / pageAspectRatio };
    }

    let width = 0;
    let height = 0;

    if (fitMode === 'height') {
      height = containerSize.height - 32; // Fit vertically
      width = height * pageAspectRatio;
    } else if (fitMode === 'width') {
      width = containerSize.width - 32; // Fit horizontally
      height = width / pageAspectRatio;
    } else {
      // Custom zoom scale relative to fit width
      width = (containerSize.width - 32) * zoomScale;
      height = width / pageAspectRatio;
    }

    return { width, height };
  }, [containerSize, pageAspectRatio, fitMode, zoomScale]);

  // High performance IntersectionObserver to track visible pages and update scroll sync page indicator
  useEffect(() => {
    if (!pdfDoc || numPages === 0 || !viewportElementRef.current) return;

    const observer = new IntersectionObserver((entries) => {
      setVisiblePages((prev) => {
        const next = new Set(prev);
        entries.forEach((entry) => {
          const pageNum = parseInt(entry.target.getAttribute('data-page-number'), 10);
          if (entry.isIntersecting) {
            next.add(pageNum);
          } else {
            next.delete(pageNum);
          }
        });

        // Determine which page is closest to the top of the viewport and mark it as the current active page
        const container = viewportElementRef.current;
        if (container) {
          const placeholders = container.querySelectorAll('.pdf-page-placeholder');
          let closestPage = null;
          let closestDist = Infinity;

          placeholders.forEach((placeholder) => {
            const pageNum = parseInt(placeholder.getAttribute('data-page-number'), 10);
            if (next.has(pageNum)) {
              const rect = placeholder.getBoundingClientRect();
              const containerRect = container.getBoundingClientRect();
              const dist = Math.abs(rect.top - containerRect.top);
              if (dist < closestDist) {
                closestDist = dist;
                closestPage = pageNum;
              }
            }
          });

          if (closestPage && closestPage !== currentPage) {
            setCurrentPage(closestPage);
            localStorage.setItem(localStorageKey, String(closestPage));
          }
        }

        return next;
      });
    }, {
      root: viewportElementRef.current,
      rootMargin: '250px 0px 250px 0px', // preload pages 250px before entering viewport for a super smooth scroll experience
      threshold: 0.1
    });

    const placeholders = viewportElementRef.current.querySelectorAll('.pdf-page-placeholder');
    placeholders.forEach(el => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [pdfDoc, numPages, pageDimensions, containerSize.width, containerSize.height]);

  // Adjust zoom scales smoothly when clicking zoom in/out buttons
  const handleZoomIn = () => {
    const refWidth = Math.max(100, containerSize.width - 32);
    if (fitMode !== 'custom') {
      const currentWidth = pageDimensions.width;
      setZoomScale(currentWidth / refWidth + 0.2);
      setFitMode('custom');
    } else {
      setZoomScale(prev => Math.min(3.0, prev + 0.2));
    }
  };

  const handleZoomOut = () => {
    const refWidth = Math.max(100, containerSize.width - 32);
    if (fitMode !== 'custom') {
      const currentWidth = pageDimensions.width;
      setZoomScale(Math.max(0.3, currentWidth / refWidth - 0.2));
      setFitMode('custom');
    } else {
      setZoomScale(prev => Math.max(0.3, prev - 0.2));
    }
  };

  const referenceWidth = Math.max(100, containerSize.width - 32);
  const zoomPercentage = Math.round((pageDimensions.width / referenceWidth) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
      {/* Custom styled CSS overlay to style text layers and selection highlight color to match the HSL glass theme */}
      <style dangerouslySetInnerHTML={{ __html: `
        .textLayer {
          position: absolute;
          left: 0;
          top: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          opacity: 1;
          line-height: 1.0;
        }
        .textLayer > span {
          color: transparent;
          position: absolute;
          white-space: pre;
          cursor: text;
          transform-origin: 0% 0%;
        }
        .textLayer ::selection {
          background: rgba(var(--accent-color-rgb), 0.35) !important;
          color: transparent;
        }
      ` }} />

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  className={`glass-button ${fitMode === 'height' ? 'active' : ''}`}
                  onClick={() => setFitMode('height')}
                  style={{ padding: '0 10px', height: 26, borderRadius: 6, fontSize: 10 }}
                  title="Ajustar al Alto de la Pantalla"
                >
                  Alto
                </button>
                <button
                  className={`glass-button ${fitMode === 'width' ? 'active' : ''}`}
                  onClick={() => setFitMode('width')}
                  style={{ padding: '0 10px', height: 26, borderRadius: 6, fontSize: 10 }}
                  title="Ajustar al Ancho de la Pantalla"
                >
                  Ancho
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

            {/* Canvas Scrollable Viewport */}
            <div
              ref={viewportRef}
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.15)',
                padding: 16,
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
                  padding: 32, textAlign: 'center', color: 'var(--danger-color)', gap: 12
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600 }}>{loadError}</p>
                </div>
              ) : (
                pdfDoc && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <PdfPage
                    key={pageNum}
                    pdfDoc={pdfDoc}
                    pageNum={pageNum}
                    dimensions={pageDimensions}
                    isVisible={visiblePages.has(pageNum)}
                  />
                ))
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
