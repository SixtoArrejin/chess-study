import React from 'react';
import { Trash2 } from 'lucide-react';

const PIECES = {
  w: [
    { id: 'wK', char: '♔', label: 'Rey' },
    { id: 'wQ', char: '♕', label: 'Dama' },
    { id: 'wR', char: '♖', label: 'Torre' },
    { id: 'wB', char: '♗', label: 'Alfil' },
    { id: 'wN', char: '♘', label: 'Caballo' },
    { id: 'wP', char: '♙', label: 'Peón' },
  ],
  b: [
    { id: 'bK', char: '♚', label: 'Rey' },
    { id: 'bQ', char: '♛', label: 'Dama' },
    { id: 'bR', char: '♜', label: 'Torre' },
    { id: 'bB', char: '♝', label: 'Alfil' },
    { id: 'bN', char: '♞', label: 'Caballo' },
    { id: 'bP', char: '♟', label: 'Peón' },
  ],
};

function PieceButton({ piece, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 40,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        border: isActive ? '2px solid var(--accent-color)' : '1px solid var(--border-glass)',
        borderRadius: 6,
        background: isActive ? 'rgba(var(--accent-color-rgb), 0.12)' : 'transparent',
        cursor: 'pointer',
        transition: 'all 0.15s',
        transform: isActive ? 'scale(1.08)' : 'scale(1)',
        boxShadow: isActive ? '0 0 10px rgba(var(--accent-color-rgb), 0.25)' : 'none',
        userSelect: 'none',
      }}
      title={piece.label}
    >
      {piece.char}
    </button>
  );
}

export default function PiecePalette({ selectedBrush, setSelectedBrush }) {
  const toggle = (id) => setSelectedBrush(selectedBrush === id ? null : id);

  const groupStyle = {
    display: 'flex', flexDirection: 'column', gap: 6, flex: 1,
  };
  const labelStyle = {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.12em', color: 'var(--text-muted)', textAlign: 'center',
  };
  const gridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4,
    justifyItems: 'center',
  };

  return (
    <div className="glass-panel" style={{ padding: 12 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-glass)', paddingBottom: 8, marginBottom: 10,
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Paleta de Piezas
        </span>
        <button
          className={`glass-button ${selectedBrush === 'eraser' ? 'active' : ''}`}
          onClick={() => toggle('eraser')}
          style={{
            padding: '4px 10px', fontSize: 10,
            ...(selectedBrush === 'eraser' ? { background: 'var(--danger-color)' } : {})
          }}
        >
          <Trash2 style={{ width: 12, height: 12 }} />
          Borrador
        </button>
      </div>

      {/* Pieces */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={groupStyle}>
          <span style={labelStyle}>Blancas</span>
          <div style={gridStyle}>
            {PIECES.w.map((p) => (
              <PieceButton key={p.id} piece={p} isActive={selectedBrush === p.id} onClick={() => toggle(p.id)} />
            ))}
          </div>
        </div>
        <div style={groupStyle}>
          <span style={labelStyle}>Negras</span>
          <div style={gridStyle}>
            {PIECES.b.map((p) => (
              <PieceButton key={p.id} piece={p} isActive={selectedBrush === p.id} onClick={() => toggle(p.id)} />
            ))}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10, fontStyle: 'italic', lineHeight: 1.5 }}>
        Selecciona una pieza y haz click en el tablero para colocarla.
      </p>
    </div>
  );
}
