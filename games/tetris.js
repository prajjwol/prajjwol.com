const TICK_MS = 140;
const COLS = 10;
const ROWS = 20;

const SHAPES = {
  I: [
    [[1, 1, 1, 1]],
    [[1], [1], [1], [1]],
  ],
  O: [[[1, 1], [1, 1]]],
  T: [
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0], [1, 1], [1, 0]],
    [[1, 1, 1], [0, 1, 0]],
    [[0, 1], [1, 1], [0, 1]],
  ],
  S: [
    [[0, 1, 1], [1, 1, 0]],
    [[1, 0], [1, 1], [0, 1]],
  ],
  Z: [
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1], [1, 1], [1, 0]],
  ],
  J: [
    [[1, 0, 0], [1, 1, 1]],
    [[1, 1], [1, 0], [1, 0]],
    [[1, 1, 1], [0, 0, 1]],
    [[0, 1], [0, 1], [1, 1]],
  ],
  L: [
    [[0, 0, 1], [1, 1, 1]],
    [[1, 0], [1, 0], [1, 1]],
    [[1, 1, 1], [1, 0, 0]],
    [[1, 1], [0, 1], [0, 1]],
  ],
};

const PIECE_KEYS = Object.keys(SHAPES);

export function start(canvas) {
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let cell = 24;
  let offsetX = 0;
  let offsetY = 0;
  let board = [];
  let piece = null;
  let dropAccum = 0;
  let lastTick = 0;
  let running = true;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    cell = Math.max(14, Math.min(28, Math.floor(Math.min(width / (COLS + 6), height / (ROWS + 4)))));
    offsetX = Math.floor((width - COLS * cell) / 2);
    offsetY = Math.floor((height - ROWS * cell) / 2);
  }

  function randomPiece() {
    const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    const rotations = SHAPES[key];
    return {
      key,
      rotations,
      rot: 0,
      matrix: rotations[0],
      x: Math.floor(COLS / 2) - 1,
      y: 0,
    };
  }

  function collides(matrix, x, y) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    const m = piece.matrix;
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const by = piece.y + r;
        const bx = piece.x + c;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          board[by][bx] = 1;
        }
      }
    }
  }

  function clearLines() {
    const next = board.filter((row) => row.some((v) => v === 0));
    const cleared = ROWS - next.length;
    while (next.length < ROWS) {
      next.unshift(Array(COLS).fill(0));
    }
    board = next;
    return cleared;
  }

  function boardStats(testBoard) {
    let holes = 0;
    let aggregateHeight = 0;
    let bumpiness = 0;
    const heights = Array(COLS).fill(0);

    for (let c = 0; c < COLS; c++) {
      let seen = false;
      for (let r = 0; r < ROWS; r++) {
        if (testBoard[r][c]) {
          if (!seen) {
            heights[c] = ROWS - r;
            seen = true;
          }
        } else if (seen) {
          holes += 1;
        }
      }
      aggregateHeight += heights[c];
    }

    for (let c = 0; c < COLS - 1; c++) {
      bumpiness += Math.abs(heights[c] - heights[c + 1]);
    }

    let complete = 0;
    for (let r = 0; r < ROWS; r++) {
      if (testBoard[r].every((v) => v === 1)) complete += 1;
    }

    return { holes, aggregateHeight, bumpiness, complete };
  }

  function simulate(matrix, x) {
    let y = 0;
    if (collides(matrix, x, y)) return null;
    while (!collides(matrix, x, y + 1)) y += 1;

    const test = board.map((row) => row.slice());
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const by = y + r;
        const bx = x + c;
        if (by < 0) return null;
        if (by < ROWS && bx >= 0 && bx < COLS) test[by][bx] = 1;
      }
    }

    // clear lines in simulation
    const filtered = test.filter((row) => row.some((v) => v === 0));
    while (filtered.length < ROWS) filtered.unshift(Array(COLS).fill(0));

    const stats = boardStats(filtered);
    const score =
      stats.complete * 120 -
      stats.holes * 40 -
      stats.aggregateHeight * 1.2 -
      stats.bumpiness * 1.5;
    return { x, y, score, matrix };
  }

  function chooseBestPlacement() {
    let best = null;
    for (let rot = 0; rot < piece.rotations.length; rot++) {
      const matrix = piece.rotations[rot];
      for (let x = -2; x < COLS; x++) {
        const result = simulate(matrix, x);
        if (!result) continue;
        result.rot = rot;
        if (!best || result.score > best.score) best = result;
      }
    }
    return best;
  }

  function spawnPiece() {
    piece = randomPiece();
    const best = chooseBestPlacement();
    if (!best) {
      board = emptyBoard();
      piece = randomPiece();
      const retry = chooseBestPlacement();
      if (retry) {
        piece.rot = retry.rot;
        piece.matrix = retry.matrix;
        piece.x = retry.x;
        piece.y = 0;
        piece.targetX = retry.x;
        piece.targetRot = retry.rot;
      }
      return;
    }
    piece.targetX = best.x;
    piece.targetRot = best.rot;
    piece.rot = 0;
    piece.matrix = piece.rotations[0];
    piece.x = Math.floor(COLS / 2) - 1;
    piece.y = 0;
  }

  function stepAI() {
    if (!piece) {
      spawnPiece();
      return;
    }

    // Rotate toward target
    if (piece.rot !== piece.targetRot) {
      const nextRot = (piece.rot + 1) % piece.rotations.length;
      const nextMatrix = piece.rotations[nextRot];
      if (!collides(nextMatrix, piece.x, piece.y)) {
        piece.rot = nextRot;
        piece.matrix = nextMatrix;
      }
    }

    // Move toward target column
    if (piece.x < piece.targetX && !collides(piece.matrix, piece.x + 1, piece.y)) {
      piece.x += 1;
    } else if (piece.x > piece.targetX && !collides(piece.matrix, piece.x - 1, piece.y)) {
      piece.x -= 1;
    }

    // Soft drop
    if (!collides(piece.matrix, piece.x, piece.y + 1)) {
      piece.y += 1;
    } else {
      // lock if aligned enough, else nudge
      if (piece.x === piece.targetX || Math.abs(piece.x - piece.targetX) === 0) {
        mergePiece();
        clearLines();
        spawnPiece();
      } else if (piece.x < piece.targetX && !collides(piece.matrix, piece.x + 1, piece.y)) {
        piece.x += 1;
      } else if (piece.x > piece.targetX && !collides(piece.matrix, piece.x - 1, piece.y)) {
        piece.x -= 1;
      } else {
        mergePiece();
        clearLines();
        spawnPiece();
      }
    }

    // Top-out check
    if (piece && collides(piece.matrix, piece.x, piece.y)) {
      board = emptyBoard();
      spawnPiece();
    }
  }

  function drawCell(x, y, alpha) {
    ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
    ctx.fillRect(offsetX + x * cell + 1, offsetY + y * cell + 1, cell - 2, cell - 2);
  }

  function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // well border
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.15)';
    ctx.strokeRect(offsetX - 1, offsetY - 1, COLS * cell + 2, ROWS * cell + 2);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(c, r, 0.22);
      }
    }

    if (piece) {
      const m = piece.matrix;
      for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
          if (!m[r][c]) continue;
          const y = piece.y + r;
          const x = piece.x + c;
          if (y >= 0) drawCell(x, y, 0.4);
        }
      }
    }
  }

  function loop(now) {
    if (running) {
      if (now - lastTick >= TICK_MS) {
        stepAI();
        lastTick = now;
      }
      draw();
    }
    requestAnimationFrame(loop);
  }

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) lastTick = performance.now();
  });

  window.addEventListener('resize', resizeCanvas);
  board = emptyBoard();
  resizeCanvas();
  spawnPiece();
  requestAnimationFrame(loop);
}
