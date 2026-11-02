const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
const pilotBtn = document.getElementById('pilot-btn');

const HIGH_SCORE_KEY = 'prajjwol_asteroids_hi';

let width = 0;
let height = 0;
let dpr = 1;
let running = true;
let lastTime = performance.now();

let stars = [];
let rocks = [];
let bullets = [];
let saucerBullets = [];
let sparks = [];
let lineDebris = [];
let ship = null;
let saucer = null;
let saucerCooldown = 12;
let fireCooldown = 0;
let hyperCooldown = 0;

// Game mode & player state
let playerMode = false;
let gameOver = false;
let score = 0;
let highScore = 0;
let lives = 3;
let wave = 1;
let nextExtraLifeScore = 10000;

try {
  highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10) || 0;
} catch (_) {
  highScore = 0;
}

const keys = {
  left: false,
  right: false,
  thrust: false,
  fire: false,
};

const pointer = {
  active: false,
  x: 0,
  y: 0,
};

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    try {
      localStorage.setItem(HIGH_SCORE_KEY, String(highScore));
    } catch (_) {
      // Ignore storage errors in private browsing
    }
  }
}

function addScore(pts) {
  if (!playerMode || gameOver) return;
  score += pts;
  if (score >= nextExtraLifeScore) {
    lives = Math.min(6, lives + 1);
    nextExtraLifeScore += 10000;
  }
  saveHighScore();
}

function makeRockVertices(radius, count) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const baseAngle = (Math.PI * 2 * i) / count;
    const angle = baseAngle + (Math.random() - 0.5) * (Math.PI / count) * 0.5;
    const jag = i % 2 === 0 ? 0.78 + Math.random() * 0.32 : 0.65 + Math.random() * 0.38;
    pts.push({ angle, r: radius * jag });
  }
  return pts;
}

function createRock(x, y, size = 3, inheritedVx = 0, inheritedVy = 0) {
  const radius = size === 3 ? 38 : size === 2 ? 22 : 12;
  const speedBoost = playerMode ? Math.min(1.45, 1 + (wave - 1) * 0.06) : 1;
  const speed = ((4 - size) * 28 + 18 + Math.random() * 34) * speedBoost;
  const dir = Math.random() * Math.PI * 2;
  const count = size === 3 ? 11 : size === 2 ? 9 : 7;
  return {
    x,
    y,
    vx: inheritedVx * 0.35 + Math.cos(dir) * speed,
    vy: inheritedVy * 0.35 + Math.sin(dir) * speed,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 1.5,
    size,
    r: radius,
    pts: makeRockVertices(radius, count),
  };
}

function initStars() {
  const count = Math.min(110, Math.floor((width * height) / 14000));
  stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.8 ? 1 : 1.5,
      baseAlpha: 0.06 + Math.random() * 0.16,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

function spawnWave() {
  rocks = [];
  const baseCount = width < 640 ? 4 : width < 1100 ? 6 : 8;
  const count = playerMode ? Math.min(12, baseCount + Math.floor((wave - 1) * 1.2)) : baseCount + 1;
  const safeX = ship ? ship.x : width / 2;
  const safeY = ship ? ship.y : height / 2;

  for (let i = 0; i < count; i++) {
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      const horizontalEdge = Math.random() < 0.5;
      x = horizontalEdge
        ? Math.random() * width
        : Math.random() < 0.5
          ? 30
          : width - 30;
      y = horizontalEdge
        ? Math.random() < 0.5
          ? 30
          : height - 30
        : Math.random() * height;
      if (Math.hypot(x - safeX, y - safeY) > 160) break;
    }
    rocks.push(createRock(x, y, 3));
  }
}

function resetShip(now = performance.now(), center = playerMode) {
  ship = {
    x: center ? width * 0.5 : width * 0.22,
    y: height * 0.55,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    r: 13,
    thrusting: false,
    alive: true,
    respawnAt: 0,
    invulnerableUntil: now + 1800,
  };
}

function startPlayerGame() {
  const now = performance.now();
  playerMode = true;
  gameOver = false;
  score = 0;
  lives = 3;
  wave = 1;
  nextExtraLifeScore = 10000;
  bullets = [];
  saucerBullets = [];
  saucer = null;
  saucerCooldown = 14;
  document.body.classList.add('is-playing');
  resetShip(now, true);
  spawnWave();
}

