import { db, collection, getDocs, query, where, limit, orderBy, doc, getDoc, startAfter } from '../firebase/public.js';
import {
    LOADER_HTML, skeletonCards, skeletonReviews, emptyState, showError, buildContactHtml,
    escapeHtml, updatePageMeta, PAGE_META, initReadingProgress, removeReadingProgress, buildAboutHtml
} from './helpers.js';
import { bindSocialModals } from './social-modal.js';
import { createSpamGuard, sanitizeText, isValidEmail } from './spam-guard.js';

const appRoot = document.getElementById('app-root');
const REVIEWS_LIMIT = 8;
let contactRequest = null;
let homeDataLoading = false;
let aosRefreshed = false;

function isHomePath(path) {
    return path === 'home' || path === '' || path === 'contact';
}

function getHomeShellHtml() {
    const tpl = document.getElementById('home-shell');
    return tpl ? tpl.innerHTML : '';
}

function refreshAosOnce() {
    if (aosRefreshed || typeof AOS === 'undefined') return;
    aosRefreshed = true;
    requestAnimationFrame(() => AOS.refreshHard());
}

function fetchContactSettings() {
    if (!contactRequest) {
        contactRequest = getDoc(doc(db, 'settings', 'contact'));
    }
    return contactRequest;
}

function applyContactHtml(html) {
    const footerEl = document.getElementById('footer-contact-info');
    if (footerEl) footerEl.innerHTML = html;
    const contactEl = document.getElementById('dynamic-contact-info');
    if (contactEl) contactEl.innerHTML = html;
    bindSocialModals(document, escapeHtml);
}

function applyContactSnap(snap) {
    const html = snap.exists() ? buildContactHtml(snap.data()) : '<p>معلومات التواصل غير متوفرة.</p>';
    applyContactHtml(html);
}

fetchContactSettings().then(applyContactSnap).catch(() => {
    applyContactHtml('<p>تعذر تحميل معلومات التواصل.</p>');
});

const routes = {
    '': renderHome,
    'home': renderHome,
    'services': renderServices,
    'projects': renderProjects,
    'articles': renderArticles,
    'project': renderProjectDetail,
    'article': renderArticleDetail,
    'service': renderServiceDetail,
    'contact': renderContact
};

function updateActiveNav(path) {
    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href').slice(1);
        if (href === path || (path === '' && href === 'home')) link.classList.add('active');
    });
}

