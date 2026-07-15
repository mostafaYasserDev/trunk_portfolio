import { db, collection, getDocs, getDocsFromCache, query, where, limit, orderBy, doc, getDoc, getDocFromCache } from '../firebase/public.js';
import {
    LOADER_HTML, skeletonCards, skeletonReviews, emptyState, showError, buildContactHtml,
    escapeHtml, updatePageMeta, PAGE_META, initReadingProgress, removeReadingProgress, buildAboutHtml
} from './helpers.js';
import { bindSocialModals } from './social-modal.js';
import { createSpamGuard, sanitizeText, isValidEmail } from './spam-guard.js';
import { sanitizeHttpUrl, sanitizeMediaUrl, sanitizeRichHtml } from './security.js?v=14';
import { HTML_EMBED_RESIZE_MESSAGE, HTML_EMBED_SANDBOX, prepareEmbeddedHtml } from './html-embed.js?v=14';

// Cache-first: serve from IndexedDB instantly, refresh from network silently in background
async function fetchDocsLive(q, callback) {
    try {
        const cached = await getDocsFromCache(q);
        const cachedStr = JSON.stringify(cached.docs.map(d => ({id: d.id, data: d.data()})));
        callback(cached);
        // Background network refresh (silent, no await)
        getDocs(q).then(fresh => { 
            if (!fresh.metadata.fromCache) {
                const freshStr = JSON.stringify(fresh.docs.map(d => ({id: d.id, data: d.data()})));
                if (cachedStr !== freshStr) callback(fresh);
            }
        }).catch(() => {});
        return cached;
    } catch {
        // Nothing in cache yet — must go to network
        return getDocs(q).then(snap => { callback(snap); return snap; }).catch(err => { throw err; });
    }
}

async function fetchDocLive(ref, callback) {
    try {
        const cached = await getDocFromCache(ref);
        const cachedStr = cached.exists() ? JSON.stringify(cached.data()) : null;
        callback(cached);
        // Background network refresh (silent, no await)
        getDoc(ref).then(fresh => { 
            if (!fresh.metadata.fromCache) {
                const freshStr = fresh.exists() ? JSON.stringify(fresh.data()) : null;
                if (cachedStr !== freshStr) callback(fresh);
            }
        }).catch(() => {});
        return cached;
    } catch {
        // Nothing in cache yet — must go to network
        return getDoc(ref).then(snap => { callback(snap); return snap; }).catch(err => { throw err; });
    }
}

// Deep equality helper to prevent redundant re-renders
function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null || typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    const keys1 = Object.keys(obj1), keys2 = Object.keys(obj2);
    if (keys1.length !== keys2.length) return false;
    for (const key of keys1) {
        const val1 = obj1[key], val2 = obj2[key];
        if (val1 && val2 && val1.seconds !== undefined && val2.seconds !== undefined) {
            if (val1.seconds !== val2.seconds || val1.nanoseconds !== val2.nanoseconds) return false;
            continue;
        }
        if (typeof val1 === 'object' && typeof val2 === 'object') {
            if (!deepEqual(val1, val2)) return false;
        } else if (val1 !== val2) {
            return false;
        }
    }
    return true;
}

