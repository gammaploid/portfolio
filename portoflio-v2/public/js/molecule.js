// Footer: β-phenylethylamine, the trace amine that switches on TAAR1, as a slowly
// turning wire model. Coordinates are approximate, in ångströms, ring in the xy plane.
(function () {
    'use strict';

    const canvas = document.querySelector('[data-molecule]');
    const ctx = canvas && canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Nitrogen in its usual chemistry blue, the same blue as the woven print beside it.
    const NITROGEN = '#7d8ff0';
    const ring = Array.from({ length: 6 }, (_, i) => [1.39 * Math.cos((i * Math.PI) / 3), 1.39 * Math.sin((i * Math.PI) / 3), 0]);
    const ringH = ring.slice(1).map(([x, y]) => [x * 1.78, y * 1.78, 0]);
    const atoms = [
        ...ring.map(p => ({ p, el: 'C' })),
        { p: [2.9, 0, 0], el: 'C' },
        { p: [3.55, 1.25, 0.55], el: 'C' },
        { p: [5.0, 1.3, 0.75], el: 'N' },
        ...ringH.map(p => ({ p, el: 'H' })),
        { p: [3.25, -0.55, 0.88], el: 'H' },
        { p: [3.25, -0.55, -0.88], el: 'H' },
        { p: [3.2, 1.85, -0.3], el: 'H' },
        { p: [3.25, 1.7, 1.5], el: 'H' },
        { p: [5.4, 0.55, 1.3], el: 'H' },
        { p: [5.35, 2.15, 1.15], el: 'H' },
    ];
    const bonds = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [6, 7], [7, 8],
        [1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [6, 15], [7, 16], [7, 17], [8, 18], [8, 19]];

    // Centre the model so it turns about its own middle.
    const centre = [0, 1, 2].map(k => atoms.reduce((s, a) => s + a.p[k], 0) / atoms.length);
    atoms.forEach(a => (a.p = a.p.map((v, k) => v - centre[k])));

    let W = 0;
    let H = 0;
    let dpr = 1;
    let visible = false;
    let raf = 0;
    let angle = 0.6;
    let last = 0;

    // Roll about the long axis with a gentle yaw, so the model always reads side-on.
    function project([x, y, z]) {
        const y1 = y * Math.cos(angle) - z * Math.sin(angle);
        const z1 = y * Math.sin(angle) + z * Math.cos(angle);
        const yaw = 0.35 * Math.sin(angle * 0.5);
        const x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw);
        const z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw);
        const scale = Math.min(W / 10, H / 6.2);
        const persp = 9 / (9 + z2);
        return { x: W / 2 + x2 * scale * persp, y: H / 2 - y1 * scale * persp, z: z2, s: persp };
    }

    function draw() {
        if (!W) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const pts = atoms.map(a => project(a.p));
        ctx.lineWidth = 1.2;
        bonds.forEach(([a, b]) => {
            const hydrogen = atoms[a].el === 'H' || atoms[b].el === 'H';
            ctx.setLineDash(hydrogen ? [2, 4] : [5, 4]);
            ctx.globalAlpha = (hydrogen ? 0.45 : 0.9) * (0.55 + 0.45 * Math.min(1, pts[a].s, pts[b].s));
            ctx.strokeStyle = '#e7e4dd';
            ctx.beginPath();
            ctx.moveTo(pts[a].x, pts[a].y);
            ctx.lineTo(pts[b].x, pts[b].y);
            ctx.stroke();
        });
        // The aromatic ring, drawn as a dotted inner loop.
        ctx.setLineDash([1.5, 4]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ring.forEach((p, i) => {
            const q = project(p.map((v, k) => v * 0.6 - centre[k]));
            if (i) ctx.lineTo(q.x, q.y);
            else ctx.moveTo(q.x, q.y);
        });
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        atoms.map((a, i) => ({ a, q: pts[i] })).sort((m, n) => n.q.z - m.q.z).forEach(({ a, q }) => {
            const size = (a.el === 'H' ? 3 : a.el === 'N' ? 9 : 6) * q.s;
            ctx.globalAlpha = a.el === 'H' ? 0.6 : 1;
            ctx.fillStyle = a.el === 'N' ? NITROGEN : a.el === 'H' ? '#a29f97' : '#e7e4dd';
            ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
            if (a.el === 'N') {
                ctx.font = '16.5px "Departure Mono", monospace';
                ctx.fillText('N', q.x + 9, q.y - 8);
            }
        });
        ctx.globalAlpha = 1;
    }

    function frame(now) {
        raf = 0;
        if (last) angle += Math.min(0.05, (now - last) / 1000) * 0.35;
        last = now;
        draw();
        if (visible && !reduced) raf = requestAnimationFrame(frame);
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
        last = 0;
        if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);
})();
