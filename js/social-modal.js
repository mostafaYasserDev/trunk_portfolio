/**
 * نافذة روابط التواصل الإضافية
 */

const modalData = new Map();
let modalSeq = 0;
let overlayEl = null;

function renderModalIcon(link, escapeHtml) {
    if (link.customIcon) {
        return `<img src="${escapeHtml(link.customIcon)}" alt="" class="social-modal-custom-icon" loading="lazy">`;
    }
    if (link.fa) {
        return `<i class="${link.fa}" aria-hidden="true"></i>`;
    }
    return `<i class="fas fa-link" aria-hidden="true"></i>`;
}

export function registerSocialModalLinks(links) {
    const id = `sm-${++modalSeq}`;
    modalData.set(id, links);
    return id;
}

function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'social-modal-overlay';
    overlayEl.id = 'social-links-modal';
    overlayEl.hidden = true;
    overlayEl.innerHTML = `
        <div class="social-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="social-modal-title">
            <button type="button" class="social-modal-close" aria-label="إغلاق">×</button>
            <span class="trunk-badge">جذور التواصل</span>
            <h3 id="social-modal-title" class="social-modal-title">جميع قنوات التواصل</h3>
            <p class="social-modal-sub">اختر المنصة التي تفضّلها للتواصل معي</p>
            <div class="social-modal-grid" id="social-modal-grid"></div>
        </div>
    `;
    document.body.appendChild(overlayEl);

    const close = () => closeSocialModal();
    overlayEl.querySelector('.social-modal-close').addEventListener('click', close);
    overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlayEl && !overlayEl.hidden) close();
    });
    return overlayEl;
}

export function openSocialModal(modalId, escapeHtml) {
    const links = modalData.get(modalId);
    if (!links?.length) return;

    const overlay = ensureOverlay();
    const grid = overlay.querySelector('#social-modal-grid');
    grid.innerHTML = links.map((link, i) => `
        <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer"
           class="social-modal-link" style="animation-delay:${i * 0.06}s">
            <span class="social-modal-link-icon">${renderModalIcon(link, escapeHtml)}</span>
            <span class="social-modal-link-label">${escapeHtml(link.label)}</span>
        </a>`).join('');

    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
}

export function closeSocialModal() {
    if (!overlayEl) return;
    overlayEl.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (overlayEl) overlayEl.hidden = true; }, 350);
}

export function bindSocialModals(root = document, escapeHtml) {
    root.querySelectorAll('[data-social-modal]').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => openSocialModal(btn.dataset.socialModal, escapeHtml));
    });
}
