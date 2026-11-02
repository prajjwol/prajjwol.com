const GAMES = {
  snake: './games/snake.js',
  life: './games/life.js',
  galaga: './games/galaga.js',
  pacman: './games/pacman.js',
  tetris: './games/tetris.js',
};

const NAMES = Object.keys(GAMES);

const canvas = document.getElementById('bg-canvas');
if (!canvas) {
  throw new Error('Missing #bg-canvas');
}

function pickGame() {
  const params = new URLSearchParams(window.location.search);
  const requested = (params.get('game') || '').toLowerCase().trim();
  if (requested && GAMES[requested]) {
    return requested;
  }
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

const name = pickGame();
const path = GAMES[name];

import(path)
  .then((mod) => {
    if (typeof mod.start !== 'function') {
      throw new Error(`${path} must export start(canvas)`);
    }
    mod.start(canvas);
  })
  .catch((err) => {
    console.error('Failed to load ambient game', name, err);
  });