function stopPlayerGame() {
  playerMode = false;
  gameOver = false;
  keys.left = false;
  keys.right = false;
  keys.thrust = false;
  keys.fire = false;
  pointer.active = false;
  document.body.classList.remove('is-playing');
  if (!ship || !ship.alive) {
    resetShip(performance.now(), false);
  }
}

function spawnSaucer() {
  const fromLeft = Math.random() < 0.5;
  const small = Math.random() < (playerMode && score > 4000 ? 0.65 : 0.35);
  const r = small ? 11 : 16;
  const speed = small ? 115 : 85;
  saucer = {
    x: fromLeft ? -20 : width + 20,
    y: height * (0.18 + Math.random() * 0.65),
    vx: fromLeft ? speed : -speed,
    vy: (Math.random() < 0.5 ? -1 : 1) * 38,
    r,
    small,
    dirTimer: 1.2 + Math.random() * 1.4,
    fireTimer: 0.9 + Math.random() * 0.8,
  };
}

function initWorld() {
  bullets = [];
  saucerBullets = [];
  sparks = [];
  lineDebris = [];
  saucer = null;
  saucerCooldown = 10 + Math.random() * 8;
  fireCooldown = 0;
  initStars();
  resetShip(performance.now(), false);
  spawnWave();
}

function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!ship) {
    initWorld();
  } else {
    initStars();
  }
}

function wrapPos(obj, pad = 24) {
  if (obj.x < -pad) obj.x = width + pad;
  else if (obj.x > width + pad) obj.x = -pad;
  if (obj.y < -pad) obj.y = height + pad;
  else if (obj.y > height + pad) obj.y = -pad;
}

function torusDelta(a, b, span) {
  let d = b - a;
  if (d > span / 2) d -= span;
  if (d < -span / 2) d += span;
  return d;
}

function burstSparks(x, y, count = 10, speedScale = 1) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (25 + Math.random() * 85) * speedScale;
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.65 + Math.random() * 0.45,
      maxLife: 1.1,
    });
  }
}

function burstShipSegments(s) {
  const angles = [0, 2.45, -2.45];
  for (let i = 0; i < 3; i++) {
    const a1 = s.angle + angles[i];
    const a2 = s.angle + angles[(i + 1) % 3];
    const x1 = s.x + Math.cos(a1) * s.r;
    const y1 = s.y + Math.sin(a1) * s.r;
    const x2 = s.x + Math.cos(a2) * s.r;
    const y2 = s.y + Math.sin(a2) * s.r;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const segAngle = Math.atan2(y2 - y1, x2 - x1);
    const outAngle = Math.atan2(my - s.y, mx - s.x) + (Math.random() - 0.5) * 0.5;
    const spd = 25 + Math.random() * 45;
    lineDebris.push({
      x: mx,
      y: my,
      vx: s.vx * 0.3 + Math.cos(outAngle) * spd,
      vy: s.vy * 0.3 + Math.sin(outAngle) * spd,
      len,
      angle: segAngle,
      vrot: (Math.random() - 0.5) * 3.2,
      life: 1.1,
    });
  }
}

function fireShipBullet() {
  if (!ship || !ship.alive || bullets.length >= 6) return;
  const noseX = ship.x + Math.cos(ship.angle) * ship.r;
  const noseY = ship.y + Math.sin(ship.angle) * ship.r;
  bullets.push({
    x: noseX,
    y: noseY,
    vx: ship.vx * 0.45 + Math.cos(ship.angle) * 440,
    vy: ship.vy * 0.45 + Math.sin(ship.angle) * 440,
    life: 1.2,
  });
}

function hyperspaceJump(now = performance.now()) {
  if (!ship || !ship.alive || hyperCooldown > 0) return;
  burstSparks(ship.x, ship.y, 12, 0.8);
  ship.x = 60 + Math.random() * Math.max(100, width - 120);
  ship.y = 80 + Math.random() * Math.max(100, height - 160);
  ship.vx = 0;
  ship.vy = 0;
  ship.invulnerableUntil = now + 700;
  hyperCooldown = 1.2;
  burstSparks(ship.x, ship.y, 12, 0.8);
}

