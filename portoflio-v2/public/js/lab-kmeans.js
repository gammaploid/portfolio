// Lab: live k-means. Points live in board units (0 to 1) so they survive resizes;
// distances are scaled by the board's aspect ratio so groups match what you see.
(function () {
    'use strict';

    const canvas = document.querySelector('[data-lab-canvas]');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    const PALETTE = ['#a481ff', '#3ccfae', '#e5483f', '#e7e4dd', '#f0b44c', '#6fb6ff'];
    const MAX_POINTS = 1200;
    const STEP_MS = 420;
    const REGION_CELL = 14;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const out = {
        points: document.querySelector('[data-lab-points]'),
        iter: document.querySelector('[data-lab-iter]'),
        status: document.querySelector('[data-lab-status]'),
    };

    let W = 0;
    let H = 0;
    let dpr = 1;
    let points = [];
    let cents = [];
    let k = 3;
    let iter = 0;
    let settled = true;
    let visible = false;
    let raf = 0;
    let lastStep = 0;

    const aspect = () => (H ? W / H : 1);
    const dist2 = (ax, ay, bx, by) => {
        const dx = (ax - bx) * aspect();
        const dy = ay - by;
        return dx * dx + dy * dy;
    };
    const gauss = () => {
        let u = 0;
        let v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    function addPoint(x, y) {
        if (points.length >= MAX_POINTS) points.shift();
        points.push({ x: Math.min(0.99, Math.max(0.01, x)), y: Math.min(0.99, Math.max(0.01, y)), c: -1 });
    }

    function newData() {
        points = [];
        const blobs = 3 + Math.floor(Math.random() * 3);
        for (let b = 0; b < blobs; b++) {
            const cx = 0.14 + Math.random() * 0.72;
            const cy = 0.18 + Math.random() * 0.64;
            const sx = 0.025 + Math.random() * 0.05;
            const sy = 0.05 + Math.random() * 0.08;
            const n = 35 + Math.floor(Math.random() * 40);
            for (let i = 0; i < n; i++) addPoint(cx + gauss() * sx, cy + gauss() * sy);
        }
        seed();
    }

    // k-means++ start: each new centroid is picked with odds proportional to its squared distance.
    function seed() {
        cents = [];
        iter = 0;
        points.forEach(p => (p.c = -1));
        if (points.length < k) {
            settled = true;
            report();
            request();
            return;
        }
        const first = points[Math.floor(Math.random() * points.length)];
        cents.push({ x: first.x, y: first.y, tx: first.x, ty: first.y });
        while (cents.length < k) {
            const d = points.map(p => Math.min(...cents.map(c => dist2(p.x, p.y, c.tx, c.ty))));
            let pick = Math.random() * d.reduce((a, b) => a + b, 0);
            let i = 0;
            while (i < d.length - 1 && (pick -= d[i]) > 0) i++;
            cents.push({ x: points[i].x, y: points[i].y, tx: points[i].x, ty: points[i].y });
        }
        settled = false;
        report();
        emit('lab:seed', { k, n: points.length });
        request();
    }

    // The log window in terminal.js listens for these.
    function emit(type, detail) {
        canvas.dispatchEvent(new CustomEvent(type, { detail }));
    }

    // One Lloyd iteration: assign every point, then move each centroid to its group's mean.
    function step() {
        let changed = 0;
        for (const p of points) {
            let best = 0;
            let bestD = Infinity;
            cents.forEach((c, i) => {
                const d = dist2(p.x, p.y, c.tx, c.ty);
                if (d < bestD) {
                    bestD = d;
                    best = i;
                }
            });
            if (p.c !== best) {
                p.c = best;
                changed++;
            }
        }
        const sums = cents.map(() => ({ x: 0, y: 0, n: 0 }));
        points.forEach(p => {
            sums[p.c].x += p.x;
            sums[p.c].y += p.y;
            sums[p.c].n++;
        });
        let shift = 0;
        cents.forEach((c, i) => {
            let nx;
            let ny;
            if (sums[i].n) {
                nx = sums[i].x / sums[i].n;
                ny = sums[i].y / sums[i].n;
            } else {
                // An empty group restarts at the point that fits its own group worst.
                const worst = points.reduce((a, p) => {
                    const d = dist2(p.x, p.y, cents[p.c].tx, cents[p.c].ty);
                    return d > a.d ? { p, d } : a;
                }, { p: points[0], d: -1 }).p;
                nx = worst.x;
                ny = worst.y;
                changed++;
            }
            shift += Math.abs(nx - c.tx) + Math.abs(ny - c.ty);
            c.tx = nx;
            c.ty = ny;
        });
        iter++;
        settled = changed === 0 && shift < 1e-4;
        const inertia = points.reduce((sum, p) => sum + dist2(p.x, p.y, cents[p.c].tx, cents[p.c].ty), 0) / points.length;
        report();
        emit('lab:step', { iter, moved: changed, inertia, settled });
    }

    function report() {
        out.points.textContent = points.length;
        out.iter.textContent = iter;
        out.status.textContent = points.length < k ? 'add points' : settled ? 'settled' : 'moving';
    }

    function draw() {
        if (!W || !H) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);

        if (cents.length === k && points.length >= k) {
            const regions = cents.map(() => new Path2D());
            for (let y = 0; y < H; y += REGION_CELL) {
                for (let x = 0; x < W; x += REGION_CELL) {
                    const ux = (x + REGION_CELL / 2) / W;
                    const uy = (y + REGION_CELL / 2) / H;
                    let best = 0;
                    let bestD = Infinity;
                    for (let i = 0; i < cents.length; i++) {
                        const d = dist2(ux, uy, cents[i].x, cents[i].y);
                        if (d < bestD) {
                            bestD = d;
                            best = i;
                        }
                    }
                    regions[best].rect(x, y, REGION_CELL, REGION_CELL);
                }
            }
            ctx.globalAlpha = 0.09;
            regions.forEach((path, i) => {
                ctx.fillStyle = PALETTE[i];
                ctx.fill(path);
            });
            ctx.globalAlpha = 1;
        }

        for (let group = -1; group < cents.length; group++) {
            ctx.beginPath();
            for (const p of points) {
                if (p.c !== group) continue;
                ctx.rect(p.x * W - 3, p.y * H - 3, 6, 6);
            }
            ctx.fillStyle = group < 0 ? 'rgba(231, 228, 221, 0.6)' : PALETTE[group];
            ctx.fill();
        }

        cents.forEach((c, i) => {
            const x = c.x * W;
            const y = c.y * H;
            ctx.fillStyle = '#121212';
            ctx.fillRect(x - 10, y - 10, 20, 20);
            ctx.lineWidth = 2;
            ctx.strokeStyle = PALETTE[i];
            ctx.strokeRect(x - 10, y - 10, 20, 20);
            ctx.beginPath();
            ctx.moveTo(x - 4, y);
            ctx.lineTo(x + 4, y);
            ctx.moveTo(x, y - 4);
            ctx.lineTo(x, y + 4);
            ctx.stroke();
        });

        if (!points.length) {
            ctx.fillStyle = '#a29f97';
            ctx.font = '16.5px "Departure Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Click anywhere to add points', W / 2, H / 2);
        }
    }

    function frame(now) {
        raf = 0;
        if (reduced) {
            let guard = 0;
            while (!settled && points.length >= k && guard++ < 100) step();
            cents.forEach(c => {
                c.x = c.tx;
                c.y = c.ty;
            });
            draw();
            return;
        }
        if (!settled && points.length >= k && now - lastStep > STEP_MS) {
            step();
            lastStep = now;
        }
        let moving = false;
        cents.forEach(c => {
            c.x += (c.tx - c.x) * 0.2;
            c.y += (c.ty - c.y) * 0.2;
            if (Math.abs(c.tx - c.x) + Math.abs(c.ty - c.y) > 1e-4) moving = true;
            else {
                c.x = c.tx;
                c.y = c.ty;
            }
        });
        draw();
        if (visible && (moving || !settled)) request();
    }

    function request() {
        if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function changed() {
        if (cents.length < k && points.length >= k) {
            seed();
            return;
        }
        settled = false;
        report();
        request();
    }

    // Mouse and pen paint while held; a touch only adds points on a tap, so swiping still scrolls.
    let painting = false;
    let lastPaint = 0;
    let touchStart = null;
    const toUnit = e => {
        const r = canvas.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const burst = (x, y) => {
        for (let i = 0; i < 6; i++) addPoint(x + (gauss() * 16) / W, y + (gauss() * 16) / H);
        changed();
    };

    canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'touch') {
            touchStart = [e.clientX, e.clientY];
            return;
        }
        painting = true;
        canvas.setPointerCapture(e.pointerId);
        burst(...toUnit(e));
    });
    canvas.addEventListener('pointermove', e => {
        if (!painting || e.timeStamp - lastPaint < 28) return;
        lastPaint = e.timeStamp;
        const [x, y] = toUnit(e);
        addPoint(x + (gauss() * 10) / W, y + (gauss() * 10) / H);
        changed();
    });
    canvas.addEventListener('pointerup', e => {
        painting = false;
        if (e.pointerType === 'touch' && touchStart && Math.hypot(e.clientX - touchStart[0], e.clientY - touchStart[1]) < 10) {
            burst(...toUnit(e));
        }
        touchStart = null;
    });
    canvas.addEventListener('pointercancel', () => {
        painting = false;
        touchStart = null;
    });

    document.querySelectorAll('input[name="lab-k"]').forEach(input => {
        input.addEventListener('change', () => {
            k = Number(input.value);
            seed();
        });
    });
    const newButton = document.querySelector('[data-lab-new]');
    const clearButton = document.querySelector('[data-lab-clear]');
    if (newButton) newButton.addEventListener('click', newData);
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            points = [];
            cents = [];
            iter = 0;
            settled = true;
            report();
            emit('lab:clear', {});
            request();
        });
    }

    function resize() {
        const r = canvas.getBoundingClientRect();
        W = r.width;
        H = r.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        draw();
    }

    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        request();
    }).observe(canvas);

    const checked = document.querySelector('input[name="lab-k"]:checked');
    if (checked) k = Number(checked.value);
    resize();
    newData();
})();
