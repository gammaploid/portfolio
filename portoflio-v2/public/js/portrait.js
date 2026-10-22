// Hero portrait: Hassan's photo as a field of digits. Face and thobe are 0 and 1, the
// shemagh is Arabic ٠ and ١ in red. The cursor decodes the digits into plain text, a click
// sends a pulse through them, and scrolling scatters them back into noise.
// Tone comes from js/portrait-data.js (scripts/make_portrait.py), so it works from disk too.
(function () {
    'use strict';

    const canvas = document.querySelector('[data-portrait]');
    const hero = canvas && canvas.closest('.hero');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    const source = window.HASSAN_PORTRAIT;
    if (!ctx || !hero || !source) return;

    // Atlas rows: paper, shemagh red, teal (decoded text and pulses) and fog grey.
    const COLOURS = ['#e7e4dd', '#e5483f', '#3ccfae', '#a29f97'];
    const PAPER = 0;
    const SHEMAGH = 1;
    const TEAL = 2;
    const NOISE = 3;
    const LATIN = '0123456789abcdefABCDEFGHIJKLMNOPQRSTUVWXYZ.,';
    // Arabic-Indic zero and one on Departure Mono's 7 x 10 cell, so both scripts share a grid.
    const AR_ZERO = LATIN.length;
    const AR_ONE = LATIN.length + 1;
    const ARABIC = [[[3, 3], [2, 4], [3, 4], [4, 4], [3, 5]], [[2, 1], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [3, 7]]];
    const MESSAGE = 'HASSAN ALMOSA. MACHINE LEARNING ENGINEER. DAMMAM, SAUDI ARABIA. STRUCTURE FROM UNSTRUCTURED DATA. ';
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const readout = document.querySelector('[data-decoder-read]');
    const idle = readout ? readout.textContent : '';

    let W = 0;
    let H = 0;
    let dpr = 1;
    let unit = 1;
    let cw = 7;
    let ch = 10;
    let cols = 0;
    let box = null;
    let atlas = null;
    let sw = 7;
    let sh = 10;
    let hexRamp = [];
    let points = [];
    let mode = '01';
    let t0 = 0;
    let introEnd = 0;
    let scatter = 0;
    let drawnScatter = -1;
    let running = false;
    let visible = true;
    let lastFlicker = 0;
    let LENS = 120;
    let scrambleUntil = 0;
    let settling = false;
    let painted = false;
    let flipping = [];
    const rings = [];
    const lens = { x: 0, y: 0, on: false, k: 0, until: 0, moved: false };

    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => {
        const x = clamp01((v - a) / (b - a));
        return x * x * (3 - 2 * x);
    };
    const easeInOut = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const randomDigit = () => (Math.random() < 0.5 ? 0 : 1);

    // Departure Mono is drawn on an 11px grid: 11px, or 22/3px on 3x phones, keeps it crisp.
    function measure() {
        dpr = Math.min(window.devicePixelRatio || 1, 3);
        const fontPx = W < 900 && dpr >= 3 ? 22 / 3 : 11;
        unit = fontPx / 11;
        cw = 7 * unit;
        ch = 10 * unit;
        sw = Math.round(cw * dpr);
        sh = Math.round(ch * dpr);
        return fontPx;
    }

    function buildAtlas(fontPx) {
        atlas = document.createElement('canvas');
        atlas.width = sw * (LATIN.length + 2);
        atlas.height = sh * COLOURS.length;
        const a = atlas.getContext('2d', { willReadFrequently: true });
        a.font = `${fontPx * dpr}px "Departure Mono", ui-monospace, monospace`;
        a.textBaseline = 'alphabetic';
        const px = unit * dpr;
        COLOURS.forEach((colour, row) => {
            a.fillStyle = colour;
            [...LATIN].forEach((glyph, i) => a.fillText(glyph, i * sw + px, row * sh + 8 * px));
            ARABIC.forEach((cells, j) => {
                cells.forEach(([x, y]) => a.fillRect((LATIN.length + j) * sw + x * px, row * sh + y * px, px, px));
            });
        });
        // Order the hex digits by how much ink they carry, so brighter cells get heavier glyphs.
        const ink = i => {
            const d = a.getImageData(i * sw, 0, sw, sh).data;
            let n = 0;
            for (let k = 3; k < d.length; k += 4) n += d[k] > 127 ? 1 : 0;
            return n;
        };
        hexRamp = [...Array(16).keys()].sort((x, y) => ink(x) - ink(y));
    }

    // Right half on wide screens, standing on the hero's floor. On phones it sits above the
    // text, and the hero reserves its height through --portrait-h so the two never overlap.
    function frameBox() {
        const aspect = source.w / source.h;
        if (W >= 900) {
            const h = Math.min(H * 0.9, (W * 0.44) / aspect);
            return { x: Math.round(W - Math.max(W * 0.05, 40) - h * aspect), y: Math.round(H - h), w: h * aspect, h, fadeFrom: 0.58 };
        }
        const h = phoneHeight();
        return { x: Math.round((W - h * aspect) / 2), y: 52, w: h * aspect, h, fadeFrom: 0.62 };
    }

    function phoneHeight() {
        return Math.round(Math.min(window.innerHeight * 0.5, (W * 0.94) / (source.w / source.h)));
    }

    function glyphFor(p) {
        if (p.red || mode === 'ar') return p.t > 0.42 ? AR_ONE : AR_ZERO;
        if (mode === 'hex') return hexRamp[Math.min(15, Math.floor(p.t * 16))];
        return p.t > 0.42 ? 0 : 1;
    }

    // Average the source cells under one glyph: tone, subject coverage and shemagh share.
    function sample(r, c, fx, fy) {
        let tone = 0;
        let inside = 0;
        let red = 0;
        let area = 0;
        const y0 = Math.floor(r * fy);
        const x0 = Math.floor(c * fx);
        for (let y = y0; y < Math.max(y0 + 1, Math.floor((r + 1) * fy)); y++) {
            for (let x = x0; x < Math.max(x0 + 1, Math.floor((c + 1) * fx)); x++) {
                area++;
                const v = B64.indexOf(source.data[y * source.w + x]) - 1;
                if (v < 0) continue;
                inside++;
                tone += (v >> 1) / 30;
                red += v & 1;
            }
        }
        return inside < area / 2 ? null : { tone: tone / inside, red: red / inside > 0.35 };
    }

    function build(formed) {
        W = Math.round(canvas.getBoundingClientRect().width);
        if (W < 900) hero.style.setProperty('--portrait-h', `${phoneHeight()}px`);
        else hero.style.removeProperty('--portrait-h');
        H = Math.round(canvas.getBoundingClientRect().height);
        if (!W || !H) return;
        const fontPx = measure();
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        buildAtlas(fontPx);
        box = frameBox();
        LENS = W < 900 ? 92 : 120;
        cols = Math.floor(box.w / cw);
        const rows = Math.floor(box.h / ch);
        const fx = source.w / cols;
        const fy = source.h / rows;

        points = [];
        introEnd = 0;
        for (let r = 0; r < rows; r++) {
            const yN = r / rows;
            const fade = yN > box.fadeFrom ? Math.pow(Math.max(0, (1 - yN) / (1 - box.fadeFrom)), 1.4) : 1;
            for (let c = 0; c < cols; c++) {
                const cell = sample(r, c, fx, fy);
                if (!cell) continue;
                // Lift contrast and hold back the brightest tones so the white thobe stays textured.
                let t = Math.pow(cell.tone, 1.4);
                if (t > 0.7) t = 0.7 + (t - 0.7) * 0.4;
                t *= fade;
                if (t < 0.035) continue;

                const hx = box.x + c * cw;
                const hy = box.y + r * ch;
                const ax = Math.random() * W;
                const ay = Math.random() * H;
                const bend = (Math.random() - 0.5) * 0.9;
                const delay = 0.1 + yN * 0.75 + Math.random() * 0.5;
                const dur = 0.7 + Math.random() * 0.6;
                introEnd = Math.max(introEnd, delay + dur);
                const p = {
                    hx, hy, ax, ay, delay, dur, t, row: r, col: c,
                    cx: (ax + hx) / 2 - (hy - ay) * bend,
                    cy: (ay + hy) / 2 + (hx - ax) * bend,
                    red: cell.red,
                    base: 0.06 + 0.94 * t,
                    leave: Math.random() * 0.6,
                    fly: randomDigit(),
                    flip: 0, flipGlyph: 0,
                    ox: 0, oy: 0, vx: 0, vy: 0,
                };
                p.glyph = glyphFor(p);
                points.push(p);
            }
        }
        canvas.dataset.grid = `${cols}x${rows}`;
        canvas.dataset.glyphs = points.length;
        // A short pause first, so the word is decoded before the answer starts to arrive.
        t0 = performance.now() + (formed || reduced ? -(introEnd + 1) * 1000 : 450);
        drawnScatter = -1;
        painted = false;
        request();
    }

    function setMode(next) {
        mode = next;
        const now = performance.now();
        scrambleUntil = now + 700;
        for (const p of points) {
            p.glyph = glyphFor(p);
            if (!reduced) {
                p.flip = now + 120 + Math.random() * 520;
                p.flipGlyph = Math.floor(Math.random() * 16);
            }
        }
        request();
    }

    // The plain text under the cursor's row, for the decoder window.
    function reading() {
        const row = Math.floor((lens.y - box.y) / ch);
        const col = Math.floor((lens.x - box.x) / cw);
        if (row < 0 || col < 0 || col >= cols || lens.y > box.y + box.h) return idle;
        const at = (row * cols + col) % MESSAGE.length;
        return (MESSAGE + MESSAGE).slice(at, at + 26).trim();
    }

    function flipFor(glyph) {
        if (glyph === AR_ONE) return AR_ZERO;
        if (glyph === AR_ZERO) return AR_ONE;
        if (mode === '01') return glyph ? 0 : 1;
        return Math.floor(Math.random() * 16);
    }

    function inLens(x, y) {
        const dx = x + cw / 2 - lens.x;
        const dy = y + ch / 2 - lens.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Everything that moves: the intro, the scroll scatter, pulses, the lens and settling springs.
    function drawAll(now, t, formed) {
        const diag = Math.hypot(W, H);
        for (let i = rings.length - 1; i >= 0; i--) {
            rings[i].r = (now - rings[i].start) * 0.9;
            if (rings[i].r > diag) rings.splice(i, 1);
        }
        settling = false;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of points) {
            const k = easeInOut(clamp01((t - p.delay) / p.dur)) * (1 - smooth(p.leave, p.leave + 0.4, scatter));
            const u = 1 - k;
            let x = u * u * p.ax + 2 * u * k * p.cx + k * k * p.hx;
            let y = u * u * p.ay + 2 * u * k * p.cy + k * k * p.hy;

            // A click's pulse shoves the glyphs it passes and scrambles them for a beat.
            for (const ring of rings) {
                const dx = x - ring.x;
                const dy = y - ring.y;
                const d = Math.sqrt(dx * dx + dy * dy) || 1;
                if (Math.abs(d - ring.r) < 12) {
                    const f = 2.2 * (1 - ring.r / diag);
                    p.vx += (dx / d) * f;
                    p.vy += (dy / d) * f;
                    p.flip = now + 260;
                    p.flipGlyph = flipFor(p.glyph);
                }
            }
            if (p.ox || p.oy || p.vx || p.vy) {
                p.vx = (p.vx - p.ox * 0.08) * 0.84;
                p.vy = (p.vy - p.oy * 0.08) * 0.84;
                p.ox += p.vx;
                p.oy += p.vy;
                if (Math.abs(p.ox) + Math.abs(p.oy) + Math.abs(p.vx) + Math.abs(p.vy) < 0.05) p.ox = p.oy = p.vx = p.vy = 0;
                else settling = true;
            }
            x += p.ox;
            y += p.oy;

            const land = smooth(0.6, 1, k);
            let alpha = clamp01(t * 1.5 - p.delay * 0.4) * (0.4 + 0.6 * land) * p.base;
            let glyph = p.fly;
            let colour = NOISE;
            if (land >= 0.5) {
                glyph = now < p.flip ? p.flipGlyph : p.glyph;
                colour = p.red ? SHEMAGH : PAPER;
                // Inside the lens the digits read as plain text, set in teal.
                if (lens.k > 0.01 && formed) {
                    const d = inLens(x, y);
                    if (d < LENS) {
                        if ((1 - smooth(LENS * 0.72, LENS, d)) * lens.k > 0.5) {
                            const letter = MESSAGE[(p.row * cols + p.col) % MESSAGE.length];
                            if (letter === ' ') continue;
                            glyph = LATIN.indexOf(letter);
                            colour = TEAL;
                            alpha = Math.max(alpha, 0.85);
                        }
                        if (!reduced) {
                            const bulge = ((1 - d / LENS) * 5 * lens.k) / (d || 1);
                            x += (x + cw / 2 - lens.x) * bulge;
                            y += (y + ch / 2 - lens.y) * bulge;
                        }
                    }
                }
            }
            if (alpha < 0.02) continue;
            ctx.globalAlpha = alpha;
            ctx.drawImage(atlas, glyph * sw, colour * sh, sw, sh, Math.round(x * dpr), Math.round(y * dpr), sw, sh);
        }
        ctx.strokeStyle = COLOURS[TEAL];
        ctx.lineWidth = 1.5 * dpr;
        for (const ring of rings) {
            ctx.globalAlpha = 0.55 * (1 - ring.r / diag);
            ctx.beginPath();
            ctx.arc(ring.x * dpr, ring.y * dpr, ring.r * dpr, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        flipping = points.filter(p => p.flip > now);
    }

    // At rest every glyph sits in its own cell, so a flip only repaints that cell.
    function paintCell(p, glyph) {
        const x = Math.round(p.hx * dpr);
        const y = Math.round(p.hy * dpr);
        ctx.clearRect(x, y, sw, sh);
        ctx.globalAlpha = p.base;
        ctx.drawImage(atlas, glyph * sw, (p.red ? SHEMAGH : PAPER) * sh, sw, sh, x, y, sw, sh);
        ctx.globalAlpha = 1;
    }

    // Live data: a few digits flip at a time once the portrait has settled.
    function flicker(now) {
        if (now - lastFlicker < 90) return;
        lastFlicker = now;
        flipping = flipping.filter(p => {
            if (p.flip > now) return true;
            paintCell(p, p.glyph);
            return false;
        });
        for (let i = 0; i < points.length / 320; i++) {
            const p = points[Math.floor(Math.random() * points.length)];
            if (p.base < 0.02 || p.flip > now || (lens.k > 0 && inLens(p.hx, p.hy) < LENS)) continue;
            p.flip = now + 250 + Math.random() * 400;
            p.flipGlyph = flipFor(p.glyph);
            paintCell(p, p.flipGlyph);
            flipping.push(p);
        }
    }

    function frame(now) {
        running = false;
        if (!box || !atlas) return;
        const t = (now - t0) / 1000;
        const formed = t >= introEnd;

        // The lens eases in and out; a tap keeps it open for a moment on touch screens.
        const wanted = lens.on || now < lens.until ? 1 : 0;
        lens.k += (wanted - lens.k) * 0.18;
        const easing = Math.abs(wanted - lens.k) > 0.01;
        if (!easing) lens.k = wanted;

        const moving = !formed || scatter !== drawnScatter || rings.length > 0 || settling || easing || lens.moved || now < scrambleUntil;
        drawnScatter = scatter;
        lens.moved = false;
        if (moving || !painted) {
            drawAll(now, t, formed);
            painted = true;
            if (readout && formed) {
                const text = lens.k > 0.5 ? reading() : idle;
                if (readout.textContent !== text) readout.textContent = text;
            }
        } else if (!reduced) {
            flicker(now);
        }
        canvas.dataset.state = scatter > 0.01 ? 'scattering' : formed ? 'formed' : 'gathering';
        if (moving || settling) request();
        else if (!reduced && visible) setTimeout(request, 90);
    }

    function request() {
        if (!running && visible && W) {
            running = true;
            requestAnimationFrame(frame);
        }
    }

    const isControl = target => target.closest('a, button, input, label, .decoder');
    hero.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        lens.x = e.clientX - r.left;
        lens.y = e.clientY - r.top;
        lens.on = e.pointerType === 'mouse' && !isControl(e.target);
        lens.moved = lens.on;
        request();
    });
    hero.addEventListener('pointerleave', () => {
        lens.on = false;
        request();
    });
    hero.addEventListener('pointerdown', e => {
        if (isControl(e.target) || !box) return;
        const r = canvas.getBoundingClientRect();
        lens.x = e.clientX - r.left;
        lens.y = e.clientY - r.top;
        if (e.pointerType !== 'mouse') lens.until = performance.now() + 2600;
        lens.moved = true;
        if (!reduced) rings.push({ x: lens.x, y: lens.y, start: performance.now(), r: 0 });
        request();
    });
    document.querySelectorAll('input[name="encoding"]').forEach(input => {
        input.addEventListener('change', () => setMode(input.value));
    });

    if (!reduced) {
        addEventListener('scroll', () => {
            const r = hero.getBoundingClientRect();
            scatter = clamp01(-r.top / (r.height * 0.8));
            request();
        }, { passive: true });
    }

    new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        request();
    }).observe(hero);

    let lastW = 0;
    let lastH = 0;
    let resizeTimer = 0;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const r = canvas.getBoundingClientRect();
            // Ignore the small height changes phones make when their toolbars slide.
            if (Math.round(r.width) === lastW && Math.abs(r.height - lastH) < 120) return;
            lastW = Math.round(r.width);
            lastH = r.height;
            build(true);
        }, 180);
    }

    const fontReady = document.fonts && document.fonts.load
        ? Promise.race([document.fonts.load('11px "Departure Mono"', '01'), new Promise(resolve => setTimeout(resolve, 1500))])
        : Promise.resolve();
    fontReady.catch(() => {}).then(() => {
        const r = canvas.getBoundingClientRect();
        lastW = Math.round(r.width);
        lastH = r.height;
        const checked = document.querySelector('input[name="encoding"]:checked');
        if (checked) mode = checked.value;
        build(false);
        addEventListener('resize', onResize);
    });
})();