async function router() {
    const hash = window.location.hash.slice(1) || 'home';
    const [path, id] = hash.split('?id=');
    const isHome = isHomePath(path);

    removeReadingProgress();
    updateActiveNav(path);

    if (path === 'contact' && document.getElementById('home-view')) {
        updatePageMeta(PAGE_META.contact);
        setTimeout(() => {
            document.getElementById('contact-sec')?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        return;
    }

    if (!isHome) {
        aosRefreshed = false;
        appRoot.innerHTML = LOADER_HTML;
        window.scrollTo({ top: 0 });
    }

    const viewFunction = routes[path];
    if (viewFunction) {
        await viewFunction(id);
        if (path !== 'project' && path !== 'article' && path !== 'service') {
            const meta = PAGE_META[path] || PAGE_META.home;
            updatePageMeta(meta);
        }
    } else {
        appRoot.innerHTML = showError('الصفحة غير موجودة.');
        updatePageMeta(PAGE_META.home);
    }

    if (isHome) {
        setTimeout(refreshAosOnce, 60);
        if (path === 'contact') {
            setTimeout(() => document.getElementById('contact-sec')?.scrollIntoView({ behavior: 'smooth' }), 120);
        }
    }
}

async function renderContact() {
    await renderHome();
}

function renderServiceCard(data, id, compact = true) {
    const btnCls = compact ? 'btn btn-sm-card' : 'btn';
    return `<div class="card content-in"><div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.description)}</p><a href="#service?id=${id}" class="${btnCls}">تفاصيل الخدمة</a></div></div>`;
}

function renderProjectCard(data, id) {
    return `<div class="card content-in">${data.mainImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.mainImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#project?id=${id}" class="btn">عرض المشروع</a></div></div>`;
}

function renderArticleCard(data, id) {
    return `<div class="card content-in">${data.coverImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.coverImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#article?id=${id}" class="btn">اقرأ المزيد</a></div></div>`;
}

function renderReviewCard(data) {
    const serviceLine = data.serviceName ? `<span class="review-service">${escapeHtml(data.serviceName)}</span>` : '';
    return `<div class="review-card content-in">${serviceLine}<h4>${escapeHtml(data.clientName)}</h4><p>"${escapeHtml(data.reviewText)}"</p></div>`;
}

function fillQueryGrid(elId, snap, renderFn, emptyType) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (snap.empty) {
        el.innerHTML = emptyState(emptyType);
        return;
    }
    let html = '';
    snap.forEach(d => { html += renderFn(d.data(), d.id); });
    el.innerHTML = html;
}

function fillReviewsGrid(snap) {
    const el = document.getElementById('reviews-grid');
    if (!el) return;
    if (snap.empty) {
        el.innerHTML = emptyState('reviews');
        return;
    }
    let html = '';
    snap.forEach(d => { html += renderReviewCard(d.data()); });
    el.innerHTML = html;
}

function applyGeneralSettings(snap) {
    if (!snap.exists()) return;
    const data = snap.data();
    const cvBtn = document.getElementById('cv-download-btn');
    if (cvBtn) {
        if (data.cvData) {
            cvBtn.href = data.cvData;
            cvBtn.style.display = 'inline-flex';
        } else {
            cvBtn.style.display = 'none';
        }
    }
    const aboutContainer = document.getElementById('about-image-container');
    if (aboutContainer && data.aboutImage) {
        aboutContainer.innerHTML = `<img src="${data.aboutImage}" alt="صورة شخصية" class="about-image content-in" loading="lazy" decoding="async">`;
    }
    const aboutTextEl = document.getElementById('about-text-content');
    if (aboutTextEl && data.aboutText) {
        aboutTextEl.innerHTML = buildAboutHtml(data.aboutText, escapeHtml);
    }
}

let generalSettingsLoaded = false;

function loadGeneralSettingsDeferred() {
    const aboutSection = document.querySelector('.about-section');
    if (!aboutSection) return;

    const load = () => {
        if (generalSettingsLoaded) return;
        generalSettingsLoaded = true;
        getDoc(doc(db, 'settings', 'general'))
            .then(applyGeneralSettings)
            .catch(() => {});
    };

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) {
                observer.disconnect();
                load();
            }
        }, { rootMargin: '200px' });
        observer.observe(aboutSection);
        setTimeout(load, 5000);
    } else {
        setTimeout(load, 300);
    }
}

function loadHomeData() {
    if (homeDataLoading) return;
    homeDataLoading = true;

    fetchContactSettings().then(applyContactSnap).catch(() => {});

    const servicesQ = getDocs(query(collection(db, 'services'), where('featured', '==', true), limit(3)));
    const projectsQ = getDocs(query(collection(db, 'projects'), where('featured', '==', true), limit(3)));
    const articlesQ = getDocs(query(collection(db, 'articles'), orderBy('publishDate', 'desc'), limit(3)));
    const reviewsQ = getDocs(query(collection(db, 'reviews'), where('visible', '==', true), limit(REVIEWS_LIMIT)));

    servicesQ
        .then(snap => fillQueryGrid('services-grid', snap, renderServiceCard, 'services'))
        .catch(() => {
            const el = document.getElementById('services-grid');
            if (el) el.innerHTML = showError('تعذر تحميل الخدمات.');
        });

    projectsQ
        .then(snap => fillQueryGrid('projects-grid', snap, renderProjectCard, 'projects'))
        .catch(() => {
            const el = document.getElementById('projects-grid');
            if (el) el.innerHTML = showError('تعذر تحميل المشاريع.');
        });

    articlesQ
        .then(snap => fillQueryGrid('articles-grid', snap, renderArticleCard, 'articles'))
        .catch(() => {
            const el = document.getElementById('articles-grid');
            if (el) el.innerHTML = showError('تعذر تحميل المقالات.');
        });

    reviewsQ
        .then(fillReviewsGrid)
        .catch(() => {
            const el = document.getElementById('reviews-grid');
            if (el) el.innerHTML = showError('تعذر تحميل الآراء.');
        });

    loadGeneralSettingsDeferred();

    Promise.allSettled([servicesQ, projectsQ, articlesQ, reviewsQ]).then(() => {
        homeDataLoading = false;
        refreshAosOnce();
    });
}

