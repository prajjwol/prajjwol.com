const TICK_MS = 32;

export function start(canvas) {
  const ctx = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let running = true;
  let lastTick = 0;
  let ship = null;
  let enemies = [];
  let bullets = [];
  let enemyBullets = [];
  let explosions = [];
  let fireCooldown = 0;
  let wave = 0;

  function enemyCount() {
    return width < 640 ? 8 : width < 1100 ? 12 : 16;
  }

  function resetWave() {
    wave += 1;
    enemies = [];
    bullets = [];
    enemyBullets = [];
    explosions = [];
    fireCooldown = 0;

    const count = enemyCount();
    const cols = Math.min(8, count);
    const rows = Math.ceil(count / cols);
    const spacingX = Math.min(56, width / (cols + 1));
    const startX = (width - spacingX * (cols - 1)) / 2;
    const startY = Math.max(40, height * 0.08);

    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      enemies.push({
        homeX: startX + c * spacingX,
        homeY: startY + r * 36,
        x: startX + c * spacingX,
        y: startY + r * 36 - 80 - r * 20,
        w: 18,
        h: 14,
        diving: false,
        diveT: 0,
        diveDir: Math.random() < 0.5 ? -1 : 1,
        alive: true,
        enter: true,
      });
    }

    ship = {
      x: width / 2,
      y: height - 48,
      w: 22,
      h: 16,
      vx: 0,
      alive: true,
      respawnAt: 0,
    };
  }

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    wave = 0;
    resetWave();
  }

  function hit(a, b) {
    return (
      a.x - a.w / 2 < b.x + b.w / 2 &&
      a.x + a.w / 2 > b.x - b.w / 2 &&
      a.y - a.h / 2 < b.y + b.h / 2 &&
      a.y + a.h / 2 > b.y - b.h / 2
    );
  }

  function explode(x, y) {
    explosions.push({ x, y, life: 1 });
  }

  function update(dt) {
    if (!ship.alive) {
      if (performance.now() >= ship.respawnAt) {
        resetWave();
      }
      return;
    }

    // Formation sway + dive AI
    const sway = Math.sin(performance.now() / 900) * 18;
    let living = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      living += 1;

      if (e.enter) {
        e.y += 60 * dt;
        if (e.y >= e.homeY) {
          e.y = e.homeY;
          e.enter = false;
        }
        e.x = e.homeX + sway;
        continue;
      }

      if (!e.diving && Math.random() < 0.0008 * living) {
        e.diving = true;
        e.diveT = 0;
        e.diveDir = ship.x < e.x ? -1 : 1;
      }

      if (e.diving) {
        e.diveT += dt;
        e.x += e.diveDir * 90 * dt;
        e.y += 110 * dt;
        if (e.y > height + 40) {
          e.diving = false;
          e.x = e.homeX;
          e.y = e.homeY - 40;
          e.enter = true;
        }
        if (Math.random() < 0.01) {
          enemyBullets.push({ x: e.x, y: e.y + e.h / 2, w: 3, h: 8, vy: 160 });
        }
      } else {
        e.x = e.homeX + sway;
        e.y = e.homeY + Math.sin(performance.now() / 700 + e.homeX) * 4;
      }
    }

    if (living === 0) {
      resetWave();
      return;
    }

    // Ship AI: track nearest diving enemy or formation center, fire
    let targetX = width / 2;
    const divers = enemies.filter((e) => e.alive && e.diving);
    if (divers.length) {
      divers.sort((a, b) => b.y - a.y);
      targetX = divers[0].x;
    } else {
      const alive = enemies.filter((e) => e.alive);
      targetX = alive.reduce((s, e) => s + e.x, 0) / alive.length;
    }

    const dx = targetX - ship.x;
    ship.vx = Math.max(-220, Math.min(220, dx * 3));
    ship.x += ship.vx * dt;
    ship.x = Math.max(20, Math.min(width - 20, ship.x));

    fireCooldown -= dt;
    if (fireCooldown <= 0) {
      bullets.push({ x: ship.x, y: ship.y - ship.h / 2, w: 3, h: 10, vy: -280 });
      fireCooldown = 0.28 + Math.random() * 0.12;
    }

    for (const b of bullets) b.y += b.vy * dt;
    for (const b of enemyBullets) b.y += b.vy * dt;
    bullets = bullets.filter((b) => b.y > -20);
    enemyBullets = enemyBullets.filter((b) => b.y < height + 20);

    for (const b of bullets) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (hit(b, e)) {
          e.alive = false;
          b.y = -999;
          explode(e.x, e.y);
        }
      }
    }
    bullets = bullets.filter((b) => b.y > -20);

    for (const b of enemyBullets) {
      if (hit(b, ship)) {
        explode(ship.x, ship.y);
        ship.alive = false;
        ship.respawnAt = performance.now() + 1200;
        b.y = height + 999;
      }
    }

    for (const e of enemies) {
      if (e.alive && hit(e, ship)) {
        e.alive = false;
        explode(ship.x, ship.y);
        explode(e.x, e.y);
        ship.alive = false;
        ship.respawnAt = performance.now() + 1200;
      }
    }

    for (const ex of explosions) ex.life -= dt * 2.2;
    explosions = explosions.filter((ex) => ex.life > 0);
  }

  function drawShip(x, y, w, h, alpha) {
    ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.lineTo(x, y + h / 4);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(e) {
    ctx.fillStyle = e.diving ? 'rgba(0, 255, 0, 0.35)' : 'rgba(0, 255, 0, 0.22)';
    ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h * 0.45);
    ctx.fillRect(e.x - e.w * 0.2, e.y - e.h * 0.1, e.w * 0.4, e.h * 0.6);
  }

  function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    for (const e of enemies) {
      if (e.alive) drawEnemy(e);
    }

    if (ship.alive) {
      drawShip(ship.x, ship.y, ship.w, ship.h, 0.4);
    }

    ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
    for (const b of bullets) {
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }
    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
    for (const b of enemyBullets) {
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    }

    for (const ex of explosions) {
      ctx.fillStyle = `rgba(0, 255, 0, ${0.35 * ex.life})`;
      const r = 8 + (1 - ex.life) * 16;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(now) {
    if (running) {
      if (now - lastTick >= TICK_MS) {
        const dt = Math.min(0.05, (now - lastTick) / 1000);
        update(dt);
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