// Fetch by slug, fallback to document ID if not found
async function fetchDocBySlugOrIdLive(collectionName, identifier, callback) {
    const q = query(collection(db, collectionName), where('slug', '==', identifier), limit(1));
    const ref = doc(db, collectionName, identifier);
    let cachedData = null;
    let cacheFired = false;

    // 1. Attempt Cache First
    try {
        const cachedSlug = await getDocsFromCache(q);
        if (!cachedSlug.empty) {
            const rawDoc = cachedSlug.docs[0];
            cachedData = rawDoc.data();
            cacheFired = true;
            callback({ exists: () => true, data: () => rawDoc.data(), id: rawDoc.id, metadata: { fromCache: true } });
        } else {
            const cachedId = await getDocFromCache(ref);
            cachedData = cachedId.exists() ? cachedId.data() : null;
            cacheFired = true;
            callback(cachedId);
        }
    } catch (e) {
        // Ignore cache miss
    }

    // 2. Network Fetch
    getDocs(q).then(freshSlug => {
        if (!freshSlug.metadata.fromCache) {
            if (!freshSlug.empty) {
                const rawDoc = freshSlug.docs[0];
                const freshData = rawDoc.data();
                if (!deepEqual(cachedData, freshData)) {
                    callback({ exists: () => true, data: () => rawDoc.data(), id: rawDoc.id, metadata: { fromCache: false } });
                }
            } else {
                getDoc(ref).then(freshId => {
                    if (!freshId.metadata.fromCache) {
                        const freshData = freshId.exists() ? freshId.data() : null;
                        if (!deepEqual(cachedData, freshData)) callback(freshId);
                    }
                }).catch(() => { if (!cacheFired) callback({ exists: () => false }); });
            }
        }
    }).catch(() => { if (!cacheFired) callback({ exists: () => false }); });
}



const appRoot = document.getElementById('app-root');
const REVIEWS_LIMIT = 8;
let homeDataLoading = false;
let aosRefreshed = false;