function bindHomeContactForm() {
    const contactForm = document.getElementById('public-contact-form');
    if (!contactForm || contactForm.dataset.bound === '1') return;
    contactForm.dataset.bound = '1';

    const spam = createSpamGuard('contact', {
        maxLengths: { name: 100, email: 120, message: 3000 }
    });
    spam.attachToForm(contactForm);

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = contactForm.querySelector('button[type="submit"]');
        const statusEl = document.getElementById('form-status');
        const payload = {
            name: sanitizeText(document.getElementById('contact-name').value, 100),
            email: sanitizeText(document.getElementById('contact-email-input').value, 120),
            message: sanitizeText(document.getElementById('contact-message').value, 3000)
        };

        const check = spam.validate(contactForm, payload);
        if (!check.ok) {
            statusEl.textContent = check.message;
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
            return;
        }
        if (!isValidEmail(payload.email)) {
            statusEl.textContent = 'أدخل بريداً إلكترونياً صحيحاً.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'جاري الإرسال...';
        statusEl.className = 'form-status';
        statusEl.style.display = 'none';
        try {
            const { addDoc } = await import('../firebase/public.js');
            await addDoc(collection(db, 'messages'), {
                name: payload.name,
                email: payload.email,
                message: payload.message,
                date: new Date().toISOString(),
                read: false,
                source: 'contact-form'
            });
            spam.recordSubmit();
            contactForm.reset();
            spam.attachToForm(contactForm);
            statusEl.textContent = 'تم إرسال رسالتك بنجاح! سأتواصل معك قريباً.';
            statusEl.className = 'form-status success';
            statusEl.style.display = 'block';
        } catch (err) {
            console.error(err);
            statusEl.textContent = 'حدث خطأ أثناء الإرسال. حاول مجدداً.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
        } finally {
            btn.textContent = 'إرسال الرسالة';
            btn.disabled = false;
        }
    });
}

async function renderHome() {
    updatePageMeta(PAGE_META.home);

    if (!document.getElementById('home-view')) {
        appRoot.innerHTML = getHomeShellHtml();
        bindHomeContactForm();
    } else {
        bindHomeContactForm();
    }

    loadHomeData();
}

async function renderServices() {
    appRoot.innerHTML = `
        <div class="view active">
            <section>
                <h1 class="section-title">جميع الخدمات</h1>
                <div class="grid" id="all-services-grid">${skeletonCards(3)}</div>
            </section>
        </div>
    `;
    try {
        const snap = await getDocs(collection(db, 'services'));
        const grid = document.getElementById('all-services-grid');
        if (!grid) return;
        if (snap.empty) { grid.innerHTML = emptyState('services'); return; }
        let html = '';
        snap.forEach(d => { html += renderServiceCard(d.data(), d.id, false); });
        grid.innerHTML = html;
    } catch (e) {
        document.getElementById('all-services-grid').innerHTML = showError('تعذر تحميل الخدمات.');
    }
}

async function renderProjects() {
    appRoot.innerHTML = `
        <div class="view active">
            <section>
                <h1 class="section-title">جميع المشاريع</h1>
                <div class="grid" id="all-projects-grid">${skeletonCards(3)}</div>
                <div style="text-align: center; margin-top: 40px;">
                    <button id="load-more-btn" class="btn" style="display: none;">عرض المزيد</button>
                </div>
            </section>
        </div>
    `;
    await setupPagination('projects', 'all-projects-grid', renderProjectCard, 'projects');
}

async function renderArticles() {
    appRoot.innerHTML = `
        <div class="view active">
            <section>
                <h1 class="section-title">المقالات</h1>
                <div class="grid" id="all-articles-grid">${skeletonCards(3)}</div>
                <div style="text-align: center; margin-top: 40px;">
                    <button id="load-more-btn" class="btn" style="display: none;">عرض المزيد</button>
                </div>
            </section>
        </div>
    `;
    await setupPagination('articles', 'all-articles-grid', renderArticleCard, 'articles', orderBy('publishDate', 'desc'));
}

async function setupPagination(collectionName, containerId, renderCardFn, emptyType, orderQuery = null) {
    let lastVisible = null;
    const PAGE_SIZE = 6;
    const grid = document.getElementById(containerId);
    const loadMoreBtn = document.getElementById('load-more-btn');

    async function loadChunk(isFirst = false) {
        if (isFirst) grid.innerHTML = skeletonCards(3);
        loadMoreBtn.style.display = 'none';
        try {
            const queries = [];
            if (orderQuery) queries.push(orderQuery);
            if (lastVisible) queries.push(startAfter(lastVisible));
            queries.push(limit(PAGE_SIZE));
            const snap = await getDocs(query(collection(db, collectionName), ...queries));
            if (snap.empty && isFirst) {
                grid.innerHTML = emptyState(emptyType);
            } else if (!snap.empty) {
                if (isFirst) grid.innerHTML = '';
                lastVisible = snap.docs[snap.docs.length - 1];
                snap.forEach(d => { grid.innerHTML += renderCardFn(d.data(), d.id); });
                if (snap.docs.length === PAGE_SIZE) loadMoreBtn.style.display = 'inline-block';
            }
        } catch (e) {
            console.error(e);
            if (isFirst) grid.innerHTML = showError('تعذر الاتصال بقاعدة البيانات.');
        }
    }
    loadMoreBtn.addEventListener('click', () => loadChunk(false));
    await loadChunk(true);
}