function destroyShip(now) {
  burstSparks(ship.x, ship.y, 16, 1.15);
  burstShipSegments(ship);
  ship.alive = false;
  ship.thrusting = false;

  if (playerMode) {
    lives -= 1;
    if (lives <= 0) {
      gameOver = true;
    } else {
      ship.respawnAt = now + 1600;
    }
  } else {
    ship.respawnAt = now + 1800;
  }
}

function isSafeToRespawn(x, y) {
  for (const r of rocks) {
    if (Math.hypot(r.x - x, r.y - y) < r.r + 75) return false;
  }
  return true;
}

function updatePlayerShip(dt, now) {
  if (gameOver) return;

  if (!ship.alive) {
    if (now >= ship.respawnAt) {
      const spawnX = width * 0.5;
      const spawnY = height * 0.55;
      if (isSafeToRespawn(spawnX, spawnY) || now >= ship.respawnAt + 2000) {
        resetShip(now, true);
      }
    }
    return;
  }

  hyperCooldown = Math.max(0, hyperCooldown - dt);

  const turnSpeed = 4.5;
  if (keys.left) ship.angle -= turnSpeed * dt;
  if (keys.right) ship.angle += turnSpeed * dt;

  // Pointer/touch steering support
  if (pointer.active) {
    const dx = pointer.x - ship.x;
    const dy = pointer.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - ship.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ship.angle += Math.max(-turnSpeed * 1.3 * dt, Math.min(turnSpeed * 1.3 * dt, diff));
    ship.thrusting = dist > 48;
  } else {
    ship.thrusting = keys.thrust;
  }

  if (ship.thrusting) {
    ship.vx += Math.cos(ship.angle) * 210 * dt;
    ship.vy += Math.sin(ship.angle) * 210 * dt;
  }

  ship.vx *= Math.pow(0.988, dt * 60);
  ship.vy *= Math.pow(0.988, dt * 60);
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > 280) {
    ship.vx = (ship.vx / spd) * 280;
    ship.vy = (ship.vy / spd) * 280;
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrapPos(ship, 18);

  fireCooldown = Math.max(0, fireCooldown - dt);
  if ((keys.fire || pointer.active) && fireCooldown <= 0) {
    fireShipBullet();
    fireCooldown = 0.16;
  }
}

