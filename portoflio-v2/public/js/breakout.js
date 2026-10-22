// Brick breaker on the award numerals: the lit pixels are the bricks. "3rd" is played with a
// paddle along the bottom, "2×" with one up the right side. A game starts only when the
// pointer reaches that side, pauses when it leaves, and the numeral prints itself again after
// a win, a loss or a few idle seconds. Mouse and trackpad only: touch screens and reduced
// motion keep the still numerals, and the CSS lanes use the same conditions.
(function () {
    'use strict';

    const canPlay = matchMedia('(hover: hover) and (pointer: fine)').matches
        && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canPlay) return;

    const PAPER = '#e7e4dd';
    const DIM = 'rgba(231, 228, 221, 0.18)';
    const STEP = 1 / 120;
    const ROWS = 7;
    const LIVES = 3;
    const MAX_ANGLE = 1.05;
    const IDLE_RESET = 5000;

    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    // The game runs in (u, v): u along the paddle, v toward it. For the right-hand paddle
    // that is the page's (y, x), so one set of rules plays both sides.
    function setUp(wrap) {
        const grid = wrap.querySelector('.pix');
        const cells = grid ? [...grid.children] : [];
        if (cells.length < ROWS * 2) return;
        const swap = wrap.dataset.game === 'right';
        const cols = cells.length / ROWS;
        const nu = swap ? ROWS : cols;
        const nv = swap ? cols : ROWS;
        const index = (iu, iv) => (swap ? iu * cols + iv : iv * cols + iu);

        const canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        wrap.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const accent = getComputedStyle(wrap).getPropertyValue('--accent').trim() || '#e58ca1';

        const g = { lane: 0 };
        const alive = new Uint8Array(cells.length);
        const ball = { u: 0, v: 0, du: 0, dv: 0 };
        const paddle = { u: 0, target: 0 };
        const pointer = { u: 0, v: 0, inside: false };
        let state = 'rest';
        let resumeTo = 'serve';
        let lives = LIVES;
        let standing = 0;
        let speed = 0;
        let serveAt = 0;
        let dpr = 1;
        let raf = 0;
        let last = 0;
        let acc = 0;
        let visible = false;
        let timer = 0;

        // rest: nothing drawn. peek: pointer over the numeral, the paddle waits in its lane.
        // serve, play: a game. pause: pointer left mid-game. reset: the numeral reprints.
        function setState(next) {
            state = next;
            wrap.dataset.state = next;
            wrap.classList.toggle('is-playing', next === 'serve' || next === 'play');
        }

        function measure() {
            const wr = wrap.getBoundingClientRect();
            const gr = grid.getBoundingClientRect();
            const a = cells[0].getBoundingClientRect();
            const b = cells[1].getBoundingClientRect();
            g.ox = gr.left - wr.left;
            g.oy = gr.top - wr.top;
            g.size = a.width;
            g.pitch = b.left - a.left;
            g.lane = parseFloat(getComputedStyle(wrap).getPropertyValue('--lane')) || 0;
            g.U = swap ? gr.height : gr.width;
            g.edge = swap ? gr.width : gr.height;
            g.V = g.edge + g.lane;
            g.ball = Math.max(6, Math.round(g.size * 0.5));
            g.thick = Math.max(6, Math.round(g.size * 0.34));
            g.len = Math.round(g.pitch * (swap ? 2.6 : 4));
            g.face = Math.round(g.edge + g.lane * 0.5);
            g.speed = g.pitch * 9;
            g.w = wr.width;
            g.h = wr.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(wr.width * dpr);
            canvas.height = Math.round(wr.height * dpr);
        }

        function countBricks() {
            standing = 0;
            cells.forEach((cell, k) => {
                alive[k] = cell.classList.contains('on') ? 1 : 0;
                standing += alive[k];
            });
        }

        // Every brick comes back. On screen the numeral prints itself again; offscreen, instantly.
        function restore(reprint) {
            grid.classList.add('is-resetting');
            if (reprint) grid.classList.remove('is-printed');
            cells.forEach(cell => cell.classList.remove('gone'));
            void grid.offsetWidth;
            grid.classList.remove('is-resetting');
            if (reprint) {
                wrap.classList.remove('is-printing');
                void wrap.offsetWidth;
                wrap.classList.add('is-printing');
                grid.classList.add('is-printed');
            }
            countBricks();
            lives = LIVES;
        }

        function breakBrick(k) {
            alive[k] = 0;
            standing--;
            cells[k].classList.add('gone');
        }

        function bricksUnderBall() {
            const p = g.pitch;
            const b = g.ball;
            const found = [];
            const u1 = Math.min(nu - 1, Math.floor((ball.u + b) / p));
            const v1 = Math.min(nv - 1, Math.floor((ball.v + b) / p));
            for (let iv = Math.max(0, Math.floor(ball.v / p)); iv <= v1; iv++) {
                for (let iu = Math.max(0, Math.floor(ball.u / p)); iu <= u1; iu++) {
                    const k = index(iu, iv);
                    // A brick fills its cell but not the gap after it.
                    if (alive[k] && ball.u < iu * p + g.size && ball.v < iv * p + g.size) found.push(k);
                }
            }
            return found;
        }

        // Move along one axis at a time, so a brick hit reverses exactly the axis that met it.
        function move(axis, dt) {
            const d = axis === 'u' ? ball.du : ball.dv;
            ball[axis] += d * dt;
            const found = bricksUnderBall();
            if (!found.length) return;
            found.forEach(breakBrick);
            ball[axis] -= d * dt;
            if (axis === 'u') ball.du = -ball.du;
            else ball.dv = -ball.dv;
        }

        function step(dt) {
            move('u', dt);
            move('v', dt);
            const b = g.ball;
            if (ball.u < 0) {
                ball.u = 0;
                ball.du = Math.abs(ball.du);
            }
            if (ball.u + b > g.U) {
                ball.u = g.U - b;
                ball.du = -Math.abs(ball.du);
            }
            if (ball.v < 0) {
                ball.v = 0;
                ball.dv = Math.abs(ball.dv);
            }
            const overPaddle = ball.u + b >= paddle.u && ball.u <= paddle.u + g.len;
            if (ball.dv > 0 && overPaddle && ball.v + b >= g.face && ball.v <= g.face + g.thick) {
                // Where the ball meets the paddle sets the angle it leaves at.
                const off = clamp((ball.u + b / 2 - (paddle.u + g.len / 2)) / (g.len / 2), -1, 1);
                speed = Math.min(speed * 1.01, g.speed * 1.45);
                ball.du = Math.sin(off * MAX_ANGLE) * speed;
                ball.dv = -Math.cos(off * MAX_ANGLE) * speed;
                ball.v = g.face - b - 0.5;
            }
            if (!standing) finish();
            else if (ball.v > g.V) miss();
        }

        function placeOnPaddle() {
            ball.u = paddle.u + (g.len - g.ball) / 2;
            ball.v = g.face - g.ball - 1;
        }

        function serve(delay) {
            setState('serve');
            serveAt = performance.now() + delay;
            placeOnPaddle();
        }

        function launch() {
            const a = (0.2 + Math.random() * 0.5) * (Math.random() < 0.5 ? -1 : 1);
            ball.du = Math.sin(a) * speed;
            ball.dv = -Math.cos(a) * speed;
            setState('play');
        }

        function miss() {
            lives--;
            if (lives > 0) serve(700);
            else finish();
        }

        // Win or lose, the bricks come back and the numeral prints itself again.
        function finish() {
            clearTimeout(timer);
            setState('reset');
            draw();
            timer = setTimeout(() => {
                restore(true);
                timer = setTimeout(() => setState(pointer.inside ? 'peek' : 'rest'), 1300);
            }, 450);
        }

        function start() {
            clearTimeout(timer);
            if (state === 'pause') {
                if (resumeTo === 'play') setState('play');
                else serve(500);
                return;
            }
            lives = LIVES;
            speed = g.speed;
            paddle.u = paddle.target;
            serve(450);
        }

        function pause() {
            resumeTo = state;
            setState('pause');
            clearTimeout(timer);
            timer = setTimeout(finish, IDLE_RESET);
        }

        // Rectangles are given in (u, v) and drawn in page coordinates, snapped to whole pixels.
        function rect(u, v, lu, lv) {
            const x = g.ox + (swap ? v : u);
            const y = g.oy + (swap ? u : v);
            ctx.fillRect(Math.round(x), Math.round(y), Math.round(swap ? lv : lu), Math.round(swap ? lu : lv));
        }

        function draw() {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, g.w, g.h);
            if (state === 'rest' || state === 'reset') return;
            const live = state === 'serve' || state === 'play';
            if (state !== 'peek') {
                // The arena's walls, and the lives left in the lane's far corner.
                ctx.strokeStyle = 'rgba(231, 228, 221, 0.16)';
                ctx.setLineDash([3, 4]);
                ctx.strokeRect(Math.round(g.ox) + 0.5, Math.round(g.oy) + 0.5,
                    Math.round(swap ? g.V : g.U) - 1, Math.round(swap ? g.U : g.V) - 1);
                ctx.setLineDash([]);
                for (let k = 0; k < LIVES; k++) {
                    ctx.fillStyle = k < lives ? PAPER : DIM;
                    rect(g.U - (k + 1) * 11, g.V - 10, 6, 6);
                }
            }
            ctx.globalAlpha = live ? 1 : 0.4;
            ctx.fillStyle = accent;
            rect(paddle.u, g.face, g.len, g.thick);
            if (state !== 'peek') {
                ctx.fillStyle = PAPER;
                rect(ball.u, ball.v, g.ball, g.ball);
            }
            ctx.globalAlpha = 1;
        }

        function frame(now) {
            raf = 0;
            const dt = last ? Math.min((now - last) / 1000, 4 * STEP) : 0;
            last = now;
            if (state === 'serve' || state === 'play' || state === 'peek') {
                paddle.u += (paddle.target - paddle.u) * 0.45;
            }
            if (state === 'serve') {
                placeOnPaddle();
                if (now >= serveAt) launch();
            } else if (state === 'play') {
                acc += dt;
                for (let n = 0; acc >= STEP && n < 8 && state === 'play'; n++) {
                    step(STEP);
                    acc -= STEP;
                }
                acc = Math.min(acc, STEP);
            }
            draw();
            const easing = Math.abs(paddle.target - paddle.u) > 0.3;
            if (state === 'serve' || state === 'play' || (state === 'peek' && easing)) request();
            else last = 0;
        }

        function request() {
            if (!raf && visible) raf = requestAnimationFrame(frame);
        }

        function locate(e) {
            const r = wrap.getBoundingClientRect();
            const x = e.clientX - r.left - g.ox;
            const y = e.clientY - r.top - g.oy;
            pointer.u = swap ? y : x;
            pointer.v = swap ? x : y;
        }

        const inLane = () => pointer.v >= g.edge && pointer.v <= g.V && pointer.u >= 0 && pointer.u <= g.U;

        wrap.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch' || !g.lane) return;
            locate(e);
            pointer.inside = true;
            paddle.target = clamp(pointer.u - g.len / 2, 0, g.U - g.len);
            if (state === 'rest') {
                paddle.u = paddle.target;
                setState('peek');
            }
            const printed = grid.classList.contains('is-printed');
            if ((state === 'peek' || state === 'pause') && printed && inLane()) start();
            request();
        });

        wrap.addEventListener('pointerleave', () => {
            pointer.inside = false;
            if (state === 'serve' || state === 'play') pause();
            else if (state === 'peek') setState('rest');
            request();
        });

        new ResizeObserver(() => {
            measure();
            if (state === 'serve' || state === 'play' || state === 'pause') {
                clearTimeout(timer);
                restore(false);
                setState(pointer.inside ? 'peek' : 'rest');
            }
            paddle.target = clamp(paddle.target, 0, Math.max(0, g.U - g.len));
            paddle.u = clamp(paddle.u, 0, Math.max(0, g.U - g.len));
            draw();
        }).observe(wrap);

        // Leaving the screen ends any game, so the numeral is whole when it comes back.
        new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (!visible && state !== 'rest') {
                clearTimeout(timer);
                if (state !== 'peek') restore(false);
                pointer.inside = false;
                setState('rest');
                draw();
            }
            request();
        }).observe(wrap);

        countBricks();
        setState('rest');
    }

    document.querySelectorAll('.pix-wrap[data-game]').forEach(setUp);
})();
