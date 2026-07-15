import { buildSocialHtml as buildSocialFromData, buildAboutHtml, DEFAULT_ABOUT_TEXT } from './social.js';
import { escapeHtml } from './security.js?v=12';

export { buildAboutHtml, DEFAULT_ABOUT_TEXT, escapeHtml };

export const LOADER_HTML = `
    <div class="loader-container">
        <div class="tree-spinner"></div>
        <div class="loader-text">الجذور تنمو...</div>
    </div>
`;

export function skeletonCards(count = 3) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-card"><div class="skeleton-img"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
    }
    return html;
}

export function skeletonReviews(count = 2) {
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<div class="skeleton-card review-skeleton-card"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>`;
    }
    return html;
}

const EMPTY_STATES = {
    services: { emoji: '🌿', title: 'الخدمات تنمو', text: 'لم أضف خدمات بعد، لكن الجذور تستعد للنمو قريباً.' },
    projects: { emoji: '🌳', title: 'أغصان جديدة قادمة', text: 'المشاريع قيد الإعداد. عد قريباً لاستكشاف حكايات جديدة.' },
    articles: { emoji: '📜', title: 'صفحات فارغة مؤقتاً', text: 'المقالات في الطريق. ستجد هنا قصصاً تقنية قريباً.' },
    reviews: { emoji: '💬', title: 'بانتظار أصواتكم', text: 'كن أول من يشارك تجربته مع جذع.' },
    items: { emoji: '🍂', title: 'لا شيء هنا بعد', text: 'المحتوى في طريقه إليك.' }
};

export function emptyState(type = 'items') {
    const s = EMPTY_STATES[type] || EMPTY_STATES.items;
    return `<div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-emoji">${s.emoji}</div>
        <h3>${s.title}</h3>
        <p>${s.text}</p>
    </div>`;
}

const DEFAULT_META = {
    title: 'جذع - حكاية تنمو',
    description: 'جذع - بورتفوليو شخصي. أروي حكايات برمجية بروح فنية ولمسة إبداعية.'
};

export function showError(msg) {
    return `<div class="error-state"><p>${escapeHtml(msg)}</p></div>`;
}

export function buildSocialHtml(data) {
    return buildSocialFromData(data, escapeHtml);
}

export function buildContactHtml(data) {
    let html = '';
    if (data.email) html += `<p><i class="fas fa-envelope"></i> <a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></p>`;
    if (data.phone) html += `<p><i class="fas fa-phone"></i> <span dir="ltr">${escapeHtml(data.phone)}</span></p>`;
    html += buildSocialHtml(data);
    return html || '<p>معلومات التواصل غير متوفرة.</p>';
}

function getSiteBase() {
    return window.location.origin + '/';
}

function setMetaContent(id, content) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', content);
}

function canonicalUrl(url) {
    if (url) return url;
    const current = new URL(window.location.href);
    current.hash = '';
    return current.href;
}

function updateCanonical(url) {
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
    }
    link.href = url;
    setMetaContent('og-url', url);
}

function updateDynamicJsonLd(meta, url) {
    let script = document.querySelector('script[data-dynamic-seo]');
    if (!script) {
        script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.dynamicSeo = 'true';
        document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: meta.title,
        description: meta.description,
        url,
        image: meta.image,
        inLanguage: 'ar'
    });
}

export function updatePageMeta({ title, description, image, url } = {}) {
    const meta = {
        title: title || DEFAULT_META.title,
        description: description || DEFAULT_META.description,
        image: image || `${getSiteBase()}assets/logo.png`,
        url: canonicalUrl(url)
    };
    document.title = meta.title;
    setMetaContent('meta-description', meta.description);
    setMetaContent('og-title', meta.title);
    setMetaContent('og-description', meta.description);
    setMetaContent('og-image', meta.image);
    setMetaContent('twitter-title', meta.title);
    setMetaContent('twitter-description', meta.description);
    setMetaContent('twitter-image', meta.image);
    updateCanonical(meta.url);
    updateDynamicJsonLd(meta, meta.url);
}

export const PAGE_META = {
    home: { title: 'جذع - حكاية تنمو', description: DEFAULT_META.description },
    services: { title: 'الخدمات - جذع', description: 'استكشف خدمات جذع البرمجية والتصميمية.' },
    projects: { title: 'المشاريع - جذع', description: 'تصفح مشاريع جذع البرمجية والإبداعية.' },
    articles: { title: 'المقالات - جذع', description: 'اقرأ أحدث مقالات جذع التقنية والإبداعية.' },
    contact: { title: 'تواصل معي - جذع', description: 'تواصل مع جذع لبدء مشروعك القادم.' }
};

let readingProgressHandler = null;

export function initReadingProgress() {
    removeReadingProgress();
    let bar = document.createElement('div');
    bar.id = 'reading-progress';
    bar.setAttribute('role', 'progressbar');
    document.body.appendChild(bar);

    readingProgressHandler = () => {
        const content = document.querySelector('.detail-content');
        if (!content) return;
        const top = content.offsetTop;
        const height = content.offsetHeight;
        const winH = window.innerHeight;
        const scrollable = height - winH;
        if (scrollable <= 0) { bar.style.width = '100%'; return; }
        const scrolled = window.scrollY - top;
        const pct = Math.min(100, Math.max(0, (scrolled / scrollable) * 100));
        bar.style.width = pct + '%';
    };
    window.addEventListener('scroll', readingProgressHandler, { passive: true });
    readingProgressHandler();
}

export function removeReadingProgress() {
    if (readingProgressHandler) {
        window.removeEventListener('scroll', readingProgressHandler);
        readingProgressHandler = null;
    }
    document.getElementById('reading-progress')?.remove();
}
