/**
 * واجهة مشتركة للوحة التحكم — نافذة عرض النصوص الطويلة.
 */
import { escapeHtml } from './security.js';

let modalEl = null;
const modalStore = new Map();
let modalSeq = 0;

function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'admin-modal-overlay';
    modalEl.id = 'admin-text-modal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
        <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
            <div class="admin-modal-header">
                <h3 id="admin-modal-title"></h3>
                <button type="button" class="admin-modal-close" aria-label="إغلاق">×</button>
            </div>
            <div class="admin-modal-meta" id="admin-modal-meta"></div>
            <div class="admin-modal-body" id="admin-modal-body"></div>
            <div class="admin-modal-footer">
                <button type="button" class="btn admin-modal-close-btn">إغلاق</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    const close = () => {
        modalEl.hidden = true;
        document.body.style.overflow = '';
    };
    modalEl.querySelector('.admin-modal-close').addEventListener('click', close);
    modalEl.querySelector('.admin-modal-close-btn').addEventListener('click', close);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl && !modalEl.hidden) close();
    });
    return modalEl;
}

export function truncateText(text, max = 72) {
    const t = String(text || '').trim();
    if (t.length <= max) return t;
    return t.slice(0, max).trim() + '…';
}

export function openTextModal({ title, body, meta = '' }) {
    const modal = ensureModal();
    modal.querySelector('#admin-modal-title').textContent = title || 'التفاصيل';
    const metaEl = modal.querySelector('#admin-modal-meta');
    metaEl.innerHTML = meta || '';
    metaEl.style.display = meta ? '' : 'none';
    modal.querySelector('#admin-modal-body').textContent = body || '';
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
}

export function renderLongTextCell(text, modalTitle, metaHtml = '', max = 72) {
    const full = String(text || '').trim();
    const safe = escapeHtml(full);
    if (full.length <= max) {
        return `<p class="table-text-preview">${safe}</p>`;
    }
    const id = `modal-${++modalSeq}`;
    modalStore.set(id, { title: modalTitle, body: full, meta: metaHtml });
    return `
        <p class="table-text-preview">${escapeHtml(truncateText(full, max))}</p>
        <button type="button" class="btn btn-sm btn-view-text" data-modal-id="${id}">عرض كاملاً</button>`;
}

export function bindViewTextButtons(container) {
    container.querySelectorAll('.btn-view-text').forEach((btn) => {
        if (btn.dataset.bound) return;
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            const data = modalStore.get(btn.dataset.modalId);
            if (data) openTextModal(data);
        });
    });
}
