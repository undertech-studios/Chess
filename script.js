// ═══════════════════════════════════════════
//  CHESS AI — Full engine with 5 difficulty levels
// ═══════════════════════════════════════════

'use strict';

// ── Piece constants ─────────────────────────
const W = 'w', B = 'b';
const PIECES = { K:'k', Q:'q', R:'r', B_:'b', N:'n', P:'p' };

const UNICODE = {
  wk:'♔', wq:'♕', wr:'♖', wb:'♗', wn:'♘', wp:'♙',
  bk:'♚', bq:'♛', br:'♜', bb:'♝', bn:'♞', bp:'♟'
};

// Piece values for eval
const VALUE = { k:20000, q:900, r:500, b:330, n:320, p:100 };

// Piece-square tables (from white's perspective)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

// ── Game state ──────────────────────────────
let board = [];       // 8x8 array, null or {color, type}
let turn = W;
let selected = null;  // {row, col}
let possibleMoves = [];
let lastMove = null;  // {from, to}
let difficulty = 1;
let gameOver = false;
let aiThinking = false;
let promotionCallback = null;
let whiteCaptured = [];
let blackCaptured = [];

// Castling rights & en passant
let castling = { wK: true, wQ: true, bK: true, bQ: true };
let enPassant = null; // {row, col} target square

// ── Init board ──────────────────────────────
function initBoard() {
  board = Array.from({length:8}, () => Array(8).fill(null));

  const backRank = ['r','n','b','q','k','b','n','r'];
  for (let c = 0; c < 8; c++) {
    board[0][c] = {color: B, type: backRank[c]};
    board[1][c] = {color: B, type: 'p'};
    board[6][c] = {color: W, type: 'p'};
    board[7][c] = {color: W, type: backRank[c]};
  }

  turn = W;
  selected = null;
  possibleMoves = [];
  lastMove = null;
  gameOver = false;
  aiThinking = false;
  enPassant = null;
  castling = { wK: true, wQ: true, bK: true, bQ: true };
  whiteCaptured = [];
  blackCaptured = [];
}

// ── Render ──────────────────────────────────
function render() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  // Build side coords
  const left = document.getElementById('coordsLeft');
  const right = document.getElementById('coordsRight');
  left.innerHTML = '';
  right.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    const n = 8 - r;
    left.innerHTML  += `<span>${n}</span>`;
    right.innerHTML += `<span>${n}</span>`;
  }

  const selSet  = new Set(possibleMoves.map(m => `${m.to.row},${m.to.col}`));
  const lastSet = lastMove ? new Set([
    `${lastMove.from.row},${lastMove.from.col}`,
    `${lastMove.to.row},${lastMove.to.col}`
  ]) : new Set();

  // Find kings in check
  const whiteKingPos = findKing(W);
  const blackKingPos = findKing(B);
  const whiteInCheck = isInCheck(W);
  const blackInCheck = isInCheck(B);

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = document.createElement('div');
      const isLight = (r + c) % 2 === 0;
      sq.className = `square ${isLight ? 'light' : 'dark'}`;
      sq.dataset.row = r;
      sq.dataset.col = c;

      if (lastSet.has(`${r},${c}`)) sq.classList.add('last-move');
      if (selected && selected.row === r && selected.col === c) sq.classList.add('selected');
      if (selSet.has(`${r},${c}`)) {
        sq.classList.add('possible');
        if (board[r][c]) sq.classList.add('has-piece');
      }

      // Check highlight
      if (whiteInCheck && whiteKingPos && whiteKingPos.row === r && whiteKingPos.col === c)
        sq.classList.add('in-check');
      if (blackInCheck && blackKingPos && blackKingPos.row === r && blackKingPos.col === c)
        sq.classList.add('in-check');

      const piece = board[r][c];
      if (piece) {
        const span = document.createElement('span');
        span.className = 'piece';
        span.textContent = UNICODE[`${piece.color}${piece.type}`];
        sq.appendChild(span);
      }

      sq.addEventListener('click', () => handleClick(r, c));
      boardEl.appendChild(sq);
    }
  }

  // Captures
  document.getElementById('whiteCaps').textContent = whiteCaptured.map(p => UNICODE[`w${p}`]).join('');
  document.getElementById('blackCaps').textContent = blackCaptured.map(p => UNICODE[`b${p}`]).join('');

  // Turn indicator
  const dot = document.getElementById('turnDot');
  const txt = document.getElementById('turnText');
  if (turn === W) {
    dot.classList.remove('black');
    txt.textContent = 'Tu turno (Blancas)';
  } else {
    dot.classList.add('black');
    txt.textContent = aiThinking ? 'IA pensando...' : 'Turno IA (Negras)';
  }

  // Status
  const statusEl = document.getElementById('statusMsg');
  if (aiThinking) {
    statusEl.textContent = '♟ Calculando...';
    statusEl.classList.add('thinking');
  } else {
    statusEl.classList.remove('thinking');
    const inChk = isInCheck(turn);
    statusEl.textContent = inChk ? '⚠ ¡Jaque!' : '';
  }
}

