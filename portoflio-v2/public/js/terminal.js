// Terminals: the hero's word decodes itself out of binary, commands type themselves when
// their window scrolls into view, and the lab's log prints each k-means step as it happens.
(function () {
    'use strict';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Each letter flickers through 0 and 1 in red, then locks into place, left to right.
    function decodeWord() {
        const el = document.querySelector('[data-decode-word]');
        if (!el || reduced) return;
        const word = el.querySelector('.g');
        const letters = [...word.textContent].map(ch => {
            const span = document.createElement('span');
            span.className = 'ch';
            span.dataset.final = ch;
            return span;
        });
        word.replaceChildren(...letters);
        el.classList.add('is-typing');
        const start = performance.now();
        (function tick() {
            const elapsed = performance.now() - start;
            let busy = false;
            letters.forEach((span, i) => {
                if (span.classList.contains('is-locked')) return;
                if (elapsed > 300 + i * 150) {
                    span.textContent = span.dataset.final;
                    span.classList.add('is-locked');
                } else {
                    span.textContent = Math.random() < 0.5 ? '0' : '1';
                    busy = true;
                }
            });
            if (busy) setTimeout(tick, 55);
        })();
    }

    function typeOnView(term) {
        const cmd = term.querySelector('[data-cmd]');
        const out = term.querySelector('[data-out]');
        if (!cmd || reduced || !('IntersectionObserver' in window)) return;
        const full = cmd.textContent;
        cmd.textContent = '';
        if (out) out.hidden = true;
        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            io.disconnect();
            let i = 0;
            (function step() {
                cmd.textContent = full.slice(0, ++i);
                if (i < full.length) setTimeout(step, 55 + Math.random() * 60);
                else if (out) setTimeout(() => (out.hidden = false), 380);
            })();
        }, { threshold: 0.6 });
        io.observe(term);
    }

    function labLog() {
        const log = document.querySelector('[data-lab-log]');
        const board = document.querySelector('[data-lab-canvas]');
        if (!log || !board) return;
        const MAX_LINES = 9;
        const lines = [];
        const pad = (v, n) => String(v).padStart(n, ' ');
        const write = html => {
            lines.push(html);
            while (lines.length > MAX_LINES) lines.shift();
            log.innerHTML = `${lines.join('\n')}<span class="cursor" aria-hidden="true"></span>`;
        };
        board.addEventListener('lab:seed', e => {
            const { k, n } = e.detail;
            write(`<span class="ps1">$</span> python kmeans.py -k ${k} -n ${n}`);
            write(`<span class="dim">k-means++ seeded ${k} centroids</span>`);
        });
        board.addEventListener('lab:step', e => {
            const { iter, moved, inertia, settled } = e.detail;
            write(`iter ${pad(iter, 2)}  moved ${pad(moved, 3)}  inertia ${inertia.toFixed(4)}`);
            if (settled) write(`<span class="ok">converged after ${iter} iterations</span>`);
        });
        board.addEventListener('lab:clear', () => {
            lines.length = 0;
            write('<span class="ps1">$</span> clear');
        });
    }

    decodeWord();
    document.querySelectorAll('[data-type]').forEach(typeOnView);
    labLog();
})();