function updateAutopilotShip(dt, now) {
  if (!ship.alive) {
    if (now >= ship.respawnAt) {
      resetShip(now, false);
    }
    return;
  }

  let bestTarget = null;
  let bestTargetScore = Infinity;
  let evadeX = 0;
  let evadeY = 0;

  for (const r of rocks) {
    const dx = torusDelta(ship.x, r.x, width);
    const dy = torusDelta(ship.y, r.y, height);
    const dist = Math.hypot(dx, dy);

    const rvx = r.vx - ship.vx;
    const rvy = r.vy - ship.vy;
    const relSpeedSq = rvx * rvx + rvy * rvy;
    let tca = 0;
    if (relSpeedSq > 1) {
      tca = Math.max(0, Math.min(1.4, -(dx * rvx + dy * rvy) / relSpeedSq));
    }
    const futureDx = dx + rvx * tca;
    const futureDy = dy + rvy * tca;
    const futureDist = Math.hypot(futureDx, futureDy);
    const dangerRadius = r.r + 88;

    if (futureDist < dangerRadius && futureDist > 0.1) {
      const urgency = Math.pow((dangerRadius - futureDist) / dangerRadius, 1.3);
      evadeX -= (futureDx / futureDist) * urgency * 1.5;
      evadeY -= (futureDy / futureDist) * urgency * 1.5;
    }

    const targetScore = dist - (4 - r.size) * 18;
    if (targetScore < bestTargetScore) {
      bestTargetScore = targetScore;
      bestTarget = { x: r.x, y: r.y, vx: r.vx, vy: r.vy, dx, dy, dist };
    }
  }

  if (saucer) {
    const dx = torusDelta(ship.x, saucer.x, width);
    const dy = torusDelta(ship.y, saucer.y, height);
    const dist = Math.hypot(dx, dy);
    if (dist < bestTargetScore + 120) {
      bestTarget = { x: saucer.x, y: saucer.y, vx: saucer.vx, vy: saucer.vy, dx, dy, dist };
    }
  }

  for (const sb of saucerBullets) {
    const dx = torusDelta(ship.x, sb.x, width);
    const dy = torusDelta(ship.y, sb.y, height);
    const dist = Math.hypot(dx, dy);
    if (dist < 130 && dist > 1) {
      const weight = (130 - dist) / 130;
      evadeX -= (dx / dist) * weight * 2.2;
      evadeY -= (dy / dist) * weight * 2.2;
    }
  }

  let desiredAngle = ship.angle;
  const evadeMag = Math.hypot(evadeX, evadeY);

  if (evadeMag > 0.28) {
    desiredAngle = Math.atan2(evadeY, evadeX);
    ship.thrusting = true;
  } else if (bestTarget) {
    const bulletSpeed = 440;
    const leadT = Math.min(1.15, bestTarget.dist / bulletSpeed);
    const aimX = bestTarget.dx + (bestTarget.vx - ship.vx) * leadT;
    const aimY = bestTarget.dy + (bestTarget.vy - ship.vy) * leadT;
    desiredAngle = Math.atan2(aimY, aimX);
    ship.thrusting = bestTarget.dist > 360 && Math.hypot(ship.vx, ship.vy) < 95;
  } else {
    ship.thrusting = false;
  }

  let angleDiff = desiredAngle - ship.angle;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  const turnSpeed = 5.0;
  ship.angle += Math.max(-turnSpeed * dt, Math.min(turnSpeed * dt, angleDiff));

  if (ship.thrusting && Math.abs(angleDiff) < 1.35) {
    ship.vx += Math.cos(ship.angle) * 165 * dt;
    ship.vy += Math.sin(ship.angle) * 165 * dt;
  }

  ship.vx *= Math.pow(0.986, dt * 60);
  ship.vy *= Math.pow(0.986, dt * 60);
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > 205) {
    ship.vx = (ship.vx / spd) * 205;
    ship.vy = (ship.vy / spd) * 205;
  }

  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrapPos(ship, 18);

  fireCooldown -= dt;
  if (
    bestTarget &&
    Math.abs(angleDiff) < 0.28 &&
    fireCooldown <= 0 &&
    bullets.length < 5
  ) {
    fireShipBullet();
    fireCooldown = 0.22 + Math.random() * 0.1;
  }
}

function updateSaucer(dt) {
  if (!saucer) {
    saucerCooldown -= dt;
    if (saucerCooldown <= 0) {
      spawnSaucer();
      saucerCooldown = 14 + Math.random() * 12;
    }
    return;
  }

  saucer.x += saucer.vx * dt;
  saucer.y += saucer.vy * dt;
  if (saucer.y < 30) saucer.y = height - 30;
  else if (saucer.y > height - 30) saucer.y = 30;

  saucer.dirTimer -= dt;
  if (saucer.dirTimer <= 0) {
    saucer.dirTimer = 1.0 + Math.random() * 1.5;
    const dirs = [-45, 0, 45];
    saucer.vy = dirs[Math.floor(Math.random() * dirs.length)];
  }

  saucer.fireTimer -= dt;
  if (saucer.fireTimer <= 0 && ship && ship.alive) {
    saucer.fireTimer = 1.1 + Math.random() * 0.9;
    const aimAngle =
      Math.atan2(ship.y - saucer.y, ship.x - saucer.x) +
      (Math.random() - 0.5) * (saucer.small ? 0.25 : 0.65);
    saucerBullets.push({
      x: saucer.x,
      y: saucer.y,
      vx: Math.cos(aimAngle) * 260,
      vy: Math.sin(aimAngle) * 260,
      life: 1.5,
    });
  }

  if (saucer.x < -40 || saucer.x > width + 40) {
    saucer = null;
  }
}