async function renderProjectDetail(id) {
    if (!id) return router();
    try {
        const docSnap = await getDoc(doc(db, 'projects', id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            updatePageMeta({ title: `${data.title} - جذع`, description: data.shortDescription || data.title, image: data.mainImage });
            appRoot.innerHTML = `
                <div class="view active">
                    <div class="detail-header">
                        <span class="trunk-badge">مشروع جذع</span>
                        <h1>${escapeHtml(data.title)}</h1>
                        <div class="detail-meta"><span>التقنيات: ${escapeHtml(data.technologies)}</span></div>
                    </div>
                    ${data.mainImage ? `<img src="${escapeHtml(data.mainImage)}" class="detail-cover" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async">` : ''}
                    <div class="detail-content">
                        <p>${escapeHtml(data.fullDescription).replace(/\n/g, '<br>')}</p>
                        <div style="margin-top: 30px; display: flex; gap: 15px; flex-wrap: wrap;">
                            ${data.demoLink ? `<a href="${escapeHtml(data.demoLink)}" target="_blank" rel="noopener" class="btn">معاينة حية</a>` : ''}
                            ${data.githubLink ? `<a href="${escapeHtml(data.githubLink)}" target="_blank" rel="noopener" class="btn" style="background:var(--text-main);">الكود المصدري</a>` : ''}
                            ${!data.demoLink && !data.githubLink ? '' : ''}
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="#projects" class="btn" style="background:var(--text-muted);">العودة للمشاريع</a>
                    </div>
                </div>
            `;
        } else appRoot.innerHTML = showError('المشروع غير موجود.');
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل المشروع.'); }
}

async function renderArticleDetail(id) {
    if (!id) return router();
    try {
        const docSnap = await getDoc(doc(db, 'articles', id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            updatePageMeta({ title: `${data.title} - جذع`, description: data.shortDescription || data.title, image: data.coverImage });
            appRoot.innerHTML = `
                <div class="view active">
                    <div class="detail-header">
                        <span class="trunk-badge">مقال</span>
                        <h1>${escapeHtml(data.title)}</h1>
                        <div class="detail-meta"><span>نُشر في: ${escapeHtml(data.publishDate)}</span></div>
                    </div>
                    ${data.coverImage ? `<img src="${escapeHtml(data.coverImage)}" class="detail-cover" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async">` : ''}
                    <div class="detail-content">${data.content}</div>
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="#articles" class="btn" style="background:var(--text-muted);">العودة للمقالات</a>
                    </div>
                </div>
            `;
            initReadingProgress();
        } else appRoot.innerHTML = showError('المقال غير موجود.');
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل المقال.'); }
}

async function renderServiceDetail(id) {
    if (!id) return router();
    try {
        const docSnap = await getDoc(doc(db, 'services', id));
        if (docSnap.exists()) {
            const data = docSnap.data();
            updatePageMeta({ title: `${data.title} - جذع`, description: data.description || data.title });
            appRoot.innerHTML = `
                <div class="view active">
                    <div class="detail-header">
                        <span class="trunk-badge">خدمة</span>
                        <h1>${escapeHtml(data.title)}</h1>
                    </div>
                    <div class="detail-content glass-panel" style="padding: 40px; border-radius: 20px; text-align: center; margin-top: 30px;">
                        <h2>تفاصيل الخدمة</h2>
                        <p style="font-size: 1.2rem; line-height: 2;">${escapeHtml(data.description)}</p>
                        <div style="margin-top: 40px;">
                            <a href="#contact" class="btn">اطلب الخدمة الآن</a>
                        </div>
                    </div>
                    <div style="text-align: center; margin-top: 40px;">
                        <a href="#services" class="btn" style="background:var(--text-muted);">العودة للخدمات</a>
                    </div>
                </div>
            `;
        } else appRoot.innerHTML = showError('الخدمة غير موجودة.');
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل الخدمة.'); }
}

function bootRouter() {
    router();
}

window.addEventListener('hashchange', router);
const initialPath = (window.location.hash.slice(1) || 'home').split('?id=')[0];
if (isHomePath(initialPath)) {
    queueMicrotask(loadHomeData);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRouter);
} else {
    bootRouter();
}
