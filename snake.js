const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

const TICK_MS = 100;
const DIRS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

let width = 0;
let height = 0;
let cellSize = 14;
let cols = 0;
let rows = 0;
let snakes = [];
let foods = [];
let lastTick = 0;
let running = true;

function snakeCountForViewport() {
  return width < 640 ? 2 : width < 1100 ? 3 : 4;
}

function foodCountForViewport() {
  return Math.max(snakeCountForViewport() + 1, Math.floor((cols * rows) / 180));
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function occupiedSet(exceptSnake) {
  const occupied = new Set();
  for (const snake of snakes) {
    if (snake === exceptSnake || snake.dead) continue;
    for (const segment of snake.body) {
      occupied.add(keyOf(segment.x, segment.y));
    }
  }
  return occupied;
}

function randomEmptyCell(occupied) {
  const maxAttempts = cols * rows;
  for (let i = 0; i < maxAttempts; i++) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    const key = keyOf(x, y);
    if (!occupied.has(key) && !foods.some((f) => f.x === x && f.y === y)) {
      return { x, y };
    }
  }
  return null;
}

function spawnFood(occupied) {
  const cell = randomEmptyCell(occupied || occupiedSet());
  if (cell) foods.push(cell);
}

function ensureFood() {
  const target = foodCountForViewport();
  const occupied = occupiedSet();
  while (foods.length < target) {
    const before = foods.length;
    spawnFood(occupied);
    if (foods.length === before) break;
    const last = foods[foods.length - 1];
    occupied.add(keyOf(last.x, last.y));
  }
}

function createSnake(occupied) {
  const length = 3 + Math.floor(Math.random() * 3);
  const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
  const head = randomEmptyCell(occupied);
  if (!head) return null;

  const body = [head];
  occupied.add(keyOf(head.x, head.y));

  for (let i = 1; i < length; i++) {
    const prev = body[i - 1];
    const segment = {
      x: (prev.x - dir.x + cols) % cols,
      y: (prev.y - dir.y + rows) % rows,
    };
    const key = keyOf(segment.x, segment.y);
    if (occupied.has(key)) break;
    body.push(segment);
    occupied.add(key);
  }

  return {
    body,
    dir,
    dead: false,
    respawnAt: 0,
    hueShift: Math.random() * 0.15,
  };
}

function initWorld() {
  snakes = [];
  foods = [];
  const occupied = new Set();
  const count = snakeCountForViewport();

  for (let i = 0; i < count; i++) {
    const snake = createSnake(occupied);
    if (snake) snakes.push(snake);
  }

  ensureFood();
}

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  cellSize = width < 640 ? 16 : 14;
  canvas.width = width;
  canvas.height = height;
  cols = Math.max(8, Math.ceil(width / cellSize));
  rows = Math.max(8, Math.ceil(height / cellSize));
  initWorld();
}

function nearestFood(head) {
  let best = null;
  let bestDist = Infinity;
  for (const food of foods) {
    const dx = Math.min(Math.abs(food.x - head.x), cols - Math.abs(food.x - head.x));
    const dy = Math.min(Math.abs(food.y - head.y), rows - Math.abs(food.y - head.y));
    const dist = dx + dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = food;
    }
  }
  return best;
}

function isOpposite(a, b) {
  return a.x + b.x === 0 && a.y + b.y === 0;
}

function wrapped(x, y) {
  return {
    x: (x + cols) % cols,
    y: (y + rows) % rows,
  };
}

function chooseDirection(snake, occupied) {
  const head = snake.body[0];
  const food = nearestFood(head);
  const candidates = DIRS.filter((dir) => !isOpposite(dir, snake.dir));

  const scored = candidates.map((dir) => {
    const next = wrapped(head.x + dir.x, head.y + dir.y);
    const blocked = occupied.has(keyOf(next.x, next.y));
    let score = blocked ? -1000 : 0;

    if (food && !blocked) {
      const curDx = Math.min(Math.abs(food.x - head.x), cols - Math.abs(food.x - head.x));
      const curDy = Math.min(Math.abs(food.y - head.y), rows - Math.abs(food.y - head.y));
      const nextDx = Math.min(Math.abs(food.x - next.x), cols - Math.abs(food.x - next.x));
      const nextDy = Math.min(Math.abs(food.y - next.y), rows - Math.abs(food.y - next.y));
      score += (curDx + curDy) - (nextDx + nextDy);
      if (dir.x === snake.dir.x && dir.y === snake.dir.y) score += 0.15;
    } else if (!blocked && dir.x === snake.dir.x && dir.y === snake.dir.y) {
      score += 0.25;
    }

    score += Math.random() * 0.05;
    return { dir, next, blocked, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const pick = scored.find((option) => !option.blocked);
  return pick || null;
}

function killSnake(snake, now) {
  snake.dead = true;
  snake.body = [];
  snake.respawnAt = now + 800 + Math.random() * 1200;
}

function stepSnake(snake, now) {
  if (snake.dead) {
    if (now >= snake.respawnAt) {
      const occupied = occupiedSet();
      const fresh = createSnake(occupied);
      if (fresh) {
        snake.body = fresh.body;
        snake.dir = fresh.dir;
        snake.dead = false;
        snake.hueShift = fresh.hueShift;
      } else {
        snake.respawnAt = now + 500;
      }
    }
    return;
  }

  const occupied = occupiedSet(snake);
  // Reserve own body except tail (unless growing — handled after food check)
  for (let i = 0; i < snake.body.length - 1; i++) {
    occupied.add(keyOf(snake.body[i].x, snake.body[i].y));
  }

  const choice = chooseDirection(snake, occupied);
  if (!choice) {
    killSnake(snake, now);
    return;
  }

  snake.dir = choice.dir;
  const next = choice.next;
  const foodIndex = foods.findIndex((f) => f.x === next.x && f.y === next.y);
  const growing = foodIndex !== -1;

  if (!growing) {
    // Tail will move; allow stepping onto current tail
  } else {
    // Growing: cannot step on own tail
    for (const segment of snake.body) {
      if (segment.x === next.x && segment.y === next.y) {
        killSnake(snake, now);
        return;
      }
    }
  }

  snake.body.unshift(next);

  if (growing) {
    foods.splice(foodIndex, 1);
    ensureFood();
  } else {
    snake.body.pop();
  }

  // Soft length cap so snakes don't fill the screen
  const maxLen = Math.floor((cols * rows) / (snakes.length * 12));
  while (snake.body.length > Math.max(8, maxLen)) {
    snake.body.pop();
  }
}

function update(now) {
  for (const snake of snakes) {
    stepSnake(snake, now);
  }
  ensureFood();
}

function draw() {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  for (const food of foods) {
    ctx.fillStyle = 'rgba(0, 255, 0, 0.45)';
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      Math.max(2, cellSize * 0.28),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  for (const snake of snakes) {
    if (snake.dead || snake.body.length === 0) continue;
    const len = snake.body.length;
    for (let i = 0; i < len; i++) {
      const segment = snake.body[i];
      const t = 1 - i / len;
      const alpha = 0.12 + t * 0.22 + snake.hueShift * 0.1;
      ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
      const pad = i === 0 ? 1 : 2;
      ctx.fillRect(
        segment.x * cellSize + pad,
        segment.y * cellSize + pad,
        cellSize - pad * 2,
        cellSize - pad * 2
      );
    }
  }
}

function loop(now) {
  if (running) {
    if (now - lastTick >= TICK_MS) {
      update(now);
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
