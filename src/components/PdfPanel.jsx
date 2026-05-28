import React, { useRef, useState, useMemo } from 'react';
import { Upload, FileText } from 'lucide-react';

export default function PdfPanel({ pdfFile, setPdfFile }) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Use a stable, virtual URL served by our Service Worker.
  // Because the URL is identical across sessions for the same file,
  // Chrome/Edge/Firefox native PDF renderer perfectly remembers the last scroll position!
  const iframeSrc = useMemo(() => {
    if (!pdfFile) return null;
    return `/pdf-viewer/${encodeURIComponent(pdfFile.name)}?size=${pdfFile.size}`;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" style={{ display: 'none' }} />

      <div style={{ flex: 1, padding: 10, overflow: 'hidden', display: 'flex' }}>
        {pdfFile ? (
          <div style={{
            width: '100%', height: '100%', borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--border-glass)',
            position: 'relative',
          }}>
            <iframe
              src={iframeSrc}
              width="100%" height="100%"
              title="Visor PDF"
              style={{ border: 'none', display: 'block' }}
            />
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