// ── Click handler ────────────────────────────
function handleClick(row, col) {
  if (gameOver || aiThinking || turn !== W) return;

  const piece = board[row][col];

  // If clicking a possible move destination
  if (selected && possibleMoves.some(m => m.to.row === row && m.to.col === col)) {
    const move = possibleMoves.find(m => m.to.row === row && m.to.col === col);
    executeMove(move, () => {
      selected = null;
      possibleMoves = [];
      render();
      if (!gameOver) scheduleAI();
    });
    return;
  }

  // Select own piece
  if (piece && piece.color === W) {
    selected = {row, col};
    possibleMoves = getLegalMoves(row, col);
  } else {
    selected = null;
    possibleMoves = [];
  }
  render();
}

// ── Move execution ───────────────────────────
function executeMove(move, callback) {
  const {from, to, flags} = move;
  const piece = board[from.row][from.col];
  const target = board[to.row][to.col];

  // Capture
  if (target) {
    if (piece.color === W) blackCaptured.push(target.type);
    else whiteCaptured.push(target.type);
  }

  // En passant capture
  if (flags && flags.enPassant) {
    const capRow = from.row;
    const capPiece = board[capRow][to.col];
    if (capPiece) {
      if (piece.color === W) blackCaptured.push(capPiece.type);
      else whiteCaptured.push(capPiece.type);
    }
    board[capRow][to.col] = null;
  }

  // Move piece
  board[to.row][to.col] = piece;
  board[from.row][from.col] = null;
  lastMove = {from, to};

  // Update en passant
  enPassant = null;
  if (piece.type === 'p' && Math.abs(to.row - from.row) === 2) {
    enPassant = {row: (from.row + to.row) / 2, col: from.col};
  }

  // Castling move
  if (flags && flags.castle) {
    if (flags.castle === 'K') {
      board[to.row][5] = board[to.row][7];
      board[to.row][7] = null;
    } else {
      board[to.row][3] = board[to.row][0];
      board[to.row][0] = null;
    }
  }

  // Update castling rights
  if (piece.type === 'k') {
    if (piece.color === W) { castling.wK = false; castling.wQ = false; }
    else                   { castling.bK = false; castling.bQ = false; }
  }
  if (piece.type === 'r') {
    if (from.row === 7 && from.col === 7) castling.wK = false;
    if (from.row === 7 && from.col === 0) castling.wQ = false;
    if (from.row === 0 && from.col === 7) castling.bK = false;
    if (from.row === 0 && from.col === 0) castling.bQ = false;
  }

  // Promotion
  if (piece.type === 'p' && (to.row === 0 || to.row === 7)) {
    if (piece.color === W) {
      // Show modal for human
      showPromoModal(piece.color, (promo) => {
        board[to.row][to.col] = {color: piece.color, type: promo};
        turn = turn === W ? B : W;
        render();
        checkGameOver();
        if (callback) callback();
      });
      return;
    } else {
      // AI always promotes to queen
      board[to.row][to.col] = {color: piece.color, type: 'q'};
    }
  }

  turn = turn === W ? B : W;
  render();
  checkGameOver();
  if (callback) callback();
}

function showPromoModal(color, cb) {
  const modal = document.getElementById('promoModal');
  modal.classList.remove('hidden');
  // Update icons to match color
  const btns = modal.querySelectorAll('.promo-btn');
  const map = {q:'q', r:'r', b:'b', n:'n'};
  btns.forEach(btn => {
    const p = btn.dataset.piece;
    btn.textContent = UNICODE[`${color}${p}`];
  });
  promotionCallback = (promo) => {
    modal.classList.add('hidden');
    cb(promo);
  };
}

// ── Check / Checkmate ────────────────────────
function checkGameOver() {
  const opp = turn;
  if (isCheckmate(opp)) {
    const winner = opp === W ? 'Negras' : 'Blancas';
    gameOver = true;
    render();
    setTimeout(() => showGameOver('checkmate', winner), 400);
  } else if (isStalemate(opp)) {
    gameOver = true;
    render();
    setTimeout(() => showGameOver('stalemate'), 400);
  }
}

