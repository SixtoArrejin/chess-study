import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import {
  Play, Settings2, RotateCcw, Trash2, ArrowLeftRight,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  RefreshCw, AlertCircle
} from 'lucide-react';
import {
  positionObjectToFenPiecePlacement, fenToPositionObject,
  STARTING_POSITION_OBJECT, STARTING_FEN
} from '../helpers/chessHelpers';

/* ===== Board colour presets ===== */
const THEME_COLORS = {
  classic:   { dark: '#769656', light: '#eeeed2' },
  classic_bw: { dark: '#000000', light: '#ffffff' },
  ocean:     { dark: '#4b7399', light: '#eae9d2' },
  wood:      { dark: '#b58863', light: '#f0d9b5' },
  cyberpunk: { dark: '#4a1259', light: '#ff75c3' },
  slate:     { dark: '#374151', light: '#e5e7eb' },
};

export default function ChessPanel({ boardTheme, onOpenSettings }) {
  /* ===== Mode ===== */
  const [isGameMode, setIsGameMode] = useState(false);

  /* ===== Editor state ===== */
  const [boardPieces, setBoardPieces] = useState(STARTING_POSITION_OBJECT);
  const [selectedBrush, setSelectedBrush] = useState(null);
  const [boardOrientation, setBoardOrientation] = useState('white');

  /* ===== Game state ===== */
  const [game, setGame] = useState(null);
  const [fenHistory, setFenHistory] = useState([STARTING_FEN]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [gameStatusText, setGameStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showTurnModal, setShowTurnModal] = useState(false);
  const [moveList, setMoveList] = useState([]);

  const activeColors = THEME_COLORS[boardTheme] || THEME_COLORS.classic;

  /* derived */
  const currentFen = isGameMode && fenHistory[historyIndex] ? fenHistory[historyIndex] : null;
  const currentPieces = isGameMode && currentFen ? fenToPositionObject(currentFen) : boardPieces;

  const chessboardPosition = useMemo(() => {
    const obj = {};
    for (const [sq, piece] of Object.entries(currentPieces)) {
      if (piece) {
        obj[sq] = typeof piece === 'object' ? piece : { pieceType: piece };
      }
    }
    return obj;
  }, [currentPieces]);

  /* ===== Effects ===== */
  useEffect(() => { setErrorMessage(''); if (!isGameMode) setSelectedBrush(null); }, [isGameMode]);

  useEffect(() => {
    if (!isGameMode || !game) return;
    if (game.isGameOver()) {
      if (game.isCheckmate()) {
        const winner = game.turn() === 'w' ? 'Negras' : 'Blancas';
        setGameStatusText(`¡JAQUE MATE! Ganaron las ${winner}`);
      } else if (game.isStalemate()) setGameStatusText('Tablas por ahogado');
      else if (game.isThreefoldRepetition()) setGameStatusText('Tablas por triple repetición');
      else if (game.isInsufficientMaterial()) setGameStatusText('Tablas por material insuficiente');
      else setGameStatusText('Tablas');
    } else {
      const turn = game.turn() === 'w' ? 'Blancas' : 'Negras';
      setGameStatusText(game.inCheck() ? `¡JAQUE! Juegan ${turn}` : `Juegan ${turn}`);
    }
  }, [currentFen, isGameMode, game]);

  /* ===== Handlers ===== */
  const handleSquareClick = useCallback((squareArg) => {
    if (isGameMode) return;
    let square = squareArg;
    if (squareArg && typeof squareArg === 'object') {
      square = squareArg.square;
    }
    if (!square) return;

    if (selectedBrush === 'eraser') {
      const p = { ...boardPieces }; delete p[square]; setBoardPieces(p);
    } else if (selectedBrush) {
      setBoardPieces({ ...boardPieces, [square]: selectedBrush });
    }
  }, [isGameMode, selectedBrush, boardPieces]);

  const handlePieceDrop = useCallback((source, target, pce) => {
    let sourceSquare = source;
    let targetSquare = target;
    let piece = pce;
    if (source && typeof source === 'object') {
      sourceSquare = source.sourceSquare;
      targetSquare = source.targetSquare;
      piece = source.piece;
    }

    if (!isGameMode) {
      if (sourceSquare === targetSquare) return false;
      const p = { ...boardPieces };
      delete p[sourceSquare];
      if (piece) {
        const pieceStr = typeof piece === 'object' ? piece.pieceType || piece.piece : piece;
        p[targetSquare] = pieceStr;
      }
      setBoardPieces(p);
      return true;
    }

    // Game mode
    try {
      const currentFenInHistory = fenHistory[historyIndex];
      const g = new Chess(currentFenInHistory);
      const move = g.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
      if (!move) return false;

      const truncatedHistory = fenHistory.slice(0, historyIndex + 1);
      const truncatedMoveList = moveList.slice(0, historyIndex);

      const newH = [...truncatedHistory, g.fen()];
      const newM = [...truncatedMoveList, move.san];

      setGame(g);
      setFenHistory(newH);
      setHistoryIndex(newH.length - 1);
      setMoveList(newM);
      return true;
    } catch { return false; }
  }, [isGameMode, boardPieces, fenHistory, historyIndex, moveList]);

  const handleStartGameClick = () => {
    setErrorMessage('');
    const pv = Object.values(boardPieces);
    if (!pv.includes('wK') || !pv.includes('bK')) {
      setErrorMessage('Necesitas al menos un Rey Blanco (♔) y un Rey Negro (♚) en el tablero.');
      return;
    }
    setShowTurnModal(true);
  };

  const handleSelectStartingColor = (color) => {
    setShowTurnModal(false);
    const pp = positionObjectToFenPiecePlacement(boardPieces);
    let tempGame = null, initialFen = '';
    try {
      initialFen = `${pp} ${color} KQkq - 0 1`;
      tempGame = new Chess(initialFen);
    } catch {
      try {
        initialFen = `${pp} ${color} - - 0 1`;
        tempGame = new Chess(initialFen);
      } catch (err) {
        setErrorMessage(`Posición no válida: ${err.message}`); return;
      }
    }
    if (tempGame) {
      setGame(tempGame); setFenHistory([initialFen]); setHistoryIndex(0);
      setMoveList([]); setIsGameMode(true);
    }
  };

  const navigateTo = useCallback((idx) => {
    if (!isGameMode || !game) return;
    const i = Math.max(0, Math.min(fenHistory.length - 1, idx));
    setHistoryIndex(i); game.load(fenHistory[i]);
  }, [isGameMode, game, fenHistory]);

  const handleRevertToEditor = () => {
    setBoardPieces(fenToPositionObject(fenHistory[historyIndex]));
    setIsGameMode(false);
  };

  const SPARE_PIECES_WHITE = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP'];
  const SPARE_PIECES_BLACK = ['bK', 'bQ', 'bR', 'bB', 'bN', 'bP'];

  const handleSparePieceClick = (pieceType) => {
    if (isGameMode) return;
    setSelectedBrush(selectedBrush === pieceType ? null : pieceType);
  };

  const renderSparePieceColumn = (piecesList, colorName) => {
    return (
      <div className="glass-panel animate-fade-in" style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 6,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {piecesList.map((pt) => {
          const isActive = selectedBrush === pt;
          return (
            <div
              key={pt}
              onClick={() => handleSparePieceClick(pt)}
              style={{
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: isActive ? '2px solid var(--accent-color)' : '1px solid transparent',
                background: isActive ? 'rgba(var(--accent-color-rgb), 0.12)' : 'transparent',
                cursor: 'grab',
                transition: 'all 0.15s',
                transform: isActive ? 'scale(1.08)' : 'scale(1)',
                boxShadow: isActive ? '0 0 8px rgba(var(--accent-color-rgb), 0.25)' : 'none',
              }}
              title={pt}
            >
              <div style={{ width: 32, height: 32 }}>
                <SparePiece pieceType={pt} />
              </div>
            </div>
          );
        })}
        {colorName === 'white' && (
          <button
            className={`glass-button ${selectedBrush === 'eraser' ? 'active' : ''}`}
            onClick={() => setSelectedBrush(selectedBrush === 'eraser' ? null : 'eraser')}
            style={{
              width: 38,
              height: 38,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              border: selectedBrush === 'eraser' ? '2px solid var(--danger-color)' : '1px solid var(--border-glass)',
              background: selectedBrush === 'eraser' ? 'var(--danger-color)' : 'transparent',
              color: selectedBrush === 'eraser' ? '#fff' : 'var(--danger-color)',
            }}
            title="Borrador"
          >
            <Trash2 style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>
    );
  };

  /* ===== Styles ===== */
  const sectionStyle = { display: 'flex', flexDirection: 'column', gap: 12 };
  const modeLabel = {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  };
  const modeDot = {
    width: 8, height: 8, borderRadius: '50%',
    background: isGameMode ? 'var(--success-color)' : 'var(--accent-color)',
  };

  const chessboardOptions = useMemo(() => ({
    position: chessboardPosition,
    onPieceDrop: handlePieceDrop,
    onSquareClick: handleSquareClick,
    boardOrientation: boardOrientation,
    showNotation: true,
    darkSquareStyle: { backgroundColor: activeColors.dark },
    lightSquareStyle: { backgroundColor: activeColors.light },
    boardStyle: { borderRadius: 8, overflow: 'hidden', boxShadow: 'none' }
  }), [chessboardPosition, handlePieceDrop, handleSquareClick, boardOrientation, activeColors]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 16,
      gap: 14,
      overflow: 'hidden',
    }}>

      {/* ===== Turn Modal ===== */}
      {showTurnModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
        }}>
          <div className="glass-panel glass-panel-active animate-fade-in"
            style={{ padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
              ¿Quién juega primero?
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Selecciona el bando que realizará el próximo movimiento.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="glass-button" onClick={() => handleSelectStartingColor('w')}
                style={{ padding: '12px 0' }}>⚪ Blancas</button>
              <button className="glass-button" onClick={() => handleSelectStartingColor('b')}
                style={{ padding: '12px 0' }}>⚫ Negras</button>
            </div>
            <button onClick={() => setShowTurnModal(false)}
              style={{ marginTop: 16, fontSize: 10, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ===== Mode label + settings ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={modeLabel}>
          <div style={modeDot} />
          {isGameMode ? 'MODO JUEGO Y ANÁLISIS' : 'MODO LIBRE: EDITOR DE TABLERO'}
        </div>
        <button onClick={onOpenSettings}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, borderRadius: 6,
          }}>
          <Settings2 style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* ===== Board & Side Columns (Editor) or Sidebar moves (Game) ===== */}
      <ChessboardProvider options={chessboardOptions}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          gap: 12,
          flex: '1 1 auto',
          minHeight: 0,
        }}>
          {/* Left Column (Editor: White pieces, Game: Move notation column) */}
          {isGameMode ? (
            <div className="glass-panel animate-fade-in" style={{
              width: 120,
              display: 'flex',
              flexDirection: 'column',
              padding: '10px 8px',
              flexShrink: 0,
              height: '100%',
              maxHeight: 'min(800px, calc(100vh - 180px))',
            }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, borderBottom: '1px solid var(--border-glass)', paddingBottom: 4, textAlign: 'center' }}>
                Notación
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                overflowY: 'auto',
                flex: 1,
                paddingRight: 2,
              }}>
                {moveList.length === 0 ? (
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                    Sin jugadas
                  </div>
                ) : (
                  Array.from({ length: Math.ceil(moveList.length / 2) }).map((_, i) => {
                    const wi = i * 2, bi = i * 2 + 1;
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 1fr', gap: 2, fontSize: 9, padding: '2px 0' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}.</span>
                        <span
                          onClick={() => navigateTo(wi + 1)}
                          style={{
                            cursor: 'pointer',
                            fontWeight: historyIndex === wi + 1 ? 700 : 400,
                            color: historyIndex === wi + 1 ? 'var(--accent-color)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >{moveList[wi]}</span>
                        <span
                          onClick={() => navigateTo(bi + 1)}
                          style={{
                            cursor: 'pointer',
                            fontWeight: historyIndex === bi + 1 ? 700 : 400,
                            color: historyIndex === bi + 1 ? 'var(--accent-color)' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >{moveList[bi] || ''}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            renderSparePieceColumn(SPARE_PIECES_WHITE, 'white')
          )}

          {/* Board */}
          <div className="chessboard-wrapper" style={{
            maxWidth: 'min(800px, calc(100% - 160px), calc(100vh - 180px))'
          }}>
            <Chessboard {...chessboardOptions} />
          </div>

          {/* Right Column: Black pieces (Editor mode only) */}
          {!isGameMode && renderSparePieceColumn(SPARE_PIECES_BLACK, 'black')}
        </div>
      </ChessboardProvider>

      {/* ===== Bottom Controls (Editor Mode) ===== */}
      {!isGameMode && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {/* Error message (editor) */}
          {errorMessage && (
            <div className="glass-panel"
              style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger-color)', flexShrink: 0 }}>
              <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />
              <span style={{ fontSize: 9, lineHeight: 1.2 }}>{errorMessage}</span>
            </div>
          )}

          {/* Quick actions row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            width: '100%',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button className="glass-button" onClick={() => setBoardPieces(STARTING_POSITION_OBJECT)}
                style={{ width: 32, height: 32, padding: 0 }} title="Posición Inicial">
                <RotateCcw style={{ width: 13, height: 13 }} />
              </button>
              <button className="glass-button" onClick={() => setBoardPieces({})}
                style={{ width: 32, height: 32, padding: 0, color: 'var(--danger-color)' }} title="Limpiar Tablero">
                <Trash2 style={{ width: 13, height: 13 }} />
              </button>
              <button className="glass-button"
                onClick={() => setBoardOrientation(boardOrientation === 'white' ? 'black' : 'white')}
                style={{ width: 32, height: 32, padding: 0 }} title="Girar Tablero">
                <ArrowLeftRight style={{ width: 13, height: 13 }} />
              </button>
            </div>

            <button className="glass-button active" onClick={handleStartGameClick}
              style={{
                flex: 1,
                height: 32,
                padding: '0 12px',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.04em',
                justifyContent: 'center',
                gap: 5,
                display: 'inline-flex',
                alignItems: 'center',
              }}>
              <Play style={{ width: 10, height: 10, fill: 'currentColor', transform: 'translateY(0.5px)' }} />
              <span>EMPEZAR DESDE ESTA POSICIÓN</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== Bottom Controls (Game Mode) ===== */}
      {isGameMode && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          width: '100%',
          flexShrink: 0
        }}>
          {/* Status info */}
          <div className="glass-panel" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 10px',
            height: 32,
            fontSize: 9,
            fontWeight: 700,
            flex: '1 1 auto',
            minWidth: 0,
          }}>
            <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {gameStatusText}
            </span>
            <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0, fontSize: 8 }}>
              {moveList.length} movs
            </span>
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button className="glass-button" disabled={historyIndex === 0}
              onClick={() => navigateTo(0)} title="Inicio" style={{ width: 32, height: 32, padding: 0 }}>
              <ChevronsLeft style={{ width: 13, height: 13 }} />
            </button>
            <button className="glass-button" disabled={historyIndex === 0}
              onClick={() => navigateTo(historyIndex - 1)} title="Anterior" style={{ width: 32, height: 32, padding: 0 }}>
              <ChevronLeft style={{ width: 13, height: 13 }} />
            </button>
            <button className="glass-button" disabled={historyIndex === fenHistory.length - 1}
              onClick={() => navigateTo(historyIndex + 1)} title="Siguiente" style={{ width: 32, height: 32, padding: 0 }}>
              <ChevronRight style={{ width: 13, height: 13 }} />
            </button>
            <button className="glass-button" disabled={historyIndex === fenHistory.length - 1}
              onClick={() => navigateTo(fenHistory.length - 1)} title="Final" style={{ width: 32, height: 32, padding: 0 }}>
              <ChevronsRight style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Volver button */}
          <button className="glass-button" onClick={handleRevertToEditor}
            style={{ height: 32, padding: '0 10px', fontSize: 9, fontWeight: 700, color: 'var(--accent-color)', gap: 4, flexShrink: 0 }}>
            <RefreshCw style={{ width: 10, height: 10 }} />
            <span>Editar</span>
          </button>
        </div>
      )}
    </div>
  );
}
