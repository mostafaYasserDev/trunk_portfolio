/**
 * حماية بسيطة من السبام للنماذج العامة (بدون خادم خلفي).
 */
const DEFAULT_OPTS = {
    minMs: 3500,
    cooldownMs: 90000,
    honeypotName: 'website_url'
};

export function createSpamGuard(formKey, options = {}) {
    const opts = { ...DEFAULT_OPTS, ...options };
    const openedAt = Date.now();
    const storageKey = `jidhe_spam_${formKey}`;
    let captchaAnswer = 0;

    function getLastSubmit() {
        try {
            return Number(localStorage.getItem(storageKey) || 0);
        } catch {
            return 0;
        }
    }

    function recordSubmit() {
        try {
            localStorage.setItem(storageKey, String(Date.now()));
        } catch { /* ignore */ }
    }

    function attachHoneypot(form) {
        if (form.querySelector(`[name="${opts.honeypotName}"]`)) return;
        const hp = document.createElement('div');
        hp.className = 'spam-honeypot';
        hp.setAttribute('aria-hidden', 'true');
        hp.innerHTML = `<label>لا تملأ هذا الحقل<input type="text" name="${opts.honeypotName}" tabindex="-1" autocomplete="off"></label>`;
        form.prepend(hp);
    }

    function attachCaptcha(form) {
        if (form.querySelector('[data-spam-captcha]')) return;
        const a = Math.floor(Math.random() * 8) + 2;
        const b = Math.floor(Math.random() * 8) + 2;
        captchaAnswer = a + b;

        const group = document.createElement('div');
        group.className = 'form-group';
        group.dataset.spamCaptcha = '1';
        group.innerHTML = `
            <label for="spam-captcha-${formKey}">تحقق: كم ${a} + ${b}؟</label>
            <input type="number" id="spam-captcha-${formKey}" class="spam-captcha-input" required inputmode="numeric" autocomplete="off">
        `;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) form.insertBefore(group, submitBtn);
        else form.appendChild(group);
    }

    function attachToForm(form) {
        attachHoneypot(form);
        attachCaptcha(form);
    }

    function validate(form, values = {}) {
        const honeypot = form?.querySelector(`[name="${opts.honeypotName}"]`)?.value?.trim()
            || values[opts.honeypotName] || '';
        if (honeypot) {
            return { ok: false, message: 'تعذر إرسال النموذج.' };
        }

        if (Date.now() - openedAt < opts.minMs) {
            return { ok: false, message: 'انتظر لحظات قبل الإرسال.' };
        }

        const last = getLastSubmit();
        if (last && Date.now() - last < opts.cooldownMs) {
            const waitSec = Math.ceil((opts.cooldownMs - (Date.now() - last)) / 1000);
            return { ok: false, message: `يمكنك الإرسال مجدداً بعد ${waitSec} ثانية.` };
        }

        const captchaInput = form?.querySelector('.spam-captcha-input');
        if (captchaInput) {
            const given = Number(String(captchaInput.value).trim());
            if (!Number.isFinite(given) || given !== captchaAnswer) {
                return { ok: false, message: 'إجابة التحقق غير صحيحة.' };
            }
        }

        if (opts.maxLengths) {
            for (const [field, max] of Object.entries(opts.maxLengths)) {
                const val = values[field];
                if (typeof val === 'string' && val.length > max) {
                    return { ok: false, message: `الحقل «${field}» أطول من المسموح.` };
                }
            }
        }

        const safety = validatePublicPayload(values);
        if (!safety.ok) return safety;

        return { ok: true };
    }

    return { attachToForm, validate, recordSubmit };
}

import { escapeHtml, sanitizePlainText, isValidEmail, validatePublicPayload } from './security.js';

export { sanitizePlainText as sanitizeText, isValidEmail };
