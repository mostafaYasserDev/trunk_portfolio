function initAos() {
    if (typeof AOS === 'undefined') return;
    AOS.init({ duration: 800, once: true, offset: 100 });
    document.body.classList.add('aos-init');
}

function loadAos() {
    if (document.querySelector('script[src*="aos"]')) return;
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/aos@2.3.1/dist/aos.js';
    s.onload = initAos;
    document.head.appendChild(s);
}

export function initUI() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    // Defer AOS until user interaction or 3s — whichever comes first
    const aosEvents = ['scroll', 'mousemove', 'touchstart', 'keydown'];
    let aosLoaded = false;
    function loadAosOnce() {
        if (aosLoaded) return;
        aosLoaded = true;
        aosEvents.forEach(ev => window.removeEventListener(ev, loadAosOnce));
        loadAos();
    }
    aosEvents.forEach(ev => window.addEventListener(ev, loadAosOnce, { once: true, passive: true }));
    setTimeout(loadAosOnce, 3000);

    const bttBtn = document.getElementById('back-to-top');
    if (bttBtn) {
        // Use rAF to avoid forced reflow on every scroll event
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    bttBtn.style.display = document.documentElement.scrollTop > 300 ? 'block' : 'none';
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
        bttBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        const themeIcon = themeBtn.querySelector('i');
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.classList.replace('fa-moon', 'fa-sun');
        }
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDark = document.body.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            themeIcon.classList.replace(isDark ? 'fa-moon' : 'fa-sun', isDark ? 'fa-sun' : 'fa-moon');
        });
    }

    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            const isOpen = mainNav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', isOpen);
            menuToggle.querySelector('i').classList.replace(isOpen ? 'fa-bars' : 'fa-times', isOpen ? 'fa-times' : 'fa-bars');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
                const icon = menuToggle.querySelector('i');
                if (icon.classList.contains('fa-times')) icon.classList.replace('fa-times', 'fa-bars');
            });
        });
        document.addEventListener('click', (e) => {
            if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) {
                mainNav.classList.remove('open');
                menuToggle.setAttribute('aria-expanded', 'false');
                const icon = menuToggle.querySelector('i');
                if (icon.classList.contains('fa-times')) icon.classList.replace('fa-times', 'fa-bars');
            }
        });
    }
}