function showGameOver(type, winner) {
  const overlay = document.getElementById('gameOverlay');
  overlay.classList.remove('hidden');
  if (type === 'checkmate') {
    document.getElementById('goIcon').textContent = winner === 'Blancas' ? '🏆' : '🤖';
    document.getElementById('goTitle').textContent = `¡Jaque Mate!`;
    document.getElementById('goMsg').textContent = `${winner} ganan la partida.`;
  } else {
    document.getElementById('goIcon').textContent = '🤝';
    document.getElementById('goTitle').textContent = 'Tablas';
    document.getElementById('goMsg').textContent = 'Rey ahogado — empate.';
  }
}

// ── Legal move generation ────────────────────
function getLegalMoves(row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  const pseudo = getPseudoMoves(row, col, piece.color);
  return pseudo.filter(move => {
    const snapshot = deepCopy();
    applyMoveToBoard(snapshot.board, move, snapshot.ep);
    return !isInCheckBoard(snapshot.board, piece.color);
  });
}

function getAllLegalMoves(color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c].color === color)
        moves.push(...getLegalMoves(r, c));
  return moves;
}

function isInCheck(color) {
  return isInCheckBoard(board, color);
}

function isInCheckBoard(b, color) {
  const kPos = findKingOnBoard(b, color);
  if (!kPos) return false;
  return isSquareAttacked(b, kPos.row, kPos.col, color === W ? B : W);
}

function isCheckmate(color) {
  if (!isInCheck(color)) return false;
  return getAllLegalMoves(color).length === 0;
}

function isStalemate(color) {
  if (isInCheck(color)) return false;
  return getAllLegalMoves(color).length === 0;
}

function findKing(color) { return findKingOnBoard(board, color); }

function findKingOnBoard(b, color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (b[r][c] && b[r][c].color === color && b[r][c].type === 'k')
        return {row: r, col: c};
  return null;
}

function isSquareAttacked(b, row, col, byColor) {
  // Check knight attacks
  const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightMoves) {
    const r = row+dr, c = col+dc;
    if (inBounds(r,c) && b[r][c] && b[r][c].color === byColor && b[r][c].type === 'n') return true;
  }
  // Sliding (rook/queen/bishop)
  const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr, dc] of dirs) {
    let r = row+dr, c = col+dc;
    while (inBounds(r,c)) {
      const p = b[r][c];
      if (p) {
        if (p.color === byColor) {
          const straight = dr === 0 || dc === 0;
          const diag = Math.abs(dr) === Math.abs(dc);
          if ((straight && (p.type === 'r' || p.type === 'q')) ||
              (diag    && (p.type === 'b' || p.type === 'q'))) return true;
          if (p.type === 'k' && Math.abs(dr) <= 1 && Math.abs(dc) <= 1) {
            // Actually king adjacency - only first step
          }
        }
        break;
      }
      r += dr; c += dc;
    }
  }
  // King adjacent
  const adjDirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
  for (const [dr, dc] of adjDirs) {
    const r = row+dr, c = col+dc;
    if (inBounds(r,c) && b[r][c] && b[r][c].color === byColor && b[r][c].type === 'k') return true;
  }
  // Pawns
  const pawnDir = byColor === W ? 1 : -1; // white pawns attack upward (row decreases)
  const pawnRow = row + pawnDir;
  for (const dc of [-1, 1]) {
    const c = col + dc;
    if (inBounds(pawnRow, c) && b[pawnRow][c] && b[pawnRow][c].color === byColor && b[pawnRow][c].type === 'p') return true;
  }
  return false;
}

