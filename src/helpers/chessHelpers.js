/**
 * Converts a react-chessboard position object to the piece placement part of a FEN string.
 *
 * Example of pieces object: { e4: 'wP', d5: 'bP' }
 * Example output: 8/8/8/8/8/8/8/8 (if empty) or parsed rows
 */
export function positionObjectToFenPiecePlacement(pieces) {
  const rows = [];
  for (let r = 8; r >= 1; r--) {
    let rowStr = '';
    let emptyCount = 0;
    for (let f = 1; f <= 8; f++) {
      const fileLetter = String.fromCharCode(96 + f); // 'a' to 'h'
      const square = `${fileLetter}${r}`;
      const piece = pieces[square]; // e.g. 'wP' or 'bK'
      if (piece) {
        if (emptyCount > 0) {
          rowStr += emptyCount;
          emptyCount = 0;
        }
        const color = piece[0]; // 'w' or 'b'
        const type = piece[1]; // 'P', 'R', 'N', 'B', 'Q', 'K'
        rowStr += (color === 'w' ? type.toUpperCase() : type.toLowerCase());
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) {
      rowStr += emptyCount;
    }
    rows.push(rowStr);
  }
  return rows.join('/');
}

/**
 * Converts a full FEN string or just the piece placement part of a FEN string
 * to a react-chessboard position object format.
 *
 * Example FEN: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
 * Example output: { a8: 'bR', b8: 'bN', ..., a1: 'wR', ... }
 */
export function fenToPositionObject(fen) {
  if (!fen) return {};
  
  // Extract just the piece placement part if a full FEN is supplied
  const placement = fen.split(' ')[0];
  const rows = placement.split('/');
  const pieces = {};
  
  for (let r = 0; r < 8; r++) {
    const rowNum = 8 - r;
    let fileIdx = 1;
    const rowStr = rows[r];
    
    // Safely parse rowStr which contains piece characters and empty square numbers
    for (let i = 0; i < rowStr.length; i++) {
      const char = rowStr[i];
      if (isNaN(char)) {
        // It's a piece letter
        const fileLetter = String.fromCharCode(96 + fileIdx);
        const square = `${fileLetter}${rowNum}`;
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toUpperCase();
        pieces[square] = `${color}${type}`;
        fileIdx++;
      } else {
        // It's a number representing consecutive empty squares
        fileIdx += parseInt(char, 10);
      }
    }
  }
  return pieces;
}

/**
 * Standard chess starting position FEN
 */
export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Standard chess starting position object for react-chessboard
 */
export const STARTING_POSITION_OBJECT = fenToPositionObject(STARTING_FEN);
