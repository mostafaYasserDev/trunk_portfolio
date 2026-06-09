/**
 * Admin panel — mobile sidebar + shared UI
 */
(function initAdminPanel() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Overlay
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebar-overlay';
        document.body.prepend(overlay);
    }

    // Wrap main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent && !mainContent.closest('.admin-wrapper')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'admin-wrapper';
        mainContent.parentNode.insertBefore(wrapper, mainContent);
        wrapper.appendChild(mainContent);
    }

    // Top bar (mobile)
    const wrapper = document.querySelector('.admin-wrapper');
    if (wrapper && !document.querySelector('.admin-topbar')) {
        const pageTitle = document.querySelector('.main-content > h1')?.textContent
            || document.title.split(' - ')[0];
        const topbar = document.createElement('header');
        topbar.className = 'admin-topbar';
        topbar.innerHTML = `
            <button type="button" class="admin-menu-btn" id="admin-menu-toggle" aria-label="فتح القائمة">☰</button>
            <h2 class="admin-topbar-title">${pageTitle}</h2>
        `;
        wrapper.insertBefore(topbar, mainContent);
    }

    // Restructure sidebar nav
    if (!sidebar.querySelector('.sidebar-nav')) {
        const brand = document.createElement('div');
        brand.className = 'sidebar-brand';
        const img = sidebar.querySelector('img');
        if (img) {
            brand.appendChild(img.cloneNode(true));
            img.remove();
        }
        sidebar.insertBefore(brand, sidebar.firstChild);

        const links = sidebar.querySelectorAll('a');
        const nav = document.createElement('nav');
        nav.className = 'sidebar-nav';
        links.forEach(a => nav.appendChild(a));
        sidebar.insertBefore(nav, sidebar.querySelector('button, #logout-btn'));

        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        const logoutBtn = sidebar.querySelector('#logout-btn, button');
        if (logoutBtn) footer.appendChild(logoutBtn);
        sidebar.appendChild(footer);
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openSidebar() {
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    document.getElementById('admin-menu-toggle')?.addEventListener('click', () => {
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);

    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeSidebar);
    });

    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) closeSidebar();
    });
})();
