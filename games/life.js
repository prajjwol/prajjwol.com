const TICK_MS = 100;

export function start(canvas) {
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let cellSize = 10;
  let cols = 0;
  let rows = 0;
  let grid = [];
  let nextGrid = [];
  let lastTick = 0;
  let running = true;

  function spawnGlider(x, y) {
    const glider = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 1],
    ];

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (grid[x + i] && grid[x + i][y + j] !== undefined) {
          grid[x + i][y + j] = glider[j][i];
        }
      }
    }
  }

  function initGrid() {
    grid = new Array(cols).fill(null).map(() => new Array(rows).fill(0));
    nextGrid = new Array(cols).fill(null).map(() => new Array(rows).fill(0));

    const density = width < 640 ? 140 : 100;
    const numGliders = Math.floor((cols * rows) / density);
    for (let i = 0; i < numGliders; i++) {
      spawnGlider(
        Math.floor(Math.random() * Math.max(1, cols - 2)),
        Math.floor(Math.random() * Math.max(1, rows - 2))
      );
    }
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    cellSize = width < 640 ? 12 : 10;
    canvas.width = width;
    canvas.height = height;
    cols = Math.max(8, Math.ceil(width / cellSize));
    rows = Math.max(8, Math.ceil(height / cellSize));
    initGrid();
  }

  function countNeighbors(x, y) {
    let sum = 0;
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        const col = (x + i + cols) % cols;
        const row = (y + j + rows) % rows;
        sum += grid[col][row];
      }
    }
    sum -= grid[x][y];
    return sum;
  }

  function update() {
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const state = grid[i][j];
        const neighbors = countNeighbors(i, j);

        if (state === 0 && neighbors === 3) {
          nextGrid[i][j] = 1;
        } else if (state === 1 && (neighbors < 2 || neighbors > 3)) {
          nextGrid[i][j] = 0;
        } else {
          nextGrid[i][j] = state;
        }
      }
    }

    const temp = grid;
    grid = nextGrid;
    nextGrid = temp;
  }

  function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (grid[i][j] === 1) {
          ctx.fillRect(i * cellSize, j * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }
  }

  function loop(now) {
    if (running) {
      if (now - lastTick >= TICK_MS) {
        update();
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
  resizeCanvas();
  requestAnimationFrame(loop);
}
