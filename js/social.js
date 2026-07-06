import { registerSocialModalLinks } from './social-modal.js';

export const SOCIAL_PRESETS = {
    linkedin: { label: 'لينكدإن', fa: 'fab fa-linkedin-in' },
    telegram: { label: 'تليجرام', fa: 'fab fa-telegram' },
    github: { label: 'جيتهب', fa: 'fab fa-github' },
    facebook: { label: 'فيسبوك', fa: 'fab fa-facebook-f' },
    instagram: { label: 'إنستغرام', fa: 'fab fa-instagram' },
    tiktok: { label: 'تيك توك', fa: 'fab fa-tiktok' },
    youtube: { label: 'يوتيوب', fa: 'fab fa-youtube' },
    twitter: { label: 'X (تويتر)', fa: 'fab fa-x-twitter' },
    whatsapp: { label: 'واتساب', fa: 'fab fa-whatsapp' },
    qabilah: { label: 'قبيلة', fa: 'fas fa-users' },
    mrtakz: { label: 'مرتكز', fa: 'fas fa-briefcase' },
    snapchat: { label: 'سناب شات', fa: 'fab fa-snapchat' },
    discord: { label: 'ديسكورد', fa: 'fab fa-discord' },
    behance: { label: 'بيهانس', fa: 'fab fa-behance' },
    dribbble: { label: 'Dribbble', fa: 'fab fa-dribbble' },
    custom: { label: 'مخصص / أخرى', fa: 'fas fa-link' }
};

export const PRIMARY_SOCIAL_KEYS = ['telegram', 'linkedin', 'github'];

export const DEFAULT_ABOUT_TEXT = `مرحباً! أنا مطور واجهات ومصمم تجربة مستخدم شغوف ببناء مواقع وتطبيقات ويب سريعة ومميزة. أؤمن بأن البرمجة كالشجرة؛ تبدأ ببذرة (الفكرة)، وتمتد جذورها (الكود الأساسي)، ثم تتفرع أغصانها (الواجهة) لتثمر في النهاية تجربة مستخدم رائعة.

أسعى دائماً لتقديم حلول تقنية تجمع بين الأداء العالي والتصميم الجذاب، مع التركيز على كتابة كود نظيف وقابل للتطوير.`;

function formatTelegramUrl(value) {
    const v = String(value || '').trim();
    if (!v) return '';
    if (v.startsWith('http')) return v;
    return `https://t.me/${v.replace(/^@/, '')}`;
}

function normalizePrimaryField(data, key) {
    const visibleKey = `${key}Visible`;
    let url = '';
    let visible = true;

    if (key in data) {
        url = key === 'telegram' ? formatTelegramUrl(data[key]) : String(data[key] || '').trim();
        visible = data[visibleKey] !== false;
    } else if (Array.isArray(data.socialLinks)) {
        const fromList = data.socialLinks.find(l => l.preset === key && String(l.url || '').trim());
        if (fromList) {
            url = key === 'telegram' ? formatTelegramUrl(fromList.url) : String(fromList.url).trim();
            visible = fromList.visible !== false;
        }
    }

    return { url, visible };
}

export function normalizeContactSocial(data = {}) {
    const primary = {};
    PRIMARY_SOCIAL_KEYS.forEach((key) => {
        primary[key] = normalizePrimaryField(data, key);
    });

    let extras = [];
    if (Array.isArray(data.extraSocialLinks) && data.extraSocialLinks.length) {
        extras = data.extraSocialLinks.map((link, i) => ({
            id: link.id || `extra-${i}`,
            preset: link.preset || 'custom',
            label: link.label || '',
            url: String(link.url || '').trim(),
            customIcon: link.customIcon || '',
            visible: link.visible !== false,
            order: typeof link.order === 'number' ? link.order : i
        }));
    } else if (Array.isArray(data.socialLinks)) {
        extras = data.socialLinks
            .filter(l => !PRIMARY_SOCIAL_KEYS.includes(l.preset))
            .map((link, i) => ({
                id: link.id || `extra-${i}`,
                preset: link.preset || 'custom',
                label: link.label || '',
                url: String(link.url || '').trim(),
                customIcon: link.customIcon || '',
                visible: link.visible !== false,
                order: typeof link.order === 'number' ? link.order : i
            }));
    }

    return { primary, extras };
}

function renderPrimaryIcon(presetKey) {
    const preset = SOCIAL_PRESETS[presetKey];
    return `<i class="${preset.fa}" aria-hidden="true"></i>`;
}

function toModalLink(key, url) {
    const preset = SOCIAL_PRESETS[key];
    return {
        preset: key,
        url,
        label: preset.label,
        customIcon: '',
        fa: preset.fa
    };
}

function toModalExtra(link) {
    const preset = SOCIAL_PRESETS[link.preset] || SOCIAL_PRESETS.custom;
    return {
        preset: link.preset,
        url: link.url,
        label: link.label || preset.label,
        customIcon: link.customIcon || '',
        fa: preset.fa
    };
}

export function buildSocialHtml(data, escapeHtml) {
    const { primary, extras } = normalizeContactSocial(data);

    const primaryLinks = PRIMARY_SOCIAL_KEYS
        .map(key => ({ key, ...primary[key] }))
        .filter(item => item.visible && item.url);

    const extraLinks = extras
        .filter(link => link.visible && link.url)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (!primaryLinks.length && !extraLinks.length) return '';

    const allModalLinks = [
        ...primaryLinks.map(({ key, url }) => toModalLink(key, url)),
        ...extraLinks.map(toModalExtra)
    ];

    let html = '<div class="social-bar">';

    if (primaryLinks.length || extraLinks.length) {
        html += '<div class="social-links social-links--primary">';
        primaryLinks.forEach(({ key, url }) => {
            const label = SOCIAL_PRESETS[key].label;
            html += `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${renderPrimaryIcon(key)}<span>${escapeHtml(label)}</span></a>`;
        });

        if (extraLinks.length) {
            const modalId = registerSocialModalLinks(allModalLinks);
            html += `<button type="button" class="social-more-btn" data-social-modal="${modalId}" aria-label="عرض جميع روابط التواصل" title="المزيد من قنوات التواصل"><i class="fas fa-plus" aria-hidden="true"></i><span>المزيد</span></button>`;
        }

        html += '</div>';
    }

    html += '</div>';
    return html;
}

export function buildAboutHtml(aboutText, escapeHtml) {
    const text = (aboutText || DEFAULT_ABOUT_TEXT).trim();
    return text
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
}
