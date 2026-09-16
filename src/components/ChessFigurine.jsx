import { defaultPieces } from 'react-chessboard';

/**
 * Parses a standard SAN move string (e.g. "Nf3", "Bxf7+", "e8=Q#", "O-O")
 * into its piece initial, movement text, and promotion component.
 */
export function parseSanMove(san) {
  if (!san || typeof san !== 'string') return null;
  let mainPiece = null;
  let text = san;
  let promoPiece = null;
  let suffix = '';

  // Check promotion: e.g. e8=Q, exd8=N+, a1=R#
  const promoMatch = text.match(/=([KQRBN])([+#]?)$/);
  if (promoMatch) {
    promoPiece = promoMatch[1];
    suffix = promoMatch[2] || '';
    text = text.slice(0, promoMatch.index);
  }

  // Check leading piece initial: e.g. Nf3, Rad1, Qxd8+
  if (/^[KQRBN]/.test(text)) {
    mainPiece = text[0];
    text = text.slice(1);
  }

  return { mainPiece, text, promoPiece, suffix };
}

/**
 * Renders a SAN move with universal piece icons (Figurine Algebraic Notation)
 * instead of language-specific initials (N, B, R, Q, K).
 *
 * @param {Object} props
 * @param {string} props.san - The SAN string (e.g. "Nf3", "e4", "Bxf7+")
 * @param {boolean} props.isWhite - True if white played this move, false if black
 * @param {string} [props.size='1.2em'] - Size of the figurine icon
 */
export default function ChessFigurine({ san, isWhite = true, size = '1.2em' }) {
  const parsed = parseSanMove(san);
  if (!parsed) return <span>{san || ''}</span>;

  const { mainPiece, text, promoPiece, suffix } = parsed;

  const renderIcon = (pieceInitial) => {
    const key = (isWhite ? 'w' : 'b') + pieceInitial.toUpperCase();
    const PieceComponent = defaultPieces[key];
    if (!PieceComponent) return pieceInitial;

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          verticalAlign: '-0.18em',
          marginRight: '0.1em',
          flexShrink: 0,
          filter: isWhite
            ? 'drop-shadow(0 0 0.5px rgba(0, 0, 0, 0.7))'
            : 'drop-shadow(0 0 1px rgba(255, 255, 255, 0.85)) drop-shadow(0 0 0.4px rgba(255, 255, 255, 0.95))',
        }}
      >
        <PieceComponent />
      </span>
    );
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {mainPiece && renderIcon(mainPiece)}
      <span>{text}</span>
      {promoPiece && (
        <>
          <span>=</span>
          {renderIcon(promoPiece)}
        </>
      )}
      {suffix && <span>{suffix}</span>}
    </span>
  );
}
