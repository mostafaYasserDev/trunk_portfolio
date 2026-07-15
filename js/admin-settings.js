import { SOCIAL_PRESETS } from '../js/social.js';
import { sanitizeHttpUrl, sanitizeMediaUrl, sanitizePlainText, escapeHtml } from '../js/security.js';

let extraLinks = [];

function uid() {
    return `xl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function resizeIconFile(file, maxSide = 96) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                let w = img.width;
                let h = img.height;
                if (w > maxSide || h > maxSide) {
                    if (w >= h) {
                        h = Math.round((h / w) * maxSide);
                        w = maxSide;
                    } else {
                        w = Math.round((w / h) * maxSide);
                        h = maxSide;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL('image/png', 0.95));
            };
            img.onerror = reject;
            img.src = event.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function presetOptions(selected = 'custom') {
    return Object.entries(SOCIAL_PRESETS)
        .filter(([key]) => key !== 'custom')
        .map(([key, val]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${val.label}</option>`)
        .concat(`<option value="custom" ${selected === 'custom' ? 'selected' : ''}>${SOCIAL_PRESETS.custom.label}</option>`)
        .join('');
}

function renderExtraRow(link, index) {
    const isCustom = link.preset === 'custom';
    return `
        <div class="social-link-row social-link-row--extra" data-id="${link.id}">
            <div class="social-link-row-head">
                <strong>رابط إضافي ${index + 1}</strong>
                <div class="social-link-row-actions">
                    <label class="checkbox-label"><input type="checkbox" class="xl-visible" ${link.visible !== false ? 'checked' : ''}> ظاهر</label>
                    <button type="button" class="btn btn-danger btn-sm xl-remove">حذف</button>
                </div>
            </div>
            <div class="form-grid-2">
                <div class="form-group">
                    <label>المنصة</label>
                    <select class="form-control xl-preset">${presetOptions(link.preset || 'custom')}</select>
                </div>
                <div class="form-group">
                    <label>الاسم الظاهر</label>
                    <input type="text" class="form-control xl-label" value="${escapeHtml(link.label || '')}" placeholder="مثال: حسابي على إنستغرام">
                </div>
            </div>
            <div class="form-group">
                <label>الرابط</label>
                <input type="url" class="form-control xl-url" dir="ltr" style="text-align:left;" value="${escapeHtml(link.url || '')}" placeholder="https://">
            </div>
            <div class="form-group xl-custom-icon-wrap" style="${isCustom ? '' : 'display:none;'}">
                <label>أيقونة مخصصة (PNG/SVG — تُعرض بحجمها الطبيعي)</label>
                <input type="file" class="form-control xl-icon-file" accept="image/*">
                ${sanitizeMediaUrl(link.customIcon, { allowImage: true, allowPdf: false }) ? `<div class="social-preview-chip social-preview-chip--large"><img src="${escapeHtml(sanitizeMediaUrl(link.customIcon, { allowImage: true, allowPdf: false }))}" class="social-icon-preview-img" alt=""></div>` : ''}
            </div>
        </div>`;
}

function readExtraRow(row) {
    const id = row.dataset.id;
    const existing = extraLinks.find(l => l.id === id) || {};
    return {
        id,
        preset: row.querySelector('.xl-preset').value,
        label: sanitizePlainText(row.querySelector('.xl-label').value, 120),
        url: sanitizeHttpUrl(row.querySelector('.xl-url').value),
        customIcon: sanitizeMediaUrl(existing.customIcon, { allowImage: true, allowPdf: false }),
        visible: row.querySelector('.xl-visible').checked,
        order: Array.from(row.parentNode.children).indexOf(row)
    };
}

function syncExtrasFromDom() {
    const rows = document.querySelectorAll('#extra-social-list .social-link-row');
    extraLinks = Array.from(rows).map(readExtraRow);
}

function renderExtraList(container) {
    container.innerHTML = extraLinks.length
        ? extraLinks.map((link, i) => renderExtraRow(link, i)).join('')
        : '<p class="hint">لا توجد روابط إضافية بعد.</p>';
    bindExtraRowEvents(container);
}

function bindExtraRowEvents(container) {
    container.querySelectorAll('.xl-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            syncExtrasFromDom();
            const row = btn.closest('.social-link-row');
            extraLinks = extraLinks.filter(l => l.id !== row.dataset.id);
            renderExtraList(container);
        });
    });

    container.querySelectorAll('.xl-preset').forEach(select => {
        select.addEventListener('change', () => {
            const row = select.closest('.social-link-row');
            row.querySelector('.xl-custom-icon-wrap').style.display = select.value === 'custom' ? '' : 'none';
            const preset = SOCIAL_PRESETS[select.value];
            const labelInput = row.querySelector('.xl-label');
            if (preset && !labelInput.value.trim()) labelInput.value = preset.label;
        });
    });

    container.querySelectorAll('.xl-icon-file').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files[0];
            if (!file) return;
            if (file.size > 200000) {
                alert('حجم الأيقونة كبير. استخدم صورة أصغر من 200 كيلوبايت.');
                input.value = '';
                return;
            }
            const row = input.closest('.social-link-row');
            const dataUrl = await resizeIconFile(file);
            syncExtrasFromDom();
            const link = extraLinks.find(l => l.id === row.dataset.id);
            if (link) link.customIcon = dataUrl;
            renderExtraList(container);
        });
    });
}

export function initExtraSocialLinksManager(container, addBtn, initialLinks = []) {
    extraLinks = initialLinks.map((link, i) => ({
        ...link,
        id: link.id || uid(),
        order: typeof link.order === 'number' ? link.order : i
    }));
    renderExtraList(container);

    addBtn.addEventListener('click', () => {
        syncExtrasFromDom();
        extraLinks.push({
            id: uid(),
            preset: 'custom',
            label: '',
            url: '',
            customIcon: '',
            visible: true,
            order: extraLinks.length
        });
        renderExtraList(container);
    });
}

export function getExtraSocialLinksFromManager() {
    syncExtrasFromDom();
    return extraLinks
        .map(link => ({ ...link, url: sanitizeHttpUrl(link.url) }))
        .filter(l => l.url)
        .map((link, i) => ({
            id: link.id,
            preset: link.preset,
            label: link.label || SOCIAL_PRESETS[link.preset]?.label || 'رابط',
            url: link.url,
            customIcon: link.preset === 'custom' ? (link.customIcon || '') : '',
            visible: link.visible !== false,
            order: i
        }));
}
