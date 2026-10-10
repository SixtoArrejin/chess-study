import React from 'react';
import { AlertCircle, RotateCcw, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo);
  }

  handleResetChessState = () => {
    try {
      localStorage.removeItem('chess-study-is-game-mode');
      localStorage.removeItem('chess-study-fen-history');
      localStorage.removeItem('chess-study-history-index');
      localStorage.removeItem('chess-study-move-list');
      localStorage.removeItem('chess-study-board-pieces');
    } catch (e) {
      console.warn('Error limpiando almacenamiento:', e);
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          width: '100vw',
          padding: 24,
          background: 'var(--bg-primary, #121824)',
          color: 'var(--text-primary, #ffffff)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{
            maxWidth: 480,
            width: '100%',
            padding: '32px 24px',
            borderRadius: 16,
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444'
            }}>
              <AlertCircle size={32} />
            </div>

            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              Se produjo un error en el tablero
            </h2>

            <p style={{ fontSize: 13, color: 'var(--text-secondary, #94a3b8)', margin: 0, lineHeight: 1.5 }}>
              Ocurrió un problema inesperado al procesar la posición o jugada. Puedes restablecer únicamente el estado del tablero sin perder tu libro cargado ni tu configuración.
            </p>

            {this.state.error && (
              <pre style={{
                width: '100%',
                maxHeight: 100,
                overflow: 'auto',
                padding: 10,
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.3)',
                fontSize: 10,
                color: '#f87171',
                textAlign: 'left',
                boxSizing: 'border-box'
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 8 }}>
              <button
                onClick={this.handleResetChessState}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent-color, #3b82f6)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <RotateCcw size={14} />
                Restablecer tablero
              </button>

              <button
                onClick={this.handleReload}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'transparent',
                  color: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                <RefreshCw size={14} />
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