// ── Pseudo-move generation ───────────────────
function getPseudoMoves(row, col, color) {
  const piece = board[row][col];
  if (!piece) return [];
  const moves = [];
  const opp = color === W ? B : W;

  const add = (tr, tc, flags) => {
    if (inBounds(tr, tc)) moves.push({from:{row,col}, to:{row:tr,col:tc}, flags: flags||{}});
  };

  switch (piece.type) {
    case 'p': {
      const dir = color === W ? -1 : 1;
      const startRow = color === W ? 6 : 1;
      // Forward
      if (inBounds(row+dir, col) && !board[row+dir][col]) {
        add(row+dir, col);
        if (row === startRow && !board[row+2*dir][col]) add(row+2*dir, col);
      }
      // Captures
      for (const dc of [-1,1]) {
        const tr = row+dir, tc = col+dc;
        if (inBounds(tr,tc)) {
          if (board[tr][tc] && board[tr][tc].color === opp) add(tr, tc);
          else if (enPassant && enPassant.row === tr && enPassant.col === tc) add(tr, tc, {enPassant:true});
        }
      }
      break;
    }
    case 'n': {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const tr=row+dr, tc=col+dc;
        if (inBounds(tr,tc) && (!board[tr][tc] || board[tr][tc].color===opp)) add(tr,tc);
      }
      break;
    }
    case 'b': {
      for (const [dr,dc] of [[1,1],[1,-1],[-1,1],[-1,-1]]) {
        let r=row+dr, c=col+dc;
        while(inBounds(r,c)) {
          if (board[r][c]) { if(board[r][c].color===opp) add(r,c); break; }
          add(r,c); r+=dr; c+=dc;
        }
      }
      break;
    }
    case 'r': {
      for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        let r=row+dr, c=col+dc;
        while(inBounds(r,c)) {
          if (board[r][c]) { if(board[r][c].color===opp) add(r,c); break; }
          add(r,c); r+=dr; c+=dc;
        }
      }
      break;
    }
    case 'q': {
      for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        let r=row+dr, c=col+dc;
        while(inBounds(r,c)) {
          if (board[r][c]) { if(board[r][c].color===opp) add(r,c); break; }
          add(r,c); r+=dr; c+=dc;
        }
      }
      break;
    }
    case 'k': {
      for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]) {
        const tr=row+dr, tc=col+dc;
        if (inBounds(tr,tc) && (!board[tr][tc] || board[tr][tc].color===opp)) add(tr,tc);
      }
      // Castling
      const kRow = color === W ? 7 : 0;
      if (row === kRow && col === 4) {
        const kKey = color === W ? 'wK' : 'bK';
        const qKey = color === W ? 'wQ' : 'bQ';
        if (castling[kKey] && !board[kRow][5] && !board[kRow][6] &&
            board[kRow][7] && board[kRow][7].type === 'r' &&
            !isSquareAttacked(board,kRow,4,opp) &&
            !isSquareAttacked(board,kRow,5,opp) &&
            !isSquareAttacked(board,kRow,6,opp))
          add(kRow, 6, {castle:'K'});
        if (castling[qKey] && !board[kRow][3] && !board[kRow][2] && !board[kRow][1] &&
            board[kRow][0] && board[kRow][0].type === 'r' &&
            !isSquareAttacked(board,kRow,4,opp) &&
            !isSquareAttacked(board,kRow,3,opp) &&
            !isSquareAttacked(board,kRow,2,opp))
          add(kRow, 2, {castle:'Q'});
      }
      break;
    }
  }
  return moves;
}

// ── Board utilities ──────────────────────────
function inBounds(r, c) { return r>=0 && r<8 && c>=0 && c<8; }

function deepCopy() {
  return {
    board: board.map(row => row.map(p => p ? {...p} : null)),
    ep: enPassant ? {...enPassant} : null,
    castling: {...castling}
  };
}

function applyMoveToBoard(b, move, ep) {
  const {from, to, flags} = move;
  const piece = b[from.row][from.col];
  if (!piece) return;

  if (flags && flags.enPassant) b[from.row][to.col] = null;

  b[to.row][to.col] = piece;
  b[from.row][from.col] = null;

  if (flags && flags.castle) {
    const r = to.row;
    if (flags.castle === 'K') { b[r][5] = b[r][7]; b[r][7] = null; }
    else                       { b[r][3] = b[r][0]; b[r][0] = null; }
  }
  // Auto-promote to queen for simulation
  if (piece.type === 'p' && (to.row === 0 || to.row === 7)) {
    b[to.row][to.col] = {color: piece.color, type: 'q'};
  }
}

// ── AI ───────────────────────────────────────
function scheduleAI() {
  if (gameOver || turn !== B) return;
  aiThinking = true;
  render();
  setTimeout(runAI, 100);
}

function runAI() {
  if (gameOver) return;

  const savedBoard = board.map(r => r.map(p => p ? {...p} : null));
  const savedEP = enPassant ? {...enPassant} : null;
  const savedCastling = {...castling};

  let move;
  switch (difficulty) {
    case 1: move = aiRandom(); break;
    case 2: move = aiGreedy(1); break;
    case 3: move = aiGreedy(2); break;
    case 4: move = aiMinimax(3); break;
    case 5: move = aiMinimax(5); break;
  }

  if (!move) { aiThinking = false; return; }

  executeMove(move, () => {
    aiThinking = false;
    render();
  });
}

// Level 1: near-random
function aiRandom() {
  const moves = getAllLegalMoves(B);
  if (!moves.length) return null;
  // Small bias toward captures
  const captures = moves.filter(m => board[m.to.row][m.to.col]);
  if (captures.length && Math.random() < 0.3) return captures[Math.floor(Math.random()*captures.length)];
  return moves[Math.floor(Math.random()*moves.length)];
}