function isHomePath(path) {
    // Only the home/contact views live inside the home shell. The content
    // collections have their own real routes so direct links render listings.
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

function applyContactHtml(html) {
    const footerEl = document.getElementById('footer-contact-info');
    if (footerEl) footerEl.innerHTML = html;
    const contactEl = document.getElementById('dynamic-contact-info');
    if (contactEl) contactEl.innerHTML = html;
    bindSocialModals(document, escapeHtml);
}

let lastContactHtml = '';

function applyContactSnap(snap) {
    lastContactHtml = snap.exists() ? buildContactHtml(snap.data()) : '<p>معلومات التواصل غير متوفرة.</p>';
    applyContactHtml(lastContactHtml);
}

// Load contact info live (cache + network refresh)
fetchDocLive(doc(db, 'settings', 'contact'), applyContactSnap).catch(() => {
    applyContactHtml('<p>تعذر تحميل معلومات التواصل.</p>');
});

const routes = {
    '': renderHome,
    'home': renderHome,
    'all-services': renderServices,
    'all-projects': renderProjects,
    'all-articles': renderArticles,
    'services': renderServices,
    'projects': renderProjects,
    'articles': renderArticles,
    'project': renderProjectDetail,
    'article': renderArticleDetail,
    'service': renderServiceDetail,
    'contact': renderContact
};

function updateActiveNav(path) {
    const activePath = ({
        '': 'home', home: 'home', contact: 'contact',
        services: 'services', 'all-services': 'services', service: 'services',
        projects: 'projects', 'all-projects': 'projects', project: 'projects',
        articles: 'articles', 'all-articles': 'articles', article: 'articles'
    })[path] || path;

    document.querySelectorAll('.main-nav a').forEach(link => {
        link.classList.remove('active');
        const rawHref = link.getAttribute('href') || '';
        let hrefPath = rawHref;
        if (rawHref.startsWith('#')) hrefPath = rawHref.slice(1).split('?')[0];
        else {
            try { hrefPath = new URL(rawHref, window.location.origin).pathname.split('/').filter(Boolean)[0] || 'home'; }
            catch { hrefPath = rawHref; }
        }
        if (hrefPath === activePath || (activePath === 'home' && hrefPath === '')) link.classList.add('active');
    });
}

async function router() {
    let hash = window.location.hash.slice(1);
    let path = 'home';
    let id = '';

    if (hash) {
        [path, id] = hash.split('?id=');
    } else {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            path = pathParts[0];
            if (pathParts.length > 1) {
                id = pathParts[1];
            }
        }
    }
    
    if (!routes[path]) {
        path = 'home';
    }

    // Update URL in address bar for clean sharing
    if (id && (path === 'article' || path === 'project' || path === 'service')) {
        window.history.replaceState(null, '', `/${path}/${encodeURIComponent(decodeURIComponent(id))}`);
    } else if (path === 'home') {
        window.history.replaceState(null, '', '/');
    }

    const isHome = isHomePath(path);

    removeReadingProgress();
    updateActiveNav(path);

    if (isHome && document.getElementById('home-view')) {
        if (path !== 'home' && path !== '') {
            updatePageMeta(PAGE_META[path] || PAGE_META.home);
            setTimeout(() => {
                const targetId = path === 'contact' ? 'contact' : path;
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
            return;
        }
    }

    aosRefreshed = false;

    if (!isHome) {
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

    setTimeout(refreshAosOnce, 60);
    
    if (isHome) {
        if (path !== 'home' && path !== '') {
            setTimeout(() => {
                const targetId = path === 'contact' ? 'contact' : path;
                document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
            }, 120);
        }
    }
}

async function renderContact() {
    await renderHome();
}

function renderServiceCard(data, id, compact = true) {
    const btnCls = compact ? 'btn btn-sm-card' : 'btn';
    const routeId = encodeURIComponent(String(data.slug || id));
    return `<div class="card content-in"><div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.description)}</p><a href="/service/${routeId}" class="${btnCls}">تفاصيل الخدمة</a></div></div>`;
}

function renderProjectCard(data, id) {
    const image = sanitizeMediaUrl(data.mainImage);
    const routeId = encodeURIComponent(String(data.slug || id));
    return `<div class="card content-in">${image ? `<div class="card-img-wrapper"><img src="${escapeHtml(image)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="/project/${routeId}" class="btn">عرض المشروع</a></div></div>`;
}

function renderArticleCard(data, id) {
    const image = sanitizeMediaUrl(data.coverImage);
    const routeId = encodeURIComponent(String(data.slug || id));
    return `<div class="card content-in">${image ? `<div class="card-img-wrapper"><img src="${escapeHtml(image)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="/article/${routeId}" class="btn">اقرأ المزيد</a></div></div>`;
}

function renderReviewCard(data) {
    const serviceLine = data.serviceName ? `<span class="review-service">${escapeHtml(data.serviceName)}</span>` : '';
    return `<div class="review-card content-in">${serviceLine}<h3>${escapeHtml(data.clientName)}</h3><p>"${escapeHtml(data.reviewText)}"</p></div>`;
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
        const cvUrl = sanitizeMediaUrl(data.cvData, { allowImage: false, allowPdf: true });
        if (cvUrl) {
            cvBtn.href = cvUrl;
            cvBtn.style.display = 'inline-flex';
        } else {
            cvBtn.style.display = 'none';
        }
    }
    const aboutContainer = document.getElementById('about-image-container');
    const aboutImageUrl = sanitizeMediaUrl(data.aboutImage, { allowImage: true, allowPdf: false });
    if (aboutContainer) {
        aboutContainer.innerHTML = '';
    }
    if (aboutContainer && aboutImageUrl) {
        const image = document.createElement('img');
        image.src = aboutImageUrl;
        image.alt = 'صورة شخصية';
        image.className = 'about-image content-in';
        image.loading = 'lazy';
        image.decoding = 'async';
        aboutContainer.appendChild(image);
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
        fetchDocLive(doc(db, 'settings', 'general'), applyGeneralSettings).catch(() => {});
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

    const servicesQ = fetchDocsLive(query(collection(db, 'services'), where('featured', '==', true), limit(3)), snap => {
        fillQueryGrid('services-grid', snap, renderServiceCard, 'services');
    }).catch(() => {
        const el = document.getElementById('services-grid');
        if (el) el.innerHTML = showError('تعذر تحميل الخدمات.');
    });

    const projectsQ = fetchDocsLive(query(collection(db, 'projects'), where('featured', '==', true)), snap => {
        let html = '';
        const docs = [];
        snap.forEach(d => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        docs.slice(0, 3).forEach(d => { html += renderProjectCard(d, d.id); });
        document.getElementById('projects-grid').innerHTML = html || emptyState('projects');
    }).catch(() => {
        const el = document.getElementById('projects-grid');
        if (el) el.innerHTML = showError('تعذر تحميل المشاريع.');
    });

    const articlesQ = fetchDocsLive(query(collection(db, 'articles'), orderBy('publishDate', 'desc'), limit(3)), snap => {
        fillQueryGrid('articles-grid', snap, renderArticleCard, 'articles');
    }).catch(() => {
        const el = document.getElementById('articles-grid');
        if (el) el.innerHTML = showError('تعذر تحميل المقالات.');
    });

    const reviewsQ = fetchDocsLive(query(collection(db, 'reviews'), where('visible', '==', true), limit(REVIEWS_LIMIT)), snap => {
        fillReviewsGrid(snap);
    }).catch(() => {
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
        if (btn.disabled) return;
        btn.disabled = true;
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
            btn.disabled = false;
            return;
        }
        if (!isValidEmail(payload.email)) {
            statusEl.textContent = 'أدخل بريداً إلكترونياً صحيحاً.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
            btn.disabled = false;
            return;
        }
        if (payload.name.length < 2 || payload.message.length < 10) {
            statusEl.textContent = 'الاسم أو الرسالة قصيرة جداً.';
            statusEl.className = 'form-status error';
            statusEl.style.display = 'block';
            btn.disabled = false;
            return;
        }

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
        if (lastContactHtml) applyContactHtml(lastContactHtml);
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
        await fetchDocsLive(query(collection(db, 'services')), snap => {
            const grid = document.getElementById('all-services-grid');
            if (!grid) return;
            if (snap.empty) { grid.innerHTML = emptyState('services'); return; }
            let html = '';
            snap.forEach(d => { html += renderServiceCard(d.data(), d.id, false); });
            grid.innerHTML = html;
        });
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
    await setupPagination('projects', 'all-projects-grid', renderProjectCard, 'projects', orderBy('createdAt', 'desc'));
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
    const grid = document.getElementById(containerId);
    const loadMoreBtn = document.getElementById('load-more-btn');
    let currentLimit = 6;

    function renderSnap(snap) {
        if (snap.empty) {
            grid.innerHTML = emptyState(emptyType);
            loadMoreBtn.style.display = 'none';
            return;
        }
        let html = '';
        const docs = snap.docs;
        const hasMore = docs.length > currentLimit;
        const displayDocs = hasMore ? docs.slice(0, currentLimit) : docs;
        displayDocs.forEach(d => { html += renderCardFn(d.data(), d.id); });
        grid.innerHTML = html;
        loadMoreBtn.style.display = hasMore ? 'inline-block' : 'none';
    }

    function buildQuery() {
        const queries = [];
        if (orderQuery) queries.push(orderQuery);
        queries.push(limit(currentLimit + 1));
        return query(collection(db, collectionName), ...queries);
    }

    async function attachListener() {
        const q = buildQuery();
        let cachedStr = null;
        try {
            // Cache-first: serve from IndexedDB instantly
            const cached = await getDocsFromCache(q);
            cachedStr = JSON.stringify(cached.docs.map(d => ({id: d.id, data: d.data()})));
            renderSnap(cached);
            // Background refresh from network (silent)
            getDocs(q).then(fresh => { 
                if (!fresh.metadata.fromCache) {
                    const freshStr = JSON.stringify(fresh.docs.map(d => ({id: d.id, data: d.data()})));
                    if (cachedStr !== freshStr) renderSnap(fresh);
                }
            }).catch(() => {});
        } catch {
            // Nothing in cache — must go to network
            getDocs(q).then(renderSnap).catch(err => {
                console.error(err);
                grid.innerHTML = showError('تعذر الاتصال بقاعدة البيانات.');
                loadMoreBtn.style.display = 'none';
            });
        }
    }

    grid.innerHTML = skeletonCards(3);
    await attachListener();

    const newBtn = loadMoreBtn.cloneNode(true);
    loadMoreBtn.parentNode.replaceChild(newBtn, loadMoreBtn);

    newBtn.addEventListener('click', () => {
        currentLimit += 6;
        attachListener();
    });
}

// ── ملفات HTML الكاملة المرفوعة من لوحة التحكم ──
const activeHtmlIframes = new Set();

window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== HTML_EMBED_RESIZE_MESSAGE) return;
    const height = Number(event.data.height);
    if (!Number.isFinite(height) || height < 50) return;

    for (const iframe of activeHtmlIframes) {
        if (!iframe.isConnected) {
            activeHtmlIframes.delete(iframe);
            continue;
        }
        if (iframe.contentWindow === event.source) {
            iframe.style.height = `${Math.min(100000, Math.ceil(height) + 24)}px`;
            break;
        }
    }
});

function renderHtmlBlocks(container) {
    const origin = window.location.origin;

    activeHtmlIframes.forEach(iframe => {
        if (!iframe.isConnected) activeHtmlIframes.delete(iframe);
    });

    container.querySelectorAll('div.custom-html-block[data-html-src]').forEach(div => {
        try {
            const source = decodeURIComponent(escape(atob(div.getAttribute('data-html-src'))));
            const html = prepareEmbeddedHtml(source, { origin });
            if (!html) return;

            const iframe = document.createElement('iframe');
            iframe.className = 'custom-html-frame';
            iframe.title = 'محتوى HTML مضمّن';
            iframe.style.cssText = [
                'display:block',
                'width:100vw',
                'max-width:100vw',
                'position:relative',
                'right:50%',
                'left:50%',
                'margin-right:-50vw',
                'margin-left:-50vw',
                'border:none',
                'min-height:400px',
                'border-radius:0',
                'overflow:hidden',
                'margin-top:32px',
                'margin-bottom:32px',
            ].join(';');
            iframe.setAttribute('sandbox', HTML_EMBED_SANDBOX);
            iframe.srcdoc = html;

            activeHtmlIframes.add(iframe);
            div.parentNode.replaceChild(iframe, div);
        } catch(e) { console.warn('custom-html-block decode error', e); }
    });
}


async function renderProjectDetail(id) {
    if (!id) return router();
    try {
        await fetchDocBySlugOrIdLive('projects', id, docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const mainImage = sanitizeMediaUrl(data.mainImage);
                const demoLink = sanitizeHttpUrl(data.demoLink);
                const githubLink = sanitizeHttpUrl(data.githubLink);
                updatePageMeta({ title: `${data.title} - جذع`, description: data.shortDescription || data.title, image: mainImage, url: `${window.location.origin}/project/${encodeURIComponent(data.slug || id)}`, schemaType: 'CreativeWork', imageAlt: data.title });
                appRoot.innerHTML = `
                    <div class="view active">
                        <div class="detail-header">
                            <span class="trunk-badge">مشروع جذع</span>
                            <h1>${escapeHtml(data.title)}</h1>
                            <div class="detail-meta"><span>التقنيات: ${escapeHtml(data.technologies)}</span></div>
                        </div>
                        ${mainImage ? `<img src="${escapeHtml(mainImage)}" class="detail-cover" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async">` : ''}
                        <div class="detail-content">
                            <div>${sanitizeRichHtml(data.fullDescription || '')}</div>
                            <div style="margin-top: 30px; display: flex; gap: 15px; flex-wrap: wrap;">
                                ${demoLink ? `<a href="${escapeHtml(demoLink)}" target="_blank" rel="noopener noreferrer" class="btn">معاينة حية</a>` : ''}
                                ${githubLink ? `<a href="${escapeHtml(githubLink)}" target="_blank" rel="noopener noreferrer" class="btn" style="background:var(--text-main);">الكود المصدري</a>` : ''}
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 40px;">
                            <a href="/projects" class="btn" style="background:var(--text-muted);">العودة للمشاريع</a>
                        </div>
                    </div>
                `;
                // ── Guarantee all inline-btn links open in new tab (never site navigation) ──
                appRoot.querySelectorAll('a.inline-btn').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    const h = a.getAttribute('href') || '';
                    const safe = /^mailto:/i.test(h) ? '' : sanitizeHttpUrl(/^https?:\/\//i.test(h) ? h : `https://${h}`);
                    if (safe) a.setAttribute('href', safe); else a.removeAttribute('href');
                });
                renderHtmlBlocks(appRoot);
            } else appRoot.innerHTML = showError('المشروع غير موجود.');
        });
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل المشروع.'); }
}

