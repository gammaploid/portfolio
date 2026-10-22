// Pixel numerals printed row by row like a dot-matrix head, punch cards that carry each
// timeline stop in IBM card code, and the stack marquee's repeated rows.
(function () {
    'use strict';

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SVG = 'http://www.w3.org/2000/svg';
    const PRINT = 1.1;

    // 5 x 7 glyphs, rows from the top.
    const FONT = {
        '2': '.###./#...#/....#/...#./..#../.#.../#####',
        '3': '####./....#/....#/.###./....#/....#/####.',
        'r': '...../...../#.##./##..#/#..../#..../#....',
        'd': '....#/....#/.####/#...#/#...#/#...#/.####',
        '×': '...../#...#/.#.#./..#../.#.#./#...#/.....',
    };

    function pixnum(grid) {
        const glyphs = [...grid.dataset.pixnum].map(ch => (FONT[ch] || '').split('/'));
        // Every number shares a three-glyph grid, so their pixels match in size.
        const cols = Math.max(17, glyphs.length * 6 - 1);
        const rowDur = PRINT / 7;
        grid.style.setProperty('--cols', cols);
        for (let y = 0; y < 7; y++) {
            for (let x = 0; x < cols; x++) {
                const cell = document.createElement('i');
                const glyph = glyphs[Math.floor(x / 6)];
                if (glyph && x % 6 < 5 && glyph[y] && glyph[y][x % 6] === '#') {
                    cell.className = 'on';
                    cell.style.setProperty('--d', `${(y * rowDur + (x / cols) * rowDur).toFixed(3)}s`);
                }
                grid.appendChild(cell);
            }
        }
        const wrap = grid.parentElement;
        wrap.style.setProperty('--print', `${PRINT}s`);
        if (reduced || !('IntersectionObserver' in window)) {
            grid.classList.add('is-printed');
            return;
        }
        const io = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            io.disconnect();
            wrap.classList.add('is-printing');
            grid.classList.add('is-printed');
        }, { threshold: 0.5 });
        io.observe(grid);
    }

    // IBM card code, rows 12, 11, 0 to 9 from the top: a digit punches its own row,
    // a letter adds a zone punch (A-I 12, J-R 11, S-Z 0) to a digit row.
    function hollerith(ch) {
        if (ch >= '0' && ch <= '9') return [Number(ch) + 2];
        const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(ch);
        if (i < 0) return [];
        if (i < 9) return [0, i + 3];
        if (i < 18) return [1, i - 6];
        return [2, i - 14];
    }

    function svgEl(tag, attrs, parent) {
        const node = document.createElementNS(SVG, tag);
        for (const key in attrs) node.setAttribute(key, attrs[key]);
        parent.appendChild(node);
        return node;
    }

    function punch(card) {
        const COLS = 30;
        const year = card.querySelector('.stop-year').textContent.trim();
        const title = card.querySelector('h3').textContent.trim();
        const text = `${year} ${title}`.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').slice(0, COLS);
        const xs = Array.from({ length: COLS }, (_, i) => i * 10 + 5).join(' ');
        const svg = svgEl('svg', { class: 'punch-holes', viewBox: `0 0 ${COLS * 10} 142`, 'aria-hidden': 'true' }, card);
        const type = { 'font-family': 'Departure Mono, monospace', 'text-anchor': 'middle' };

        // The interpreted line printed along the top edge, one character over each column.
        const top = svgEl('text', Object.assign({ x: xs, y: 10, 'font-size': 9, fill: '#121212' }, type), svg);
        top.textContent = text.padEnd(COLS, ' ');
        for (let d = 0; d <= 9; d++) {
            const row = svgEl('text', Object.assign({ x: xs, y: 41 + d * 10, 'font-size': 7, fill: 'rgba(18, 18, 18, 0.32)' }, type), svg);
            row.textContent = String(d).repeat(COLS);
        }
        [...text].forEach((ch, col) => {
            hollerith(ch).forEach(row => {
                svgEl('rect', { x: col * 10 + 3, y: 15 + row * 10, width: 4, height: 7, fill: '#1d1d1c' }, svg);
            });
        });
    }

    // Repeat the row until it spans the widest screen, then double it for a seamless loop.
    function marquee(track) {
        const clone = node => {
            const copy = node.cloneNode(true);
            copy.dataset.clone = '';
            copy.setAttribute('aria-hidden', 'true');
            return copy;
        };
        const items = [...track.children];
        const reps = Math.max(1, Math.ceil(Math.max(innerWidth, 1920) / (track.scrollWidth || 1)));
        for (let r = 1; r < reps; r++) items.forEach(item => track.appendChild(clone(item)));
        [...track.children].forEach(item => track.appendChild(clone(item)));
    }

    document.querySelectorAll('[data-pixnum]').forEach(pixnum);
    document.querySelectorAll('.punch').forEach(punch);
    document.querySelectorAll('.marquee-track').forEach(marquee);
})();
