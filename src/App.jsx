import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, BookOpen, RefreshCw, Trash2 } from 'lucide-react';
import ChessPanel from './components/ChessPanel';
import PdfPanel from './components/PdfPanel';
import SettingsMenu from './components/SettingsMenu';
import logo from './assets/logo.png';
import { getPdfFromDB, savePdfToDB, clearPdfFromDB } from './helpers/pdfStore';

export default function App() {
  /* ========= SETTINGS STATE ========= */
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('chess-study-theme');
    if (saved) return saved;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [layoutInverted, setLayoutInverted] = useState(() => {
    const saved = localStorage.getItem('chess-study-layout-inverted');
    return saved ? JSON.parse(saved) : false;
  });

  const [boardTheme, setBoardTheme] = useState(() =>
    localStorage.getItem('chess-study-board-theme') || 'classic'
  );

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  /* ========= SPLIT SCREEN STATE ========= */
  const [leftWidthPercent, setLeftWidthPercent] = useState(() => {
    const saved = localStorage.getItem('chess-study-left-width');
    return saved ? parseFloat(saved) : 45;
  });
  const [isResizing, setIsResizing] = useState(false);
  const panelsRef = useRef(null);

  /* ========= PDF STATE ========= */
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfReady, setPdfReady] = useState(false);

  useEffect(() => {
    async function loadSavedPdf() {
      const file = await getPdfFromDB();
      if (file) {
        setPdfFile(file);
        setPdfReady(true);
      }
    }
    loadSavedPdf();

    // Register Service Worker for stable PDF URLs and native browser page memory
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registrado para memoria del PDF'))
        .catch((err) => console.error('Error al registrar Service Worker:', err));
    }
  }, []);

  const handleSetPdf = useCallback(async (file) => {
    if (file) {
      setPdfReady(false);
      setPdfFile(file);
      await savePdfToDB(file);
      setPdfReady(true);
    } else {
      setPdfReady(false);
      setPdfFile(null);
      await clearPdfFromDB();
    }
  }, []);

  /* ========= THEME EFFECT ========= */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    localStorage.setItem('chess-study-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('chess-study-layout-inverted', JSON.stringify(layoutInverted));
  }, [layoutInverted]);

  useEffect(() => {
    localStorage.setItem('chess-study-board-theme', boardTheme);
  }, [boardTheme]);

  /* ========= RESIZE LOGIC ========= */
  const handleMouseMove = useCallback((e) => {
    if (!panelsRef.current) return;
    const rect = panelsRef.current.getBoundingClientRect();
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    let pct = ((clientX - rect.left) / rect.width) * 100;
    if (layoutInverted) pct = 100 - pct;
    pct = Math.max(25, Math.min(75, pct));
    setLeftWidthPercent(pct);
    localStorage.setItem('chess-study-left-width', String(pct));
  }, [layoutInverted]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const startResizing = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  /* ========= RESET ========= */
  const handleResetAll = () => {
    setTheme('dark');
    setLayoutInverted(false);
    setBoardTheme('classic');
    setLeftWidthPercent(45);
    localStorage.removeItem('chess-study-theme');
    localStorage.removeItem('chess-study-layout-inverted');
    localStorage.removeItem('chess-study-board-theme');
    localStorage.removeItem('chess-study-left-width');
    localStorage.removeItem('chess-study-pdf-toolbar-visible');
    localStorage.removeItem('chess-study-is-game-mode');
    localStorage.removeItem('chess-study-board-pieces');
    localStorage.removeItem('chess-study-board-orientation');
    localStorage.removeItem('chess-study-fen-history');
    localStorage.removeItem('chess-study-history-index');
    localStorage.removeItem('chess-study-move-list');
    setIsSettingsOpen(false);
  };

  /* ========= RENDER ========= */
  const chessPanelEl = (
    <div
      className="left-panel"
      style={{ width: `${leftWidthPercent}%` }}
    >
      <ChessPanel boardTheme={boardTheme} onOpenSettings={() => setIsSettingsOpen(true)} />
    </div>
  );

  const pdfPanelEl = (
    <div className="right-panel">
      {pdfFile && pdfReady ? (
        <PdfPanel 
          pdfFile={pdfFile} 
          setPdfFile={handleSetPdf} 
        />
      ) : pdfFile ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: 'var(--text-secondary)', background: 'var(--bg-glass)', borderRadius: 12, margin: 10,
          border: '1px solid var(--border-glass)', gap: 12
        }}>
          <div className="pulse-glow" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-color)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Guardando libro en base de datos local...
          </span>
        </div>
      ) : (
        <PdfPanel 
          pdfFile={null} 
          setPdfFile={handleSetPdf} 
        />
      )}
    </div>
  );

  /* ========= VIDEO AUTOMATION HOOK ========= */
  useEffect(() => {
    window.__appControl = {
      setTheme,
      setLayoutInverted,
      setBoardTheme,
      setIsSettingsOpen,
      setLeftWidthPercent,
      loadBook: async () => {
        try {
          const response = await fetch('/books/Tratado_General_de_Ajedrez_Tomo_I_Rudime_crop.pdf');
          const blob = await response.blob();
          const file = new File([blob], 'Tratado_General_de_Ajedrez_Tomo_I_Rudime_crop.pdf', { type: 'application/pdf' });
          
          // Force starting on page 1 (which corresponds to page 80 of the book)
          const key = `chess_study_last_page_${file.name}_${file.size}`;
          localStorage.setItem(key, '1');

          setPdfFile(file);
          setPdfReady(true);
        } catch (e) {
          console.error("Error auto-loading book for video:", e);
        }
      }
    };
  }, [setTheme, setLayoutInverted, setBoardTheme, setIsSettingsOpen, setLeftWidthPercent]);

  useEffect(() => {
    if (window.location.search.includes('video=true')) {
      const autoLoad = async () => {
        try {
          const response = await fetch('/books/Tratado_General_de_Ajedrez_Tomo_I_Rudime_crop.pdf');
          const blob = await response.blob();
          const file = new File([blob], 'Tratado_General_de_Ajedrez_Tomo_I_Rudime_crop.pdf', { type: 'application/pdf' });
          
          const key = `chess_study_last_page_${file.name}_${file.size}`;
          localStorage.setItem(key, '1');

          setPdfFile(file);
          setPdfReady(true);
        } catch (e) {
          console.error("Error auto-loading book on mount for video:", e);
        }
      };
      autoLoad();
    }
  }, []);

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.source === 'hyperframes-video') {
        const { target, action, payload } = e.data;
        
        // 1. Direct hooks routing
        if (target === 'app' && window.__appControl && window.__appControl[action]) {
          window.__appControl[action](payload);
        } else if (target === 'chess' && window.__chessControl && window.__chessControl[action]) {
          window.__chessControl[action](payload);
        } else if (target === 'pdf' && window.__pdfControl && window.__pdfControl[action]) {
          window.__pdfControl[action](payload);
        }
        
        // 2. Custom DOM automation actions
        if (action === 'scrollToPageProgress') {
          const { fromPage, toPage, progress } = payload;
          try {
            const fromP = fromPage || 77;
            const toP = toPage;

            const iframeDoc = document.querySelector('iframe[title="Visualizador PDF"]')?.contentDocument;
            const viewerContainer = iframeDoc?.getElementById('viewerContainer');
            const fromPageEl = iframeDoc?.querySelector(`.page[data-page-number="${fromP}"]`);
            const toPageEl = iframeDoc?.querySelector(`.page[data-page-number="${toP}"]`);
            if (viewerContainer && toPageEl) {
              const startScroll = fromPageEl ? fromPageEl.offsetTop : 0;
              const endScroll = toPageEl.offsetTop;
              viewerContainer.scrollTop = startScroll + (endScroll - startScroll) * progress;
            }
          } catch(err) {}
        } else if (action === 'setBoardGlow') {
          try {
            const boardWrapper = document.querySelector('.chessboard-wrapper');
            if (boardWrapper) {
              boardWrapper.style.boxShadow = `0 0 ${payload * 30}px rgba(59, 130, 246, ${payload * 0.7}), 0 15px 45px var(--shadow-color)`;
              boardWrapper.style.borderColor = `rgba(59, 130, 246, ${payload * 0.6})`;
            }
          } catch(err) {}
        } else if (action === 'resetBoardGlow') {
          try {
            const boardWrapper = document.querySelector('.chessboard-wrapper');
            if (boardWrapper) {
              boardWrapper.style.boxShadow = 'none';
              boardWrapper.style.borderColor = 'var(--border-glass)';
            }
          } catch(err) {}
        } else if (action === 'getDragCoords') {
          try {
            const pawnEl = document.querySelector('div[title="wP"]');
            const squareE4 = document.querySelector('[data-square="e4"]');
            if (pawnEl && squareE4) {
              const pawnRect = pawnEl.getBoundingClientRect();
              const e4Rect = squareE4.getBoundingClientRect();
              window.parent.postMessage({
                source: 'chess-study-app',
                type: 'DRAG_COORDS',
                payload: {
                  startX: pawnRect.left + pawnRect.width / 2,
                  startY: pawnRect.top + pawnRect.height / 2,
                  endX: e4Rect.left + e4Rect.width / 2,
                  endY: e4Rect.top + e4Rect.height / 2,
                  svgHtml: pawnEl.querySelector('svg')?.outerHTML || ''
                }
              }, '*');
            }
          } catch(err) {}
        } else if (action === 'animateSparePiecePress') {
          try {
            const pawnEl = document.querySelector('div[title="wP"]');
            if (pawnEl) {
              pawnEl.style.transition = 'transform 0.15s ease';
              pawnEl.style.transform = 'scale(0.85)';
              setTimeout(() => {
                pawnEl.style.transform = 'scale(1)';
              }, 150);
            }
          } catch(err) {}
        } else if (action === 'landPawnAndFlash') {
          try {
            if (window.__chessControl) {
              const currentPieces = window.__chessControl.boardPieces || {};
              window.__chessControl.setBoardPieces({ ...currentPieces, [payload]: 'wP' });
            }
            // Trigger local flash
            const square = document.querySelector(`[data-square="${payload}"]`);
            if (square) {
              const flash = document.createElement('div');
              flash.style.position = 'absolute';
              flash.style.inset = '0';
              flash.style.backgroundColor = 'rgba(16, 185, 129, 0.65)';
              flash.style.pointerEvents = 'none';
              flash.style.zIndex = '5';
              square.appendChild(flash);
              flash.style.transition = 'opacity 0.8s ease-out';
              setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => flash.remove(), 800);
              }, 50);
            }
          } catch(err) {}
        } else if (action === 'flashSquare') {
          const { square: squareName, color } = payload;
          try {
            const square = document.querySelector(`[data-square="${squareName}"]`);
            if (square) {
              const flash = document.createElement('div');
              flash.style.position = 'absolute';
              flash.style.inset = '0';
              flash.style.backgroundColor = color === 'green' ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)';
              flash.style.pointerEvents = 'none';
              flash.style.zIndex = '5';
              square.appendChild(flash);
              flash.style.transition = 'opacity 0.8s ease-out';
              setTimeout(() => {
                flash.style.opacity = '0';
                setTimeout(() => flash.remove(), 800);
              }, 50);
            }
          } catch(err) {}
        } else if (action === 'animateStartGameButtonPress') {
          try {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('EMPEZAR DESDE ESTA POSICIÓN'));
            if (btn) {
              btn.style.transition = 'transform 0.15s ease';
              btn.style.transform = 'scale(0.93)';
              setTimeout(() => {
                btn.style.transform = '';
                if (window.__chessControl && window.__chessControl.setShowTurnModal) {
                  window.__chessControl.setShowTurnModal(true);
                }
              }, 150);
            }
          } catch(err) {}
        } else if (action === 'animateSelectColorWhitePress') {
          try {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Blancas'));
            if (btn) {
              btn.style.transition = 'transform 0.15s ease';
              btn.style.transform = 'scale(0.93)';
              setTimeout(() => {
                btn.style.transform = '';
                if (window.__chessControl && window.__chessControl.handleSelectStartingColor) {
                  window.__chessControl.handleSelectStartingColor('w');
                }
              }, 150);
            }
          } catch(err) {}
        } else if (action === 'setStartButtonHighlight') {
          try {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('EMPEZAR DESDE ESTA POSICIÓN'));
            if (btn) {
              if (payload) {
                let highlight = btn.querySelector('.btn-press-highlight');
                if (!highlight) {
                  highlight = document.createElement('div');
                  highlight.className = 'btn-press-highlight';
                  highlight.style.position = 'absolute';
                  highlight.style.inset = '-4px';
                  highlight.style.border = '2px solid var(--accent-color)';
                  highlight.style.borderRadius = '8px';
                  highlight.style.pointerEvents = 'none';
                  highlight.style.boxShadow = '0 0 12px var(--accent-color), inset 0 0 8px var(--accent-color)';
                  highlight.style.animation = 'pulse-btn-highlight 0.8s infinite alternate';
                  
                  if (!document.getElementById('pulse-btn-keyframes')) {
                    const style = document.createElement('style');
                    style.id = 'pulse-btn-keyframes';
                    style.innerHTML = `
                      @keyframes pulse-btn-highlight {
                        0% { opacity: 0.4; transform: scale(0.98); }
                        100% { opacity: 1.0; transform: scale(1.02); }
                      }
                    `;
                    document.head.appendChild(style);
                  }
                  btn.appendChild(highlight);
                }
              } else {
                const highlight = btn.querySelector('.btn-press-highlight');
                if (highlight) highlight.remove();
              }
            }
          } catch(err) {}
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className={`app-layout ${isResizing ? 'is-resizing' : ''}`}>
      {/* Settings Drawer */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        layoutInverted={layoutInverted}
        setLayoutInverted={setLayoutInverted}
        boardTheme={boardTheme}
        setBoardTheme={setBoardTheme}
        onResetAll={handleResetAll}
      />

      {/* ===== HEADER ===== */}
      <header
        style={{
          height: 56,
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          flexDirection: layoutInverted ? 'row-reverse' : 'row',
          alignItems: 'center',
          width: '100%',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* Chess Header Column */}
        <div
          style={{
            width: `${leftWidthPercent}%`,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: layoutInverted ? '0 76px 0 24px' : '0 24px',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <div
            className="pulse-glow"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              overflow: 'hidden',
              background: '#ffffff',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
              flexShrink: 0,
            }}
          >
            <img src={logo} alt="Chess Study Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <h1
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.12em',
                lineHeight: 1.1,
                color: 'var(--text-primary)',
                textTransform: 'uppercase',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              CHESS STUDY
            </h1>
            <span
              style={{
                fontSize: 9,
                color: 'var(--text-muted)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'block',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Lector de libros · Tablero de Análisis
            </span>
          </div>
        </div>

        {/* PDF Header Column */}
        <div
          style={{
            width: `${100 - leftWidthPercent}%`,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: layoutInverted ? '0 24px' : '0 76px 0 24px',
            borderLeft: layoutInverted ? 'none' : '1px solid var(--border-glass)',
            borderRight: layoutInverted ? '1px solid var(--border-glass)' : 'none',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {/* Left Group: Book info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', marginRight: 12, flex: 1, minWidth: 0 }}>
            <BookOpen style={{ width: 15, height: 15, color: 'var(--accent-color)', flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', flexShrink: 0 }}>
              Libro:
            </span>
            {pdfFile ? (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  minWidth: 0,
                }}
                title={pdfFile.name}
              >
                {pdfFile.name}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                Ninguno cargado
              </span>
            )}
          </div>

          {/* Right Group: PDF Controls */}
          {pdfFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 'auto' }}>
              {/* Cambiar button */}
              <button
                className="glass-button"
                onClick={() => {
                  const fileInput = document.getElementById('header-pdf-upload');
                  if (fileInput) fileInput.click();
                }}
                style={{ padding: '0 8px', fontSize: 10, color: 'var(--accent-color)', height: 22, borderRadius: 6 }}
                title="Cambiar Libro"
              >
                <RefreshCw style={{ width: 10, height: 10 }} />
              </button>

              {/* Eliminar button */}
              <button
                className="glass-button"
                onClick={() => handleSetPdf(null)}
                style={{ padding: '0 8px', fontSize: 10, color: 'var(--danger-color)', height: 22, borderRadius: 6 }}
                title="Eliminar Libro"
              >
                <Trash2 style={{ width: 10, height: 10 }} />
              </button>
            </div>
          )}

          {/* Hidden input in header for changes */}
          <input
            type="file"
            id="header-pdf-upload"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file && file.type === 'application/pdf') handleSetPdf(file);
              else if (file) alert('Por favor, selecciona un archivo PDF válido.');
            }}
            accept="application/pdf"
            style={{ display: 'none' }}
          />
        </div>

        {/* Configuration button */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="glass-button"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s',
            flexShrink: 0,
            position: 'absolute',
            right: 24,
            top: 10,
            zIndex: 10,
          }}
          title="Configuración"
        >
          <Settings style={{ width: 16, height: 16 }} />
        </button>
      </header>

      {/* ===== PANELS ===== */}
      <div
        ref={panelsRef}
        className="panels-container"
        style={{ flexDirection: layoutInverted ? 'row-reverse' : 'row' }}
      >
        {chessPanelEl}

        <div
          className={`resizer ${isResizing ? 'active' : ''}`}
          onMouseDown={startResizing}
          onTouchStart={startResizing}
        />

        {pdfPanelEl}
      </div>
    </div>
  );
}
