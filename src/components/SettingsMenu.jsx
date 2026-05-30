import React from 'react';
import { X, Sun, Moon, LayoutGrid, Palette, RotateCcw, BookOpen } from 'lucide-react';

const BOARD_THEMES = [
  { id: 'classic', name: 'Esmeralda', dark: '#769656', light: '#eeeed2' },
  { id: 'classic_bw', name: 'Clásico B&N', dark: '#3b3b3b', light: '#ffffff' },
  { id: 'ocean', name: 'Océano', dark: '#4b7399', light: '#eae9d2' },
  { id: 'wood', name: 'Madera', dark: '#b58863', light: '#f0d9b5' },
  { id: 'cyberpunk', name: 'Cyberpunk', dark: '#4a1259', light: '#ff75c3' },
  { id: 'slate', name: 'Pizarra', dark: '#374151', light: '#e5e7eb' },
];

export default function SettingsMenu({
  isOpen, onClose, theme, setTheme,
  layoutInverted, setLayoutInverted,
  boardTheme, setBoardTheme, onResetAll,
}) {
  if (!isOpen) return null;

  const sectionTitle = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 10,
  };
  const iconSm = { width: 13, height: 13 };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: 360, maxWidth: '90vw', height: '100%',
          background: 'var(--bg-glass-active)',
          borderLeft: '1px solid var(--border-glass)',
          display: 'flex', flexDirection: 'column',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--border-glass)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Palette style={{ width: 17, height: 17, color: 'var(--accent-color)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>AJUSTES VISUALES</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4, borderRadius: 4,
          }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Theme */}
          <div>
            <div style={sectionTitle}><Sun style={iconSm} /> Tema</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className={`glass-button ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')} style={{ padding: '10px 0', fontSize: 11 }}>
                <Sun style={{ width: 14, height: 14 }} /> Claro
              </button>
              <button className={`glass-button ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')} style={{ padding: '10px 0', fontSize: 11 }}>
                <Moon style={{ width: 14, height: 14 }} /> Oscuro
              </button>
            </div>
          </div>

          {/* Layout */}
          <div>
            <div style={sectionTitle}><LayoutGrid style={iconSm} /> Distribución</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className={`glass-button ${!layoutInverted ? 'active' : ''}`}
                onClick={() => setLayoutInverted(false)}
                style={{ padding: '10px 8px', fontSize: 10, whiteSpace: 'normal', lineHeight: 1.3 }}>
                Tablero | PDF
              </button>
              <button className={`glass-button ${layoutInverted ? 'active' : ''}`}
                onClick={() => setLayoutInverted(true)}
                style={{ padding: '10px 8px', fontSize: 10, whiteSpace: 'normal', lineHeight: 1.3 }}>
                PDF | Tablero
              </button>
            </div>
          </div>

          {/* Board Colours */}
          <div>
            <div style={sectionTitle}><Palette style={iconSm} /> Color del Tablero</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BOARD_THEMES.map((b) => (
                <button key={b.id}
                  className={`glass-button ${boardTheme === b.id ? 'active' : ''}`}
                  onClick={() => setBoardTheme(b.id)}
                  style={{ justifyContent: 'flex-start', gap: 12, padding: '10px 14px', width: '100%' }}>
                  <div style={{
                    display: 'flex', width: 36, height: 20, borderRadius: 4, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0,
                  }}>
                    <div style={{ width: '50%', height: '100%', background: b.light }} />
                    <div style={{ width: '50%', height: '100%', background: b.dark }} />
                  </div>
                  <span style={{ fontSize: 11 }}>{b.name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-glass)' }}>
          <button className="glass-button" onClick={() => { if (confirm('¿Restaurar ajustes predeterminados?')) onResetAll(); }}
            style={{ width: '100%', padding: '10px 0', fontSize: 11, color: 'var(--danger-color)' }}>
            <RotateCcw style={{ width: 14, height: 14 }} />
            Restaurar Ajustes
          </button>
        </div>
      </div>
    </div>
  );
}
