// Page behaviour: menu bar, clock, scroll progress, scroll-linked motion, timeline and contact.
// Everything degrades to a readable static page when GSAP or JavaScript is unavailable.
(function () {
    'use strict';

    const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (hasGsap) gsap.registerPlugin(ScrollTrigger);

    // Same obfuscation as the previous site: base64 of the reversed address.
    const ENCODED_EMAIL = 'bW9jLmxpYW1nQGFzb21sYS5hLm5hc3NhaA==';
    const email = () => atob(ENCODED_EMAIL).split('').reverse().join('');

    function initMenu() {
        const header = document.querySelector('[data-header]');
        if (!header) return;
        const button = header.querySelector('[data-menu-btn]');
        const list = document.getElementById('nav-list');
        const setOpen = open => {
            header.classList.toggle('is-open', open);
            document.documentElement.classList.toggle('menu-open', open);
            button.setAttribute('aria-expanded', String(open));
            button.textContent = open ? 'Close' : 'Menu';
            if (open) list.querySelector('a').focus();
        };
        button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
        list.addEventListener('click', e => {
            if (e.target.closest('a') && header.classList.contains('is-open')) setOpen(false);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && header.classList.contains('is-open')) {
                setOpen(false);
                button.focus();
            }
        });
        matchMedia('(min-width: 900px)').addEventListener('change', e => {
            if (e.matches) setOpen(false);
        });
    }

    // Dammam time in the taskbar tray.
    function initClock() {
        const el = document.querySelector('[data-clock]');
        if (!el) return;
        const format = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', hour12: false,
        });
        const tick = () => {
            el.textContent = format.format(new Date());
        };
        tick();
        setInterval(tick, 1000);
    }

    function initProgress() {
        const bar = document.querySelector('[data-progress]');
        if (!bar) return;
        let queued = false;
        const update = () => {
            const max = document.documentElement.scrollHeight - innerHeight;
            bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
            queued = false;
        };
        addEventListener('scroll', () => {
            if (!queued) {
                queued = true;
                requestAnimationFrame(update);
            }
        }, { passive: true });
        update();
    }

    function initScrollSpy() {
        const links = [...document.querySelectorAll('[data-spy]')];
        const byId = new Map(links.map(a => [a.hash.slice(1), a]));
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                links.forEach(a => a.removeAttribute('aria-current'));
                const link = byId.get(entry.target.id);
                if (link) link.setAttribute('aria-current', 'location');
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
    }

    // The bio brightens word by word as it scrolls through the viewport.
    function initWordLit() {
        const el = document.querySelector('[data-wordlit]');
        if (!el || !hasGsap || reduced) return;
        const words = el.textContent.trim().split(/\s+/);
        el.textContent = '';
        words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = 'word';
            span.textContent = word;
            el.append(span, i < words.length - 1 ? ' ' : '');
        });
        gsap.fromTo(el.querySelectorAll('.word'), { opacity: 0.18 }, {
            opacity: 1,
            ease: 'none',
            stagger: 0.1,
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
        });
    }

    function initCoverParallax() {
        if (!hasGsap || reduced) return;
        document.querySelectorAll('.case-media .case-cover svg').forEach(svg => {
            gsap.fromTo(svg, { yPercent: -3, scale: 1.08 }, {
                yPercent: 3,
                scale: 1.08,
                ease: 'none',
                scrollTrigger: { trigger: svg.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
            });
        });
    }

    // Wide screens pin the timeline and turn vertical scroll into sideways travel;
    // phones, reduced motion and no-GSAP visitors scroll the track natively.
    function initJourney() {
        const section = document.querySelector('[data-journey]');
        if (!section) return;
        const viewport = section.querySelector('[data-journey-viewport]');
        const track = section.querySelector('[data-journey-track]');
        const fill = section.querySelector('[data-journey-fill]');
        const count = section.querySelector('[data-journey-count]');
        const stops = track.children.length;

        const setProgress = p => {
            fill.style.transform = `scaleX(${p})`;
            count.textContent = Math.min(stops, Math.round(p * (stops - 1)) + 1);
        };
        viewport.addEventListener('scroll', () => {
            const max = viewport.scrollWidth - viewport.clientWidth;
            setProgress(max > 0 ? viewport.scrollLeft / max : 0);
        }, { passive: true });

        if (!hasGsap) return;
        gsap.matchMedia().add('(min-width: 1024px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)', () => {
            section.classList.add('is-pinned');
            viewport.scrollLeft = 0;
            const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
            gsap.to(track, {
                x: () => -distance(),
                ease: 'none',
                scrollTrigger: {
                    trigger: section,
                    start: 'top top',
                    end: () => `+=${distance()}`,
                    pin: true,
                    scrub: 1,
                    invalidateOnRefresh: true,
                    onUpdate: self => setProgress(self.progress),
                },
            });
            return () => {
                section.classList.remove('is-pinned');
                setProgress(0);
            };
        });
    }

    function initContact() {
        document.querySelectorAll('[data-email-link]').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                window.location.href = 'mailto:' + email();
            });
        });
        const copy = document.querySelector('[data-email-copy]');
        const status = document.querySelector('[data-copy-status]');
        if (!copy || !status) return;
        copy.addEventListener('click', () => {
            const address = email();
            const done = () => {
                status.textContent = `Copied ${address}`;
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(address).then(done, () => {
                    status.textContent = address;
                });
            } else {
                status.textContent = address;
            }
        });
    }

    initMenu();
    initClock();
    initProgress();
    initScrollSpy();
    initContact();
    initWordLit();
    initCoverParallax();
    initJourney();

    const year = document.querySelector('[data-year]');
    if (year) year.textContent = new Date().getFullYear();

    if (hasGsap && document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