// Level 2-3: greedy with depth
function aiGreedy(depth) {
  const moves = getAllLegalMoves(B);
  if (!moves.length) return null;

  let best = null, bestScore = -Infinity;
  for (const move of moves) {
    const snap = deepCopy();
    applyMoveToBoard(snap.board, move, snap.ep);
    const score = evalBoard(snap.board);
    if (score > bestScore) { bestScore = score; best = move; }
  }
  // Add slight randomness for level 2
  if (difficulty === 2 && Math.random() < 0.3) return moves[Math.floor(Math.random()*moves.length)];
  return best;
}

// Level 4-5: Minimax with Alpha-Beta
function aiMinimax(depth) {
  const moves = getAllLegalMoves(B);
  if (!moves.length) return null;

  const origBoard = board;
  const origEP = enPassant;
  const origCastling = castling;

  let best = null, bestScore = -Infinity;
  let alpha = -Infinity, beta = Infinity;

  // Sort moves for better pruning
  const scored = moves.map(m => {
    const snap = deepCopy();
    applyMoveToBoard(snap.board, m, snap.ep);
    return {move: m, score: evalBoard(snap.board)};
  }).sort((a,b) => b.score - a.score);

  for (const {move} of scored) {
    const snap = deepCopy();
    const savedBoard = board;
    const savedEP = enPassant;
    const savedCastling = castling;

    board = snap.board;
    enPassant = snap.ep;
    castling = snap.castling;
    applyMoveToBoard(board, move, enPassant);

    const score = minimaxAB(depth-1, alpha, beta, false);

    board = savedBoard;
    enPassant = savedEP;
    castling = savedCastling;

    if (score > bestScore) { bestScore = score; best = move; }
    alpha = Math.max(alpha, score);
  }

  return best;
}

function minimaxAB(depth, alpha, beta, isMaximizing) {
  const color = isMaximizing ? B : W;

  if (depth === 0) return evalBoard(board);

  const moves = getAllLegalMovesOnBoard(color);

  if (!moves.length) {
    if (isInCheckBoard(board, color)) return isMaximizing ? -30000 : 30000;
    return 0; // stalemate
  }

  if (isMaximizing) {
    let max = -Infinity;
    for (const move of moves) {
      const snap = deepCopy();
      const sb = board, se = enPassant, sc = castling;
      board = snap.board; enPassant = snap.ep; castling = snap.castling;
      applyMoveToBoard(board, move, enPassant);

      const score = minimaxAB(depth-1, alpha, beta, false);

      board = sb; enPassant = se; castling = sc;
      max = Math.max(max, score);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return max;
  } else {
    let min = Infinity;
    for (const move of moves) {
      const snap = deepCopy();
      const sb = board, se = enPassant, sc = castling;
      board = snap.board; enPassant = snap.ep; castling = snap.castling;
      applyMoveToBoard(board, move, enPassant);

      const score = minimaxAB(depth-1, alpha, beta, true);

      board = sb; enPassant = se; castling = sc;
      min = Math.min(min, score);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return min;
  }
}

function getAllLegalMovesOnBoard(color) {
  const moves = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c].color === color) {
        const pseudo = getPseudoMoves(r, c, color);
        for (const move of pseudo) {
          const snap = deepCopy();
          applyMoveToBoard(snap.board, move, snap.ep);
          if (!isInCheckBoard(snap.board, color)) moves.push(move);
        }
      }
  return moves;
}

// ── Board evaluation ─────────────────────────
function evalBoard(b) {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      const base = VALUE[p.type];
      const pstRow = p.color === W ? r : 7 - r;
      const pstIdx = pstRow * 8 + c;
      const pstVal = PST[p.type] ? PST[p.type][pstIdx] : 0;
      if (p.color === B) score += base + pstVal;
      else               score -= base + pstVal;
    }
  }
  return score;
}

// ── Difficulty UI ────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = parseInt(btn.dataset.level);
  });
});

// ── Restart ──────────────────────────────────
function restart() {
  document.getElementById('gameOverlay').classList.add('hidden');
  initBoard();
  render();
}

document.getElementById('restartBtn').addEventListener('click', restart);
document.getElementById('goRestart').addEventListener('click', restart);

// ── Promo modal ──────────────────────────────
document.querySelectorAll('.promo-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (promotionCallback) promotionCallback(btn.dataset.piece);
  });
});

// ── Boot ─────────────────────────────────────
initBoard();
render();