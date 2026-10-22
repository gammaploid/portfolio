// Project covers drawn from the shape of each project's own data, so no screenshots are needed.
(function () {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const W = 800;
    const H = 560;
    const C = {
        bg: '#262625',
        line: 'rgba(231, 228, 221, 0.16)',
        dim: 'rgba(231, 228, 221, 0.45)',
        paper: '#e7e4dd',
        violet: '#a481ff',
        teal: '#3ccfae',
        red: '#e5483f',
        blue: '#7d8ff0',
        green: '#7abe8c',
    };

    // Seeded so each cover looks the same on every visit.
    function rng(seed) {
        let a = seed >>> 0;
        return function () {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function el(tag, attrs, parent) {
        const node = document.createElementNS(NS, tag);
        for (const key in attrs) node.setAttribute(key, attrs[key]);
        if (parent) parent.appendChild(node);
        return node;
    }

    function label(parent, x, y, value, attrs) {
        const node = el('text', Object.assign({
            x, y, fill: C.dim, 'font-size': 16.5, 'font-family': '"Departure Mono", monospace',
        }, attrs), parent);
        node.textContent = value;
        return node;
    }

    // Mirsad: the storage area from above, with an incoming shipment routed to its slot.
    function yard(g, r) {
        const cols = 13;
        const rows = 6;
        const size = 40;
        const gap = 10;
        const left = 90;
        const top = 92;
        const slot = (c, row) => [left + c * (size + gap), top + row * (size + gap)];
        const target = [4 + Math.floor(r() * 7), 1 + Math.floor(r() * 4)];

        label(g, left, 76, 'storage area');
        for (let row = 0; row < rows; row++) {
            for (let c = 0; c < cols; c++) {
                const [x, y] = slot(c, row);
                if (c === target[0] && row === target[1]) continue;
                const held = r() < 0.58;
                el('rect', {
                    x, y, width: size, height: size,
                    fill: held ? C.paper : 'none', 'fill-opacity': held ? (0.15 + r() * 0.6).toFixed(2) : 0,
                    stroke: held ? 'none' : C.line,
                }, g);
            }
        }

        const [tx, ty] = slot(target[0], target[1]);
        const dockY = top + rows * (size + gap) + 26;
        el('path', {
            d: `M${left - 22} ${dockY} H${tx + size / 2} V${ty + size + 4}`,
            fill: 'none', stroke: C.teal, 'stroke-width': 2, 'stroke-dasharray': '6 6',
        }, g);
        el('rect', { x: left - 58, y: dockY - 14, width: 32, height: 28, fill: C.red }, g);
        label(g, left - 58, dockY + 38, 'dock');
        el('rect', { x: tx, y: ty, width: size, height: size, fill: C.teal }, g);
        el('rect', { x: tx - 7, y: ty - 7, width: size + 14, height: size + 14, fill: 'none', stroke: C.teal, 'stroke-width': 1.5 }, g);
        label(g, tx + size + 14, ty + 26, 'placed', { fill: C.teal });

        // The shape of a 48-hour occupancy forecast.
        const fx = 470;
        const fw = 260;
        let d = '';
        for (let i = 0; i <= 48; i++) {
            const v = 0.55 + 0.25 * Math.sin(i / 7 + r() * 0.3) + 0.1 * Math.sin(i / 2.3);
            d += `${i ? 'L' : 'M'}${(fx + (i / 48) * fw).toFixed(1)} ${(dockY + 18 - v * 44).toFixed(1)}`;
        }
        el('path', { d, fill: 'none', stroke: C.paper, 'stroke-width': 1.6, opacity: 0.8 }, g);
        label(g, fx, dockY + 38, 'occupancy, next 48 h');
    }

    // Moleculetron: a fused-ring molecule above its fingerprint bit vector.
    function molecule(g, r) {
        const s = 70;
        const h = (s * Math.sqrt(3)) / 2;
        const rings = [[339, 160], [339 + 2 * h, 160], [339 + h, 160 + 1.5 * s]];
        const vertex = ([cx, cy], i) => {
            const a = -Math.PI / 2 + (i * Math.PI) / 3;
            return [cx + s * Math.cos(a), cy + s * Math.sin(a)];
        };
        const drawn = new Set();
        const key = (a, b) => [a, b].map(p => p.map(Math.round).join(',')).sort().join('|');

        rings.forEach((c, ri) => {
            for (let i = 0; i < 6; i++) {
                const a = vertex(c, i);
                const b = vertex(c, (i + 1) % 6);
                if (!drawn.has(key(a, b))) {
                    drawn.add(key(a, b));
                    el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.paper, 'stroke-width': 3, 'stroke-linecap': 'square', opacity: 0.85 }, g);
                }
                // Alternate inner strokes read as double bonds.
                if (ri < 2 && i % 2 === 0) {
                    const pull = (p, f) => [p[0] + (c[0] - p[0]) * f, p[1] + (c[1] - p[1]) * f];
                    const a2 = pull(a, 0.2);
                    const b2 = pull(b, 0.2);
                    const mid = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2];
                    const trim = p => [p[0] + (mid[0] - p[0]) * 0.22, p[1] + (mid[1] - p[1]) * 0.22];
                    const [p1, p2] = [trim(a2), trim(b2)];
                    el('line', { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], stroke: C.paper, 'stroke-width': 2.5, opacity: 0.6 }, g);
                }
            }
        });

        const atom = (p, name, color) => {
            el('rect', { x: p[0] - 15, y: p[1] - 15, width: 30, height: 30, fill: C.bg }, g);
            label(g, p[0], p[1] + 6, name, { 'text-anchor': 'middle', fill: color, 'font-size': 22 });
        };
        const branch = (c, i, len, name, color) => {
            const v = vertex(c, i);
            const dx = v[0] - c[0];
            const dy = v[1] - c[1];
            const end = [v[0] + (dx / s) * len, v[1] + (dy / s) * len];
            el('line', { x1: v[0], y1: v[1], x2: end[0], y2: end[1], stroke: C.paper, 'stroke-width': 3, opacity: 0.85 }, g);
            atom(end, name, color);
        };
        atom(vertex(rings[2], 3), 'N', C.blue);
        branch(rings[0], 5, s, 'O', C.red);
        branch(rings[1], 1, s, 'F', C.green);
        branch(rings[2], 4, s * 0.9, 'NH', C.blue);

        label(g, 120, 446, 'fingerprint bits');
        for (let i = 0; i < 48; i++) {
            const on = r() < 0.3;
            el('rect', {
                x: 120 + i * 12.5, y: 460, width: 9, height: 22,
                fill: on ? C.teal : 'none', stroke: on ? 'none' : C.line,
            }, g);
        }
    }

    // Grant records: a knowledge graph of grants, researchers and publications.
    function graph(g, r) {
        const cx = 400;
        const cy = 262;
        const hubs = [];
        const people = [];
        const papers = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + r() * 0.4;
            hubs.push({ x: cx + Math.cos(a) * 150, y: cy + Math.sin(a) * 105 });
        }
        hubs.forEach((hub, i) => {
            const n = 2 + Math.floor(r() * 3);
            for (let j = 0; j < n; j++) {
                const a = r() * Math.PI * 2;
                const d = 45 + r() * 40;
                const person = { x: hub.x + Math.cos(a) * d, y: hub.y + Math.sin(a) * d * 0.8, hub: i };
                people.push(person);
                const m = 1 + Math.floor(r() * 3);
                for (let k = 0; k < m; k++) {
                    const b = r() * Math.PI * 2;
                    const e = 18 + r() * 22;
                    papers.push({ x: person.x + Math.cos(b) * e, y: person.y + Math.sin(b) * e, person });
                }
            }
        });

        papers.forEach(p => el('line', { x1: p.x, y1: p.y, x2: p.person.x, y2: p.person.y, stroke: C.line, 'stroke-width': 1 }, g));
        people.forEach(p => el('line', { x1: p.x, y1: p.y, x2: hubs[p.hub].x, y2: hubs[p.hub].y, stroke: C.dim, 'stroke-width': 1.2, opacity: 0.7 }, g));
        // Co-authorship across different grants: the links the old records could not show.
        for (let i = 0; i < 7; i++) {
            const a = people[Math.floor(r() * people.length)];
            const b = people[Math.floor(r() * people.length)];
            if (a.hub !== b.hub) {
                el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: C.red, 'stroke-width': 1.4, 'stroke-dasharray': '4 5', opacity: 0.8 }, g);
            }
        }
        papers.forEach(p => el('rect', { x: p.x - 3, y: p.y - 3, width: 6, height: 6, fill: C.dim }, g));
        people.forEach(p => el('rect', { x: p.x - 6, y: p.y - 6, width: 12, height: 12, fill: C.violet }, g));
        hubs.forEach(p => {
            el('rect', { x: p.x - 18, y: p.y - 18, width: 36, height: 36, fill: 'none', stroke: C.teal, opacity: 0.4 }, g);
            el('rect', { x: p.x - 10, y: p.y - 10, width: 20, height: 20, fill: C.teal }, g);
        });

        const key = [['grant', C.teal, 14], ['researcher', C.violet, 10], ['publication', C.dim, 6]];
        key.forEach(([name, color, size], i) => {
            const x = 60 + i * 170;
            el('rect', { x: x - size / 2, y: 522 - size / 2, width: size, height: size, fill: color }, g);
            label(g, x + 14, 528, name);
        });
    }

    // MCP server: an LLM client calling tools inside a Cloudflare Worker.
    function hub(g, r) {
        const cx = 400;
        const cy = 290;
        const R = 185;
        const tools = ['analyse', 'forecast', 'query', 'compare', 'OAuth', 'PostgreSQL'];
        const active = Math.floor(r() * tools.length);

        el('rect', { x: 100, y: 40, width: 600, height: 490, fill: 'none', stroke: C.line, 'stroke-dasharray': '6 6' }, g);
        label(g, 122, 72, 'cloudflare worker');
        tools.forEach((name, i) => {
            const a = -Math.PI / 2 + (i / tools.length) * Math.PI * 2;
            const x = cx + Math.cos(a) * R;
            const y = cy + Math.sin(a) * R * 0.76;
            const on = i === active || i === (active + 3) % tools.length;
            el('line', { x1: cx, y1: cy, x2: x, y2: y, stroke: on ? C.teal : C.line, 'stroke-width': on ? 2 : 1.2 }, g);
            el('rect', { x: x - 64, y: y - 19, width: 128, height: 38, fill: on ? C.teal : C.bg, stroke: on ? C.teal : C.dim, 'stroke-width': 1.2 }, g);
            label(g, x, y + 6, name, { 'text-anchor': 'middle', fill: on ? '#121212' : C.paper });
        });
        el('rect', { x: cx - 66, y: cy - 30, width: 132, height: 60, fill: '#121212', stroke: C.paper, 'stroke-width': 1.5 }, g);
        label(g, cx, cy + 6, 'LLM client', { 'text-anchor': 'middle', fill: C.paper });
    }

    // Supply chain: hash-linked blocks of custody records, one being verified.
    function chain(g, r) {
        const n = 4;
        const bw = 124;
        const bh = 168;
        const gap = (W - 100 - n * bw) / (n - 1);
        const highlight = 1 + Math.floor(r() * (n - 1));
        let prev = null;
        for (let i = 0; i < n; i++) {
            const x = 50 + i * (bw + gap);
            const y = 196 + (i % 2 ? 34 : -34);
            const hash = Math.floor(r() * 65536).toString(16).padStart(4, '0');
            if (prev) {
                const ax = prev.x + bw;
                const ay = prev.y + bh / 2;
                const bx = x;
                const by = y + bh / 2;
                el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: C.dim, 'stroke-width': 1.5 }, g);
                el('rect', { x: (ax + bx) / 2 - 5, y: (ay + by) / 2 - 5, width: 10, height: 10, fill: C.bg, stroke: C.teal, 'stroke-width': 1.5 }, g);
            }
            const on = i === highlight;
            el('rect', { x, y, width: bw, height: bh, fill: C.bg, stroke: on ? C.violet : C.dim, 'stroke-width': on ? 2 : 1.2 }, g);
            el('rect', { x, y, width: bw, height: 34, fill: on ? C.violet : '#121212' }, g);
            label(g, x + 12, y + 23, '#' + hash, { fill: on ? '#121212' : C.paper });
            for (let j = 0; j < 4; j++) {
                el('rect', { x: x + 14, y: y + 52 + j * 22, width: (bw - 28) * (0.5 + r() * 0.5), height: 8, fill: C.dim, opacity: 0.4 }, g);
            }
            el('path', {
                d: `M${x + bw - 34} ${y + bh - 22} l5 5 l10 -11`, fill: 'none', stroke: C.teal,
                'stroke-width': 2, 'stroke-linecap': 'square',
            }, g);
            prev = { x, y };
        }
    }

    const DRAW = { yard, molecule, graph, hub, chain };

    document.querySelectorAll('[data-cover]').forEach((figure, i) => {
        const draw = DRAW[figure.dataset.cover];
        if (!draw) return;
        const svg = el('svg', {
            viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid slice',
        });
        const pattern = el('pattern', { id: `cover-dots-${i}`, width: 20, height: 20, patternUnits: 'userSpaceOnUse' }, el('defs', {}, svg));
        el('rect', { x: 0, y: 0, width: 1.5, height: 1.5, fill: 'rgba(231, 228, 221, 0.09)' }, pattern);
        el('rect', { width: W, height: H, fill: `url(#cover-dots-${i})` }, svg);
        draw(el('g', {}, svg), rng(1013 * (i + 1)));
        figure.appendChild(svg);
    });
})();
