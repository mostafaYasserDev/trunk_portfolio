import { db, collection, getDocs, getDocsFromCache, query, where, limit, orderBy, doc, getDoc, getDocFromCache } from '../firebase/public.js';
import {
    LOADER_HTML, skeletonCards, skeletonReviews, emptyState, showError, buildContactHtml,
    escapeHtml, updatePageMeta, PAGE_META, initReadingProgress, removeReadingProgress, buildAboutHtml
} from './helpers.js';
import { bindSocialModals } from './social-modal.js';
import { createSpamGuard, sanitizeText, isValidEmail } from './spam-guard.js';

// Cache-first: serve from IndexedDB instantly, refresh from network silently in background
async function fetchDocsLive(q, callback) {
    try {
        const cached = await getDocsFromCache(q);
        callback(cached);
        // Background network refresh (silent, no await)
        getDocs(q).then(fresh => { if (!fresh.metadata.fromCache) callback(fresh); }).catch(() => {});
        return cached;
    } catch {
        // Nothing in cache yet — must go to network
        return getDocs(q).then(snap => { callback(snap); return snap; }).catch(err => { throw err; });
    }
}

async function fetchDocLive(ref, callback) {
    try {
        const cached = await getDocFromCache(ref);
        callback(cached);
        // Background network refresh (silent, no await)
        getDoc(ref).then(fresh => { if (!fresh.metadata.fromCache) callback(fresh); }).catch(() => {});
        return cached;
    } catch {
        // Nothing in cache yet — must go to network
        return getDoc(ref).then(snap => { callback(snap); return snap; }).catch(err => { throw err; });
    }
}

// Fetch by slug, fallback to document ID if not found
async function fetchDocBySlugOrIdLive(collectionName, identifier, callback) {
    const q = query(collection(db, collectionName), where('slug', '==', identifier), limit(1));
    const ref = doc(db, collectionName, identifier);

    // 1. Attempt Cache First
    try {
        const cachedSlug = await getDocsFromCache(q);
        if (!cachedSlug.empty) {
            const rawDoc = cachedSlug.docs[0];
            callback({ exists: () => true, data: () => rawDoc.data(), id: rawDoc.id, metadata: { fromCache: true } });
        } else {
            const cachedId = await getDocFromCache(ref);
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
                callback({ exists: () => true, data: () => rawDoc.data(), id: rawDoc.id, metadata: { fromCache: false } });
            } else {
                getDoc(ref).then(freshId => {
                    if (!freshId.metadata.fromCache) callback(freshId);
                }).catch(() => callback({ exists: () => false }));
            }
        }
    }).catch(() => callback({ exists: () => false }));
}

let activeListeners = [];
function clearListeners() {
    activeListeners.forEach(unsub => unsub());
    activeListeners = [];
}

const appRoot = document.getElementById('app-root');
const REVIEWS_LIMIT = 8;
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

// Load contact info live (cache + network refresh)
fetchDocLive(doc(db, 'settings', 'contact'), applyContactSnap).catch(() => {
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
    clearListeners();
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
        window.history.replaceState(null, '', `/${path}/${id}`);
    } else if (path === 'home') {
        window.history.replaceState(null, '', '/');
    }

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
    return `<div class="card content-in"><div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.description)}</p><a href="#service?id=${escapeHtml(data.slug || id)}" class="${btnCls}">تفاصيل الخدمة</a></div></div>`;
}

function renderProjectCard(data, id) {
    return `<div class="card content-in">${data.mainImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.mainImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#project?id=${escapeHtml(data.slug || id)}" class="btn">عرض المشروع</a></div></div>`;
}