function update(dt, now) {
  if (rocks.length === 0) {
    wave += 1;
    spawnWave();
  }

  if (playerMode) {
    updatePlayerShip(dt, now);
  } else {
    updateAutopilotShip(dt, now);
  }

  updateSaucer(dt);

  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    wrapPos(b, 4);
  }
  bullets = bullets.filter((b) => b.life > 0);

  for (const sb of saucerBullets) {
    sb.x += sb.vx * dt;
    sb.y += sb.vy * dt;
    sb.life -= dt;
    wrapPos(sb, 4);
  }
  saucerBullets = saucerBullets.filter((sb) => sb.life > 0);

  for (const r of rocks) {
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.rot += r.vrot * dt;
    wrapPos(r, r.r);
  }

  // Bullets vs asteroids
  const nextRocks = [];
  for (const r of rocks) {
    let hitBullet = null;
    for (const b of bullets) {
      if (b.life <= 0) continue;
      if (Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
        hitBullet = b;
        break;
      }
    }
    if (hitBullet) {
      hitBullet.life = 0;
      addScore(r.size === 3 ? 20 : r.size === 2 ? 50 : 100);
      burstSparks(r.x, r.y, r.size * 4);
      if (r.size > 1) {
        nextRocks.push(createRock(r.x, r.y, r.size - 1, r.vx, r.vy));
        nextRocks.push(createRock(r.x, r.y, r.size - 1, r.vx, r.vy));
      }
    } else {
      nextRocks.push(r);
    }
  }
  rocks = nextRocks;

  if (saucer) {
    for (const b of bullets) {
      if (b.life <= 0) continue;
      if (Math.hypot(b.x - saucer.x, b.y - saucer.y) < saucer.r + 3) {
        b.life = 0;
        addScore(saucer.small ? 1000 : 200);
        burstSparks(saucer.x, saucer.y, 16, 1.2);
        saucer = null;
        break;
      }
    }
  }
  bullets = bullets.filter((b) => b.life > 0);

  // Collisions with ship
  if (ship.alive && now >= ship.invulnerableUntil) {
    for (let i = 0; i < rocks.length; i++) {
      const r = rocks[i];
      if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + ship.r * 0.68) {
        // Also split the rock that hit the ship
        rocks.splice(i, 1);
        if (r.size > 1) {
          rocks.push(createRock(r.x, r.y, r.size - 1, r.vx, r.vy));
          rocks.push(createRock(r.x, r.y, r.size - 1, r.vx, r.vy));
        }
        destroyShip(now);
        break;
      }
    }
  }

  if (ship.alive && now >= ship.invulnerableUntil) {
    for (const sb of saucerBullets) {
      if (Math.hypot(ship.x - sb.x, ship.y - sb.y) < ship.r * 0.8) {
        sb.life = 0;
        destroyShip(now);
        break;
      }
    }
  }

  for (const s of sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  }
  sparks = sparks.filter((s) => s.life > 0);

  for (const seg of lineDebris) {
    seg.x += seg.vx * dt;
    seg.y += seg.vy * dt;
    seg.angle += seg.vrot * dt;
    seg.life -= dt * 0.75;
  }
  lineDebris = lineDebris.filter((seg) => seg.life > 0);
}

function drawSaucer(s) {
  ctx.strokeStyle = playerMode ? 'rgba(0, 255, 102, 0.65)' : 'rgba(0, 255, 102, 0.42)';
  ctx.lineWidth = 1.3;
  const r = s.r;
  const h = r * 0.55;

  ctx.beginPath();
  ctx.moveTo(s.x - r, s.y);
  ctx.lineTo(s.x - r * 0.45, s.y - h * 0.6);
  ctx.lineTo(s.x + r * 0.45, s.y - h * 0.6);
  ctx.lineTo(s.x + r, s.y);
  ctx.lineTo(s.x + r * 0.55, s.y + h * 0.65);
  ctx.lineTo(s.x - r * 0.55, s.y + h * 0.65);
  ctx.closePath();
  ctx.moveTo(s.x - r, s.y);
  ctx.lineTo(s.x + r, s.y);
  ctx.moveTo(s.x - r * 0.35, s.y - h * 0.6);
  ctx.lineTo(s.x - r * 0.2, s.y - h * 1.25);
  ctx.lineTo(s.x + r * 0.2, s.y - h * 1.25);
  ctx.lineTo(s.x + r * 0.35, s.y - h * 0.6);
  ctx.stroke();
}

function drawMiniShip(x, y, r = 8) {
  const angle = -Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  ctx.lineTo(x + Math.cos(angle + 2.45) * r, y + Math.sin(angle + 2.45) * r);
  ctx.lineTo(x - Math.cos(angle) * (r * 0.45), y - Math.sin(angle) * (r * 0.45));
  ctx.lineTo(x + Math.cos(angle - 2.45) * r, y + Math.sin(angle - 2.45) * r);
  ctx.closePath();
  ctx.stroke();
}

