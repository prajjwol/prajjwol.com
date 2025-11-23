const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let cellSize = 10;
let cols, rows;
let grid;
let nextGrid;

function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    cols = Math.ceil(width / cellSize);
    rows = Math.ceil(height / cellSize);
    initGrid();
}

function initGrid() {
    grid = new Array(cols).fill(null).map(() => new Array(rows).fill(0));
    nextGrid = new Array(cols).fill(null).map(() => new Array(rows).fill(0));

    // Spawn gliders randomly
    const numGliders = Math.floor((cols * rows) / 100); // Density
    for (let i = 0; i < numGliders; i++) {
        spawnGlider(Math.floor(Math.random() * (cols - 2)), Math.floor(Math.random() * (rows - 2)));
    }
}

function spawnGlider(x, y) {
    // Standard Glider pattern
    // . O .
    // . . O
    // O O O
    const glider = [
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1]
    ];

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[x + i] && grid[x + i][y + j] !== undefined) {
                grid[x + i][y + j] = glider[j][i];
            }
        }
    }
}

function update() {
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            const state = grid[i][j];
            const neighbors = countNeighbors(grid, i, j);

            if (state == 0 && neighbors == 3) {
                nextGrid[i][j] = 1;
            } else if (state == 1 && (neighbors < 2 || neighbors > 3)) {
                nextGrid[i][j] = 0;
            } else {
                nextGrid[i][j] = state;
            }
        }
    }

    // Swap grids
    let temp = grid;
    grid = nextGrid;
    nextGrid = temp;
}

function countNeighbors(grid, x, y) {
    let sum = 0;
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            let col = (x + i + cols) % cols;
            let row = (y + j + rows) % rows;
            sum += grid[col][row];
        }
    }
    sum -= grid[x][y];
    return sum;
}

function draw() {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#00FF00'; // Green color
    for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
            if (grid[i][j] == 1) {
                ctx.fillRect(i * cellSize, j * cellSize, cellSize - 1, cellSize - 1);
            }
        }
    }
}

function loop() {
    update();
    draw();
    setTimeout(() => requestAnimationFrame(loop), 100); // Control speed
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
loop();