async function renderArticleDetail(id) {
    if (!id) return router();
    try {
        await fetchDocBySlugOrIdLive('articles', id, docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const coverImage = sanitizeMediaUrl(data.coverImage);
                updatePageMeta({ title: `${data.title} - جذع`, description: data.shortDescription || data.title, image: coverImage, url: `${window.location.origin}/article/${encodeURIComponent(data.slug || id)}`, schemaType: 'Article', imageAlt: data.title, author: data.author || 'مصطفى ياسر', publishedAt: data.publishDate });
                appRoot.innerHTML = `
                    <div class="view active">
                        <div class="detail-header">
                            <span class="trunk-badge">مقال</span>
                            <h1>${escapeHtml(data.title)}</h1>
                            <div class="detail-meta"><span>نُشر في: ${escapeHtml(data.publishDate)}</span></div>
                        </div>
                        ${coverImage ? `<img src="${escapeHtml(coverImage)}" class="detail-cover" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async">` : ''}
                        <div class="detail-content">${sanitizeRichHtml(data.content || '')}</div>
                        <div style="text-align: center; margin-top: 40px;">
                            <a href="/articles" class="btn" style="background:var(--text-muted);">العودة للمقالات</a>
                        </div>
                    </div>
                `;
                // ── Guarantee all inline-btn links open in new tab (never site navigation) ──
                appRoot.querySelectorAll('a.inline-btn').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    const h = a.getAttribute('href') || '';
                    const safe = /^mailto:/i.test(h) ? '' : sanitizeHttpUrl(/^https?:\/\//i.test(h) ? h : `https://${h}`);
                    if (safe) a.setAttribute('href', safe); else a.removeAttribute('href');
                });
                renderHtmlBlocks(appRoot);
                initReadingProgress();
            } else appRoot.innerHTML = showError('المقال غير موجود.');
        });
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل المقال.'); }
}

async function renderServiceDetail(id) {
    if (!id) return router();
    try {
        await fetchDocBySlugOrIdLive('services', id, docSnap => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                updatePageMeta({ title: `${data.title} - جذع`, description: data.description || data.title, url: `${window.location.origin}/service/${encodeURIComponent(data.slug || id)}`, schemaType: 'Service', imageAlt: data.title });
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
                                <a href="/contact" class="btn">اطلب الخدمة الآن</a>
                            </div>
                        </div>
                        <div style="text-align: center; margin-top: 40px;">
                            <a href="/services" class="btn" style="background:var(--text-muted);">العودة للخدمات</a>
                        </div>
                    </div>
                `;
            } else appRoot.innerHTML = showError('الخدمة غير موجودة.');
        });
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل الخدمة.'); }
}

function bootRouter() {
    router();
}

window.addEventListener('hashchange', router);
window.addEventListener('popstate', router);
let initialPath = 'home';
if (window.location.hash) {
    initialPath = window.location.hash.slice(1).split('?id=')[0] || 'home';
} else {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0) initialPath = parts[0];
}

if (isHomePath(initialPath)) {
    queueMicrotask(loadHomeData);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootRouter);
} else {
    bootRouter();
}
