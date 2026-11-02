const TICK_MS = 110;
const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function start(canvas) {
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let cell = 16;
  let cols = 0;
  let rows = 0;
  let walls = [];
  let dots = [];
  let pac = null;
  let ghosts = [];
  let lastTick = 0;
  let running = true;
  let mouth = 0;

  function keyOf(x, y) {
    return `${x},${y}`;
  }

  function inBounds(x, y) {
    return x >= 0 && y >= 0 && x < cols && y < rows;
  }

  function isWall(x, y) {
    if (!inBounds(x, y)) return true;
    return walls[y][x] === 1;
  }

  function buildMaze() {
    // Bordered maze with a sparse pillar pattern + a few corridors
    walls = Array.from({ length: rows }, () => Array(cols).fill(0));
    dots = [];

    for (let x = 0; x < cols; x++) {
      walls[0][x] = 1;
      walls[rows - 1][x] = 1;
    }
    for (let y = 0; y < rows; y++) {
      walls[y][0] = 1;
      walls[y][cols - 1] = 1;
    }

    for (let y = 2; y < rows - 2; y += 2) {
      for (let x = 2; x < cols - 2; x += 2) {
        if (Math.random() < 0.55) {
          walls[y][x] = 1;
          // occasional wall stubs
          const dir = DIRS[Math.floor(Math.random() * 4)];
          const nx = x + dir.x;
          const ny = y + dir.y;
          if (inBounds(nx, ny) && nx > 0 && ny > 0 && nx < cols - 1 && ny < rows - 1) {
            walls[ny][nx] = 1;
          }
        }
      }
    }

    // Ensure tunnels near edges for wrap-like feel (open mid sides)
    const midY = Math.floor(rows / 2);
    walls[midY][0] = 0;
    walls[midY][cols - 1] = 0;
    walls[midY][1] = 0;
    walls[midY][cols - 2] = 0;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (walls[y][x] === 0) {
          dots.push({ x, y, on: true });
        }
      }
    }
  }

  function randomOpenCell() {
    for (let i = 0; i < 200; i++) {
      const x = 1 + Math.floor(Math.random() * (cols - 2));
      const y = 1 + Math.floor(Math.random() * (rows - 2));
      if (!isWall(x, y)) return { x, y };
    }
    return { x: 1, y: 1 };
  }

  function initActors() {
    const start = randomOpenCell();
    pac = {
      x: start.x,
      y: start.y,
      dir: DIRS[0],
    };

    const ghostCount = width < 640 ? 2 : 3;
    ghosts = [];
    for (let i = 0; i < ghostCount; i++) {
      const g = randomOpenCell();
      ghosts.push({
        x: g.x,
        y: g.y,
        dir: DIRS[Math.floor(Math.random() * 4)],
        mode: Math.random() < 0.5 ? 'chase' : 'wander',
        modeUntil: performance.now() + 2000 + Math.random() * 3000,
      });
    }
  }

  function refillDotsIfNeeded() {
    if (dots.every((d) => !d.on)) {
      for (const d of dots) d.on = true;
    }
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    cell = width < 640 ? 18 : 16;
    canvas.width = width;
    canvas.height = height;
    cols = Math.max(15, Math.floor(width / cell));
    rows = Math.max(11, Math.floor(height / cell));
    // keep odd sizes for nicer pillar grid
    if (cols % 2 === 0) cols -= 1;
    if (rows % 2 === 0) rows -= 1;
    buildMaze();
    initActors();
  }

  function wrap(x, y) {
    let nx = x;
    let ny = y;
    if (nx < 0) nx = cols - 1;
    if (nx >= cols) nx = 0;
    if (ny < 0) ny = rows - 1;
    if (ny >= rows) ny = 0;
    return { x: nx, y: ny };
  }

  function openDirs(x, y, current, allowReverse) {
    return DIRS.filter((dir) => {
      if (!allowReverse && current && dir.x + current.x === 0 && dir.y + current.y === 0) {
        // allow reverse only if no other option
      }
      const next = wrap(x + dir.x, y + dir.y);
      return !isWall(next.x, next.y);
    });
  }

  function choosePacDir() {
    // Prefer nearest remaining dot; bias current direction
    let target = null;
    let best = Infinity;
    for (const d of dots) {
      if (!d.on) continue;
      const dist = Math.abs(d.x - pac.x) + Math.abs(d.y - pac.y);
      if (dist < best) {
        best = dist;
        target = d;
      }
    }

    let options = openDirs(pac.x, pac.y, pac.dir, false);
    if (!options.length) options = openDirs(pac.x, pac.y, pac.dir, true);
    if (!options.length) return pac.dir;

    if (!target) return options[Math.floor(Math.random() * options.length)];

    options.sort((a, b) => {
      const na = wrap(pac.x + a.x, pac.y + a.y);
      const nb = wrap(pac.x + b.x, pac.y + b.y);
      const da = Math.abs(target.x - na.x) + Math.abs(target.y - na.y);
      const db = Math.abs(target.x - nb.x) + Math.abs(target.y - nb.y);
      const biasA = a.x === pac.dir.x && a.y === pac.dir.y ? -0.2 : 0;
      const biasB = b.x === pac.dir.x && b.y === pac.dir.y ? -0.2 : 0;
      return da + biasA - (db + biasB);
    });
    return options[0];
  }

  function chooseGhostDir(ghost) {
    if (performance.now() > ghost.modeUntil) {
      ghost.mode = ghost.mode === 'chase' ? 'wander' : 'chase';
      ghost.modeUntil = performance.now() + 2500 + Math.random() * 3500;
    }

    let options = openDirs(ghost.x, ghost.y, ghost.dir, false);
    if (!options.length) options = openDirs(ghost.x, ghost.y, ghost.dir, true);
    if (!options.length) return ghost.dir;

    if (ghost.mode === 'wander' || Math.random() < 0.15) {
      return options[Math.floor(Math.random() * options.length)];
    }

    options.sort((a, b) => {
      const na = wrap(ghost.x + a.x, ghost.y + a.y);
      const nb = wrap(ghost.x + b.x, ghost.y + b.y);
      const da = Math.abs(pac.x - na.x) + Math.abs(pac.y - na.y);
      const db = Math.abs(pac.x - nb.x) + Math.abs(pac.y - nb.y);
      return da - db;
    });
    return options[0];
  }

  function step() {
    pac.dir = choosePacDir();
    const pn = wrap(pac.x + pac.dir.x, pac.y + pac.dir.y);
    if (!isWall(pn.x, pn.y)) {
      pac.x = pn.x;
      pac.y = pn.y;
    }

    for (const d of dots) {
      if (d.on && d.x === pac.x && d.y === pac.y) d.on = false;
    }
    refillDotsIfNeeded();

    for (const g of ghosts) {
      g.dir = chooseGhostDir(g);
      const gn = wrap(g.x + g.dir.x, g.y + g.dir.y);
      if (!isWall(gn.x, gn.y)) {
        g.x = gn.x;
        g.y = gn.y;
      }

      if (g.x === pac.x && g.y === pac.y) {
        // Soft reset actors, keep maze
        initActors();
        break;
      }
    }

    mouth += 0.35;
  }

  function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const ox = Math.floor((width - cols * cell) / 2);
    const oy = Math.floor((height - rows * cell) / 2);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (walls[y][x] === 1) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.12)';
          ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
        }
      }
    }

    for (const d of dots) {
      if (!d.on) continue;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(ox + d.x * cell + cell / 2, oy + d.y * cell + cell / 2, Math.max(1.5, cell * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }

    // Pac
    const px = ox + pac.x * cell + cell / 2;
    const py = oy + pac.y * cell + cell / 2;
    const r = cell * 0.38;
    const open = 0.25 + Math.abs(Math.sin(mouth)) * 0.35;
    let start = open;
    let end = Math.PI * 2 - open;
    if (pac.dir.x === 1) {
      start = open;
      end = Math.PI * 2 - open;
    } else if (pac.dir.x === -1) {
      start = Math.PI + open;
      end = Math.PI - open;
    } else if (pac.dir.y === -1) {
      start = -Math.PI / 2 + open;
      end = -Math.PI / 2 - open;
    } else {
      start = Math.PI / 2 + open;
      end = Math.PI / 2 - open;
    }
    ctx.fillStyle = 'rgba(0, 255, 0, 0.45)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, r, start, end, false);
    ctx.closePath();
    ctx.fill();

    for (const g of ghosts) {
      const gx = ox + g.x * cell + cell / 2;
      const gy = oy + g.y * cell + cell / 2;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.28)';
      ctx.beginPath();
      ctx.arc(gx, gy - 1, r * 0.9, Math.PI, 0);
      ctx.lineTo(gx + r * 0.9, gy + r * 0.7);
      ctx.lineTo(gx + r * 0.45, gy + r * 0.35);
      ctx.lineTo(gx, gy + r * 0.7);
      ctx.lineTo(gx - r * 0.45, gy + r * 0.35);
      ctx.lineTo(gx - r * 0.9, gy + r * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  function loop(now) {
    if (running) {
      if (now - lastTick >= TICK_MS) {
        step();
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
