/**
 * أدوات أمان مشتركة — تعقيم النصوص والتحقق من المحتوى الخطير.
 */

const INJECTION_RE = /(<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed|<\s*svg|data\s*:\s*text\/html)/i;
const HTML_TAG_RE = /<[^>]*>/g;

export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function stripHtml(text) {
    return String(text || '').replace(HTML_TAG_RE, '');
}

export function hasInjectionPatterns(text) {
    const s = String(text || '');
    return INJECTION_RE.test(s) || /&#x?[0-9a-f]+;/i.test(s);
}

export function sanitizePlainText(value, maxLen = 500) {
    let text = stripHtml(String(value || '')).trim();
    if (text.length > maxLen) text = text.slice(0, maxLen);
    return text;
}

export function assertSafeText(value, label = 'الحقل') {
    if (hasInjectionPatterns(value)) {
        return { ok: false, message: `${label} يحتوي محتوى غير مسموح.` };
    }
    return { ok: true };
}

export function isValidEmail(email) {
    const e = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
    return !hasInjectionPatterns(e);
}

export function sanitizeHttpUrl(url) {
    const u = String(url || '').trim();
    if (!u) return '';
    try {
        const parsed = new URL(u);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
        if (hasInjectionPatterns(u)) return '';
        return parsed.href;
    } catch {
        return '';
    }
}

const SAFE_MEDIA_RE = /^data:(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml)|application\/pdf);base64,[a-z0-9+/]+={0,2}$/i;
const SAFE_ICON_STYLES = new Set([
    'fa', 'fas', 'far', 'fab', 'fal', 'fad', 'fass', 'fat',
    'fa-solid', 'fa-regular', 'fa-brands', 'fa-light', 'fa-thin',
    'fa-duotone', 'fa-sharp', 'fa-sharp-duotone'
]);

/** Accept only http(s) URLs or explicitly supported base64 media. */
export function sanitizeMediaUrl(value, { allowImage = true, allowPdf = false } = {}) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (SAFE_MEDIA_RE.test(raw)) {
        if (raw.toLowerCase().startsWith('data:application/pdf')) return allowPdf ? raw : '';
        return allowImage ? raw : '';
    }
    return sanitizeHttpUrl(raw);
}

export function sanitizeIconClass(value) {
    const raw = String(value || '').trim();
    const classes = raw.split(/\s+/).filter(Boolean);
    if (classes.length < 2 || classes.length > 8) return '';
    if (!SAFE_ICON_STYLES.has(classes[0].toLowerCase())) return '';
    if (!classes.slice(1).every(className => /^fa-[a-z0-9-]+$/i.test(className))) return '';
    return classes.join(' ');
}

function isSafeRichUrl(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return true;
    if (SAFE_MEDIA_RE.test(raw) && raw.toLowerCase().startsWith('data:image/')) return true;
    try {
        const parsed = new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
        return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

/** Remove executable elements, event handlers and unsafe URLs from editor HTML. */
export function sanitizeRichHtml(value) {
    const source = String(value || '');
    if (!source || typeof DOMParser === 'undefined') return '';
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.querySelectorAll('script, iframe, object, embed, svg, math, base, meta, link, form, foreignObject').forEach(el => el.remove());
    doc.querySelectorAll('style').forEach(style => {
        if (/(?:@import|url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:)/i.test(style.textContent || '')) style.remove();
    });
    doc.querySelectorAll('*').forEach(el => {
        [...el.attributes].forEach(attr => {
            const name = attr.name.toLowerCase();
            const attrValue = attr.value || '';
            if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction' || name === 'xlink:href') {
                el.removeAttribute(attr.name);
                return;
            }
            if ((name === 'href' || name === 'src' || name === 'action') && !isSafeRichUrl(attrValue)) {
                el.removeAttribute(attr.name);
                return;
            }
            if (name === 'style' && /(?:expression\s*\(|javascript\s*:|vbscript\s*:|url\s*\()/i.test(attrValue)) {
                el.removeAttribute(attr.name);
            }
        });
    });
    return doc.body.innerHTML;
}

export function validatePublicPayload(fields) {
    for (const [key, val] of Object.entries(fields)) {
        if (typeof val !== 'string') continue;
        const check = assertSafeText(val, key);
        if (!check.ok) return check;
    }
    return { ok: true };
}
