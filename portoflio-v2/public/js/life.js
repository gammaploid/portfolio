// life.app: Conway's Game of Life on a small wrapped board. Cells born this generation
// show red. The board reseeds when it dies out or settles, and a click reseeds it too.
(function () {
    'use strict';

    const canvas = document.querySelector('[data-life]');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    const COLS = 64;
    const ROWS = 32;
    const CELL = 6;
    const STEP_MS = 130;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;

    let grid = new Uint8Array(COLS * ROWS);
    let born = new Uint8Array(COLS * ROWS);
    let recent = [];
    let generation = 0;
    let visible = false;
    let raf = 0;
    let last = 0;

    function seed() {
        for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < 0.3 ? 1 : 0;
        born.fill(0);
        recent = [];
        generation = 0;
        draw();
    }

    function step() {
        const next = new Uint8Array(grid.length);
        born = new Uint8Array(grid.length);
        for (let y = 0; y < ROWS; y++) {
            for (let x = 0; x < COLS; x++) {
                let n = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx || dy) n += grid[((y + dy + ROWS) % ROWS) * COLS + ((x + dx + COLS) % COLS)];
                    }
                }
                const i = y * COLS + x;
                next[i] = n === 3 || (n === 2 && grid[i]) ? 1 : 0;
                born[i] = next[i] && !grid[i] ? 1 : 0;
            }
        }
        grid = next;
        generation++;
        // Still lifes and blinkers repeat within two generations; start over when that happens.
        const key = grid.join('');
        if (recent.includes(key) || generation > 700 || !grid.includes(1)) {
            seed();
            return;
        }
        recent.push(key);
        if (recent.length > 2) recent.shift();
        draw();
    }

    function draw() {
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < grid.length; i++) {
            if (!grid[i]) continue;
            ctx.fillStyle = born[i] ? '#e5483f' : '#e7e4dd';
            ctx.fillRect((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL - 1, CELL - 1);
        }
    }

    function frame(now) {
        raf = 0;
        if (now - last > STEP_MS) {
            step();
            last = now;
        }
        if (visible) raf = requestAnimationFrame(frame);
    }

    canvas.addEventListener('click', seed);
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible && !raf && !reduced) raf = requestAnimationFrame(frame);
    }).observe(canvas);
    seed();
})();
