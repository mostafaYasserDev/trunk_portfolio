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

export function validatePublicPayload(fields) {
    for (const [key, val] of Object.entries(fields)) {
        if (typeof val !== 'string') continue;
        const check = assertSafeText(val, key);
        if (!check.ok) return check;
    }
    return { ok: true };
}