function renderArticleCard(data, id) {
    return `<div class="card content-in">${data.coverImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.coverImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy" decoding="async"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#article?id=${escapeHtml(data.slug || id)}" class="btn">اقرأ المزيد</a></div></div>`;
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

    const projectsQ = fetchDocsLive(query(collection(db, 'projects'), where('featured', '==', true), limit(3)), snap => {
        fillQueryGrid('projects-grid', snap, renderProjectCard, 'projects');
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
        try {
            // Cache-first: serve from IndexedDB instantly
            const cached = await getDocsFromCache(q);
            renderSnap(cached);
            // Background refresh from network (silent)
            getDocs(q).then(fresh => { if (!fresh.metadata.fromCache) renderSnap(fresh); }).catch(() => {});
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

// ── متابعة جميع الـ iframes النشطة لإرسال تحديثات الثيم لحظياً ──
const activeHtmlIframes = new Set();

// المتغيرات اللونية لوضعي الفاتح والداكن
const THEME_VARS = {
    light: {
        '--primary': '#8C5A35', '--primary-hover': '#6c4222', '--secondary': '#D4A373',
        '--accent': '#E9EDC9', '--accent-dark': '#A3B18A', '--background': '#FAEDCD',
        '--card-bg': '#FEFAE0', '--text-main': '#3E2723', '--text-muted': '#6D4C41',
        '--border-color': '#D4A373', '--white': '#FFFFFF'
    },
    dark: {
        '--primary': '#C58A5C', '--primary-hover': '#D4A373', '--secondary': '#8C5A35',
        '--accent': '#4B5A3F', '--accent-dark': '#2F3A26', '--background': '#1A120E',
        '--card-bg': '#2A1F1A', '--text-main': '#FAEDCD', '--text-muted': '#D4A373',
        '--border-color': '#4A3525', '--white': '#2A1F1A'
    }
};

// السكريبت المحقون داخل كل iframe: يستمع لتغيير الثيم من الصفحة الأم
const THEME_LISTENER_SCRIPT = `
<script>
(function(){
  var lightVars=${JSON.stringify(THEME_VARS.light)};
  var darkVars=${JSON.stringify(THEME_VARS.dark)};
  function applyTheme(theme){
    var vars=theme==='dark'?darkVars:lightVars;
    var r=document.documentElement;
    Object.keys(vars).forEach(function(k){r.style.setProperty(k,vars[k]);});
    /* تطبيق شامل لضمان قراءة جميع العناصر */
    var bg=vars['--background']; var txt=vars['--text-main']; var card=vars['--card-bg'];
    document.body.style.background=bg; document.body.style.color=txt;
    document.querySelectorAll('section,article,main,header,footer,[class*="section"],[class*="card"],[class*="container"],[class*="wrapper"],[class*="hero"],[class*="block"],[class*="content"],[class*="box"]').forEach(function(el){
      if(!el.style.background||el.style.background==='transparent')el.style.background='';
    });
  }
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='jidhe-theme')applyTheme(e.data.theme);
  });
  /* تطبيق الثيم المبدئي فور تحميل المستند */
  document.addEventListener('DOMContentLoaded',function(){
    var t=document.documentElement.getAttribute('data-initial-theme');
    if(t)applyTheme(t);
  });
})();
<\/script>`;

// إرسال تحديث الثيم لجميع الـ iframes النشطة
function broadcastThemeToIframes(theme) {
    activeHtmlIframes.forEach(iframe => {
        try {
            if (iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'jidhe-theme', theme }, '*');
            }
        } catch(e) {}
    });
}

// استماع لتغيير الثيم من ui.js وبثه للـ iframes لحظياً
document.addEventListener('jidhe:themechange', (e) => {
    broadcastThemeToIframes(e.detail.theme);
});

function renderHtmlBlocks(container) {
    const isDark = document.body.classList.contains('dark-mode');
    const theme = isDark ? 'dark' : 'light';
    const origin = window.location.origin;
    const vars = THEME_VARS[theme];

    // CSS ثابت يُحقن مرة واحدة: الخطوط + المتغيرات الأولية + الوضع الابتدائي
    const headInjection = `
<style>
@font-face{font-family:'Thmanyah';src:url('${origin}/otf/thmanyahseriftext-Regular.otf') format('opentype');font-weight:normal;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${origin}/otf/thmanyahseriftext-Medium.otf') format('opentype');font-weight:500;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${origin}/otf/thmanyahseriftext-Bold.otf') format('opentype');font-weight:bold;font-display:swap;}
@font-face{font-family:'Thmanyah';src:url('${origin}/otf/thmanyahseriftext-Black.otf') format('opentype');font-weight:900;font-display:swap;}
:root{
${Object.entries(vars).map(([k,v])=>`  ${k}:${v};`).join('\n')}
}
body{font-family:'Thmanyah',Tahoma,Arial,sans-serif;background:${vars['--background']};color:${vars['--text-main']};}
</style>
${THEME_LISTENER_SCRIPT}`;

    container.querySelectorAll('div.custom-html-block[data-html-src]').forEach(div => {
        try {
            let html = decodeURIComponent(escape(atob(div.getAttribute('data-html-src'))));

            // إضافة data-initial-theme على <html> لتطبيق الثيم فور التحميل
            html = html.replace(/<html([^>]*)>/i, `<html$1 data-initial-theme="${theme}">`)
                       .replace(/<head>/i, '<head>' + headInjection);
            if (!html.toLowerCase().includes('<head>') && !html.toLowerCase().includes('<html')) {
                html = headInjection + html;
            }

            const iframe = document.createElement('iframe');
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
            iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
            iframe.srcdoc = html;

            // تتبع الـ iframe لإرسال تحديثات الثيم لاحقاً
            activeHtmlIframes.add(iframe);

            iframe.onload = () => {
                // إرسال الثيم فوراً بعد التحميل للتأكد
                setTimeout(() => {
                    try { iframe.contentWindow.postMessage({ type: 'jidhe-theme', theme }, '*'); } catch(e) {}
                }, 100);

                const resize = () => {
                    try {
                        const doc = iframe.contentWindow.document;
                        const h = Math.max(
                            doc.documentElement.scrollHeight,
                            doc.body ? doc.body.scrollHeight : 0
                        );
                        if (h > 50) iframe.style.height = (h + 40) + 'px';
                    } catch(e) {}
                };
                setTimeout(resize, 300);
                setTimeout(resize, 900);
                setTimeout(resize, 2500);
            };
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
                            <div>${data.fullDescription || ''}</div>
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
                // ── Guarantee all inline-btn links open in new tab (never site navigation) ──
                appRoot.querySelectorAll('a.inline-btn').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    const h = a.getAttribute('href') || '';
                    if (h && !/^https?:\/\//i.test(h) && !/^mailto:/i.test(h)) {
                        a.setAttribute('href', 'https://' + h);
                    }
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
                // ── Guarantee all inline-btn links open in new tab (never site navigation) ──
                appRoot.querySelectorAll('a.inline-btn').forEach(a => {
                    a.setAttribute('target', '_blank');
                    a.setAttribute('rel', 'noopener noreferrer');
                    const h = a.getAttribute('href') || '';
                    if (h && !/^https?:\/\//i.test(h) && !/^mailto:/i.test(h)) {
                        a.setAttribute('href', 'https://' + h);
                    }
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
        });
    } catch (e) { appRoot.innerHTML = showError('خطأ في تحميل الخدمة.'); }
}

function bootRouter() {
    router();
}

window.addEventListener('hashchange', router);
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
