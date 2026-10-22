// Arabic pixel type: the Arabixel fonts draw every joined letter form but carry no joining
// rules, so this picks the form each letter needs, the way a fuller font tells the browser to.
// The original words stay in the page for screen readers and search; only the drawn copy changes.
(function () {
    'use strict';

    const ORDER = 'ءآأؤإئابةتثجحخدذرزسشصضطظعغفقكلمنهوىي';
    const DUAL = 'ئبتثجحخسشصضطظعغفقكلمنهي';
    const LAM_ALEF = { 'آ': 0xfef5, 'أ': 0xfef7, 'إ': 0xfef9, 'ا': 0xfefb };

    // Presentation forms follow ORDER: one for hamza, two (isolated, final) for letters that
    // only join on the right, four (isolated, final, initial, medial) for letters that join both ways.
    const first = {};
    let code = 0xfe80;
    for (const ch of ORDER) {
        first[ch] = code;
        code += ch === 'ء' ? 1 : DUAL.includes(ch) ? 4 : 2;
    }
    const joinsBack = ch => ch in first && ch !== 'ء';
    const joinsOn = ch => DUAL.includes(ch);

    function shape(text) {
        const letters = [...text.replace(/[ً-ْٰ]/g, '')];
        let out = '';
        for (let i = 0; i < letters.length; i++) {
            const ch = letters[i];
            if (!(ch in first)) {
                out += ch;
                continue;
            }
            const linked = i > 0 && joinsOn(letters[i - 1]) && joinsBack(ch);
            if (ch === 'ل' && letters[i + 1] in LAM_ALEF) {
                out += String.fromCharCode(LAM_ALEF[letters[i + 1]] + (linked ? 1 : 0));
                i++;
                continue;
            }
            const linksOn = joinsOn(ch) && i + 1 < letters.length && joinsBack(letters[i + 1]);
            const form = ch === 'ء' ? 0 : linked && linksOn ? 3 : linked ? 1 : linksOn ? 2 : 0;
            out += String.fromCharCode(first[ch] + form);
        }
        return out;
    }

    document.querySelectorAll('[data-ar]').forEach(el => {
        const text = el.textContent;
        const drawn = shape(text);
        if (drawn === text) return;
        const spoken = document.createElement('span');
        spoken.className = 'visually-hidden';
        spoken.textContent = text;
        const shown = document.createElement('span');
        shown.setAttribute('aria-hidden', 'true');
        shown.textContent = drawn;
        el.replaceChildren(spoken, shown);
    });
})();
