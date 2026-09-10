import { useRef } from 'react';
import { X, Sun, Moon, LayoutGrid, Palette, RotateCcw, Volume2, VolumeX, Settings, BookOpen, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import soundManager from '../helpers/soundHelper';
import logo from '../assets/logo.png';

const BOARD_THEMES = [
  { id: 'classic', name: 'Esmeralda', dark: '#769656', light: '#eeeed2' },
  { id: 'classic_bw', name: 'Clásico B&N', dark: '#3b3b3b', light: '#ffffff' },
  { id: 'ocean', name: 'Océano', dark: '#4b7399', light: '#eae9d2' },
  { id: 'wood', name: 'Madera', dark: '#b58863', light: '#f0d9b5' },
  { id: 'cyberpunk', name: 'Cyberpunk', dark: '#4a1259', light: '#ff75c3' },
  { id: 'slate', name: 'Pizarra', dark: '#374151', light: '#e5e7eb' },
];

function SwitchRow({ icon: Icon, iconColor, title, subtitle, checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      className="glass-panel"
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        cursor: 'pointer',
        userSelect: 'none',
        borderRadius: 10,
        transition: 'all 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: checked ? 'rgba(var(--accent-color-rgb), 0.15)' : 'rgba(120, 120, 128, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background-color 0.2s',
          flexShrink: 0,
        }}>
          {Icon && (
            <Icon style={{
              width: 16,
              height: 16,
              color: iconColor || (checked ? 'var(--accent-color)' : 'var(--text-muted)'),
              transition: 'color 0.2s'
            }} />
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Switch pill */}
      <div
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? 'var(--accent-color)' : 'rgba(120, 120, 128, 0.25)',
          border: '1px solid var(--border-glass)',
          padding: 2,
          display: 'flex',
          alignItems: 'center',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: checked ? '0 0 12px rgba(var(--accent-color-rgb), 0.35)' : 'none',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.28)',
            transform: checked ? 'translateX(20px)' : 'translateX(0px)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>
    </div>
  );
}

export default function SettingsMenu({
  isOpen, onClose, theme, setTheme,
  layoutInverted, setLayoutInverted,
  boardTheme, setBoardTheme,
  soundEnabled, setSoundEnabled,
  pdfFile, onSetPdfFile,
  onResetAll,
  isOnline = true,
}) {
  const pdfInputRef = useRef(null);
  if (!isOpen) return null;

  const sectionTitle = {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.12em',
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 10,
  };
  const iconSm = { width: 13, height: 13 };

  const handleToggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    if (next) {
      soundManager.playMoveSound(false);
    }
  };

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
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-glass)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 17, height: 17, color: 'var(--accent-color)' }} />
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em' }}>CONFIGURACIÓN</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: 4, borderRadius: 4,
          }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* App Branding Card (visible solo en móviles) */}
        <div className="mobile-only" style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-glass)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(var(--accent-color-rgb), 0.04)',
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, overflow: 'hidden',
            background: '#ffffff', border: '1px solid var(--border-glass)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <img src={logo} alt="Chess Study Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div>
            <h2 style={{
              fontSize: 13, fontWeight: 800, letterSpacing: '0.12em',
              color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0, lineHeight: 1.1
            }}>
              CHESS STUDY
            </h2>
            <span style={{
              fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em',
              textTransform: 'uppercase', display: 'block', marginTop: 3
            }}>
              Lector de libros · Tablero de Análisis
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Connectivity Status */}
          <div className="glass-panel" style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: isOnline ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {isOnline ? (
                  <Wifi style={{ width: 14, height: 14, color: 'var(--color-success, #22c55e)' }} />
                ) : (
                  <WifiOff style={{ width: 14, height: 14, color: '#f59e0b' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isOnline ? 'Conexión: En línea' : 'Modo Sin Conexión (Offline)'}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  {isOnline
                    ? 'PWA lista para funcionar sin conexión a internet'
                    : 'Funcionando con recursos locales y base de datos local'}
                </div>
              </div>
            </div>
          </div>

          {/* 1. Layout */}
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

          {/* 2. Libro PDF Actual (visible solo en móviles) */}
          <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={sectionTitle}><BookOpen style={iconSm} /> Libro PDF</div>
            {pdfFile ? (
              <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(var(--accent-color-rgb), 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <BookOpen style={{ width: 16, height: 16, color: 'var(--accent-color)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {pdfFile.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                      {pdfFile.size ? `${(pdfFile.size / (1024 * 1024)).toFixed(1)} MB` : 'Libro cargado'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 2 }}>
                  <button
                    className="glass-button"
                    onClick={() => pdfInputRef.current?.click()}
                    style={{ padding: '8px', fontSize: 10, gap: 6 }}
                  >
                    <RefreshCw style={{ width: 12, height: 12 }} />
                    Cambiar
                  </button>
                  <button
                    className="glass-button"
                    onClick={() => onSetPdfFile && onSetPdfFile(null)}
                    style={{ padding: '8px', fontSize: 10, gap: 6, color: 'var(--danger-color)' }}
                  >
                    <Trash2 style={{ width: 12, height: 12 }} />
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ningún libro cargado</span>
                <button
                  className="glass-button"
                  onClick={() => pdfInputRef.current?.click()}
                  style={{ padding: '6px 12px', fontSize: 10, gap: 6, color: 'var(--accent-color)' }}
                >
                  <BookOpen style={{ width: 12, height: 12 }} />
                  Cargar PDF
                </button>
              </div>
            )}
            <input
              type="file"
              ref={pdfInputRef}
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.type === 'application/pdf' && onSetPdfFile) {
                  onSetPdfFile(f);
                }
              }}
            />
          </div>

          {/* 3. Theme Switch */}
          <div>
            <div style={sectionTitle}><Sun style={iconSm} /> Tema</div>
            <SwitchRow
              icon={theme === 'dark' ? Moon : Sun}
              iconColor={theme === 'dark' ? 'var(--accent-color)' : '#f59e0b'}
              title={theme === 'dark' ? 'Modo Oscuro' : 'Modo Claro'}
              subtitle={theme === 'dark' ? 'Interfaz oscura activa' : 'Interfaz clara activa'}
              checked={theme === 'dark'}
              onToggle={handleToggleTheme}
            />
          </div>

          {/* 4. Sound Switch */}
          <div>
            <div style={sectionTitle}><Volume2 style={iconSm} /> Sonido de Piezas</div>
            <SwitchRow
              icon={soundEnabled ? Volume2 : VolumeX}
              iconColor={soundEnabled ? 'var(--accent-color)' : 'var(--text-muted)'}
              title={soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
              subtitle={soundEnabled ? 'Sonido típico al mover y capturar' : 'Sin efectos de sonido'}
              checked={soundEnabled}
              onToggle={handleToggleSound}
            />
          </div>

          {/* 4. Board Colours */}
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
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <a
              href="/privacidad.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Política de Privacidad
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