function drawHUD() {
  if (!playerMode) return;

  ctx.save();
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillStyle = 'rgba(0, 255, 102, 0.85)';
  ctx.textBaseline = 'top';

  const padX = Math.max(20, width * 0.03);
  const topY = 20;

  // Score & High Score on top-left and top-right
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(score).padStart(5, '0')}`, padX, topY);

  ctx.strokeStyle = 'rgba(0, 255, 102, 0.78)';
  ctx.lineWidth = 1.25;
  for (let i = 0; i < lives; i++) {
    drawMiniShip(padX + 8 + i * 20, topY + 32, 7.5);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0, 255, 102, 0.55)';
  ctx.fillText(`HI ${String(highScore).padStart(5, '0')}`, width - padX, topY);
  ctx.fillText(`WAVE ${String(wave).padStart(2, '0')}`, width - padX, topY + 22);

  if (gameOver) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(2, 6, 4, 0.72)';
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.35)';
    ctx.lineWidth = 1;
    const boxW = Math.min(360, width - 40);
    const boxH = 136;
    ctx.fillRect(width / 2 - boxW / 2, height / 2 - boxH / 2, boxW, boxH);
    ctx.strokeRect(width / 2 - boxW / 2, height / 2 - boxH / 2, boxW, boxH);

    ctx.font = '500 22px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#00ff66';
    ctx.fillText('GAME OVER', width / 2, height / 2 - 28);

    ctx.font = '400 13px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(0, 255, 102, 0.75)';
    ctx.fillText(`FINAL SCORE: ${score}`, width / 2, height / 2 + 4);

    ctx.font = '400 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(0, 255, 102, 0.55)';
    ctx.fillText('[ SPACE / CLICK: PLAY AGAIN ]   [ ESC: AUTOPILOT ]', width / 2, height / 2 + 36);
  }

  ctx.restore();
}

function draw(now) {
  ctx.fillStyle = '#020503';
  ctx.fillRect(0, 0, width, height);

  // Twinkling starfield
  for (const st of stars) {
    const twinkle = st.baseAlpha + Math.sin(now * 0.0015 + st.phase) * 0.04;
    ctx.fillStyle = `rgba(0, 255, 102, ${Math.max(0.02, twinkle)})`;
    ctx.fillRect(st.x, st.y, st.size, st.size);
  }

  // Wireframe asteroids
  ctx.strokeStyle = playerMode ? 'rgba(0, 255, 102, 0.5)' : 'rgba(0, 255, 102, 0.3)';
  ctx.lineWidth = 1.3;
  for (const r of rocks) {
    ctx.beginPath();
    for (let i = 0; i < r.pts.length; i++) {
      const pt = r.pts[i];
      const px = r.x + Math.cos(pt.angle + r.rot) * pt.r;
      const py = r.y + Math.sin(pt.angle + r.rot) * pt.r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  if (saucer) {
    drawSaucer(saucer);
  }

  // Vector ship
  if (ship && ship.alive) {
    const invuln = now < ship.invulnerableUntil;
    const baseAlpha = playerMode ? 0.92 : 0.55;
    const pulse = invuln ? 0.25 + Math.abs(Math.sin(now * 0.018)) * 0.45 : baseAlpha;
    ctx.strokeStyle = playerMode ? `rgba(125, 255, 179, ${pulse})` : `rgba(0, 255, 102, ${pulse})`;
    ctx.lineWidth = playerMode ? 1.65 : 1.45;
    ctx.beginPath();
    const noseX = ship.x + Math.cos(ship.angle) * ship.r;
    const noseY = ship.y + Math.sin(ship.angle) * ship.r;
    const leftX = ship.x + Math.cos(ship.angle + 2.45) * ship.r;
    const leftY = ship.y + Math.sin(ship.angle + 2.45) * ship.r;
    const rightX = ship.x + Math.cos(ship.angle - 2.45) * ship.r;
    const rightY = ship.y + Math.sin(ship.angle - 2.45) * ship.r;
    const backX = ship.x - Math.cos(ship.angle) * (ship.r * 0.45);
    const backY = ship.y - Math.sin(ship.angle) * (ship.r * 0.45);
    ctx.moveTo(noseX, noseY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(backX, backY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    ctx.stroke();

    if (ship.thrusting) {
      ctx.strokeStyle = 'rgba(125, 255, 179, 0.65)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      const flameLen = ship.r * (0.95 + Math.random() * 0.45);
      const flameX = ship.x - Math.cos(ship.angle) * flameLen;
      const flameY = ship.y - Math.sin(ship.angle) * flameLen;
      ctx.moveTo(
        ship.x + Math.cos(ship.angle + 2.75) * (ship.r * 0.55),
        ship.y + Math.sin(ship.angle + 2.75) * (ship.r * 0.55)
      );
      ctx.lineTo(flameX, flameY);
      ctx.lineTo(
        ship.x + Math.cos(ship.angle - 2.75) * (ship.r * 0.55),
        ship.y + Math.sin(ship.angle - 2.75) * (ship.r * 0.55)
      );
      ctx.stroke();
    }
  }

  // Disintegrating vector line segments
  for (const seg of lineDebris) {
    ctx.strokeStyle = `rgba(0, 255, 102, ${0.55 * Math.max(0, seg.life)})`;
    ctx.lineWidth = 1.25;
    const dx = (Math.cos(seg.angle) * seg.len) / 2;
    const dy = (Math.sin(seg.angle) * seg.len) / 2;
    ctx.beginPath();
    ctx.moveTo(seg.x - dx, seg.y - dy);
    ctx.lineTo(seg.x + dx, seg.y + dy);
    ctx.stroke();
  }

  // Bullets
  ctx.fillStyle = 'rgba(125, 255, 179, 0.85)';
  for (const b of bullets) {
    ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
  }

  ctx.fillStyle = 'rgba(0, 255, 102, 0.6)';
  for (const sb of saucerBullets) {
    ctx.fillRect(sb.x - 1.5, sb.y - 1.5, 3, 3);
  }

  // Sparks
  for (const s of sparks) {
    const alpha = 0.5 * Math.max(0, s.life / s.maxLife);
    ctx.fillStyle = `rgba(0, 255, 102, ${alpha})`;
    ctx.fillRect(s.x - 1, s.y - 1, 2, 2);
  }

  drawHUD();
}

function loop(now) {
  if (running) {
    const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
    lastTime = now;
    update(dt, now);
    draw(now);
  }
  requestAnimationFrame(loop);
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.code === 'Escape') {
    if (playerMode) {
      e.preventDefault();
      stopPlayerGame();
    }
    return;
  }

  const isGameKey =
    e.code === 'ArrowLeft' ||
    e.code === 'KeyA' ||
    e.code === 'ArrowRight' ||
    e.code === 'KeyD' ||
    e.code === 'ArrowUp' ||
    e.code === 'KeyW' ||
    e.code === 'Space' ||
    e.code === 'ShiftLeft' ||
    e.code === 'ShiftRight' ||
    e.code === 'ArrowDown' ||
    e.code === 'KeyS';

  if (!isGameKey) return;
  e.preventDefault();

  if (!playerMode || gameOver) {
    startPlayerGame();
  }

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = true;
  if (e.code === 'Space') {
    if (!keys.fire && fireCooldown <= 0) {
      fireShipBullet();
      fireCooldown = 0.16;
    }
    keys.fire = true;
  }
  if (
    e.code === 'ShiftLeft' ||
    e.code === 'ShiftRight' ||
    e.code === 'ArrowDown' ||
    e.code === 'KeyS'
  ) {
    hyperspaceJump();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.thrust = false;
  if (e.code === 'Space') keys.fire = false;
});

if (pilotBtn) {
  pilotBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (playerMode) {
      stopPlayerGame();
    } else {
      startPlayerGame();
    }
    pilotBtn.blur();
  });
}

// Pointer / touch controls on canvas
window.addEventListener('pointerdown', (e) => {
  if (e.target && e.target.closest && e.target.closest('.hero')) return;

  if (!playerMode || gameOver) {
    startPlayerGame();
  }

  pointer.active = true;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  if (fireCooldown <= 0) {
    fireShipBullet();
    fireCooldown = 0.16;
  }
});

window.addEventListener('pointermove', (e) => {
  if (!pointer.active) return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});

window.addEventListener('pointerup', () => {
  pointer.active = false;
});

window.addEventListener('pointercancel', () => {
  pointer.active = false;
});

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) lastTime = performance.now();
});

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
requestAnimationFrame(loop);
