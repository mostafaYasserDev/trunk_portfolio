import { db, collection, getDocs, query, where, limit, orderBy, doc, getDoc, startAfter } from '../firebase/firebase.js';
import {
    LOADER_HTML, skeletonCards, skeletonReviews, emptyState, showError, buildContactHtml,
    escapeHtml, updatePageMeta, PAGE_META, initReadingProgress, removeReadingProgress
} from './helpers.js';

const appRoot = document.getElementById('app-root');

// Footer contact — load once
getDoc(doc(db, 'settings', 'contact')).then(snap => {
    const el = document.getElementById('footer-contact-info');
    if (!el) return;
    el.innerHTML = snap.exists() ? buildContactHtml(snap.data()) : '<p>معلومات التواصل غير متوفرة.</p>';
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
    const isHome = path === 'home' || path === '' || path === 'contact';

    removeReadingProgress();
    updateActiveNav(path);

    // تواصل معي: إذا الرئيسية معروضة، فقط مرّر للقسم
    if (path === 'contact' && document.getElementById('home-view')) {
        updatePageMeta(PAGE_META.contact);
        setTimeout(() => {
            document.getElementById('contact-sec')?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
        return;
    }

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

    if (isHome) {
        setTimeout(() => { if (typeof AOS !== 'undefined') AOS.refreshHard(); }, 80);
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
    return `<div class="card"><div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.description)}</p><a href="#service?id=${id}" class="${btnCls}">تفاصيل الخدمة</a></div></div>`;
}

function renderProjectCard(data, id) {
    return `<div class="card">${data.mainImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.mainImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#project?id=${id}" class="btn">عرض المشروع</a></div></div>`;
}

function renderArticleCard(data, id) {
    return `<div class="card">${data.coverImage ? `<div class="card-img-wrapper"><img src="${escapeHtml(data.coverImage)}" class="card-img" alt="${escapeHtml(data.title)}" loading="lazy"></div>` : ''}<div class="card-content"><h3 class="card-title">${escapeHtml(data.title)}</h3><p class="card-desc">${escapeHtml(data.shortDescription)}</p><a href="#article?id=${id}" class="btn">اقرأ المزيد</a></div></div>`;
}

function renderReviewCard(data) {
    const serviceLine = data.serviceName ? `<span class="review-service">${escapeHtml(data.serviceName)}</span>` : '';
    return `<div class="review-card">${serviceLine}<h4>${escapeHtml(data.clientName)}</h4><p>"${escapeHtml(data.reviewText)}"</p></div>`;
}

async function loadHomeData() {
    try {
        const [generalSnap, servicesSnap, projectsSnap, articlesSnap, reviewsSnap, contactSnap] = await Promise.all([
            getDoc(doc(db, 'settings', 'general')),
            getDocs(query(collection(db, 'services'), where('featured', '==', true), limit(3))),
            getDocs(query(collection(db, 'projects'), where('featured', '==', true), limit(3))),
            getDocs(query(collection(db, 'articles'), orderBy('publishDate', 'desc'), limit(3))),
            getDocs(query(collection(db, 'reviews'), where('visible', '==', true))),
            getDoc(doc(db, 'settings', 'contact'))
        ]);

        if (generalSnap.exists()) {
            const data = generalSnap.data();
            const cvBtn = document.getElementById('cv-download-btn');
            if (cvBtn) {
                if (data.cvData) { cvBtn.href = data.cvData; cvBtn.style.display = 'inline-flex'; }
                else cvBtn.style.display = 'none';
            }
            const aboutContainer = document.getElementById('about-image-container');
            if (aboutContainer && data.aboutImage) {
                aboutContainer.innerHTML = `<img src="${data.aboutImage}" alt="صورة شخصية" class="about-image" loading="lazy">`;
            }
        }

        const servicesEl = document.getElementById('services-grid');
        if (servicesEl) {
            if (servicesSnap.empty) servicesEl.innerHTML = emptyState('services');
            else {
                let html = '';
                servicesSnap.forEach(d => { html += renderServiceCard(d.data(), d.id); });
                servicesEl.innerHTML = html;
            }
        }

        const projectsEl = document.getElementById('projects-grid');
        if (projectsEl) {
            if (projectsSnap.empty) projectsEl.innerHTML = emptyState('projects');
            else {
                let html = '';
                projectsSnap.forEach(d => { html += renderProjectCard(d.data(), d.id); });
                projectsEl.innerHTML = html;
            }
        }

        const articlesEl = document.getElementById('articles-grid');
        if (articlesEl) {
            if (articlesSnap.empty) articlesEl.innerHTML = emptyState('articles');
            else {
                let html = '';
                articlesSnap.forEach(d => { html += renderArticleCard(d.data(), d.id); });
                articlesEl.innerHTML = html;
            }
        }

        const reviewsEl = document.getElementById('reviews-grid');
        if (reviewsEl) {
            if (reviewsSnap.empty) reviewsEl.innerHTML = emptyState('reviews');
            else {
                let html = '';
                reviewsSnap.forEach(d => { html += renderReviewCard(d.data()); });
                reviewsEl.innerHTML = html;
            }
        }

        const contactEl = document.getElementById('dynamic-contact-info');
        if (contactEl) {
            contactEl.innerHTML = contactSnap.exists() ? buildContactHtml(contactSnap.data()) : '<p>معلومات التواصل غير متوفرة.</p>';
        }
    } catch (e) {
        console.error(e);
    }
}

async function renderHome() {
    updatePageMeta(PAGE_META.home);

    appRoot.innerHTML = `
        <div class="view active" id="home-view">
            <section class="hero glass-panel" data-aos="zoom-in">
                <div class="hero-content">
                    <span class="trunk-badge">مرحباً بك في جذع</span>
                    <h1>أروي حكايات برمجية</h1>
                    <p>تتأصل الأفكار وتنمو كالأشجار. أقدم حلولاً برمجية بروح فنية ولمسة إبداعية تجمع بين أصالة الجذور وجمال الأغصان.</p>
                    <div class="hero-btns">
                        <a href="#projects" class="btn">استكشف أعمالي</a>
                        <a id="cv-download-btn" href="#" class="btn btn-outline" style="display:none;" download="سيرة-ذاتية.pdf">
                            <i class="fas fa-file-download"></i> تحميل السيرة الذاتية
                        </a>
                    </div>
                </div>
            </section>

            <section class="about-section" data-aos="fade-up">
                <h2 class="section-title">من أنا؟ (نبذة عني)</h2>
                <div class="glass-panel about-grid" style="padding: 40px; border-radius: 20px;">
                    <div id="about-image-container">
                        <div class="about-image-placeholder">🌳</div>
                    </div>
                    <div class="about-text">
                        <p>مرحباً! أنا مطور واجهات ومصمم تجربة مستخدم شغوف ببناء مواقع وتطبيقات ويب سريعة ومميزة. أؤمن بأن البرمجة كالشجرة؛ تبدأ ببذرة (الفكرة)، وتمتد جذورها (الكود الأساسي)، ثم تتفرع أغصانها (الواجهة) لتثمر في النهاية تجربة مستخدم رائعة.</p>
                        <p>أسعى دائماً لتقديم حلول تقنية تجمع بين الأداء العالي والتصميم الجذاب، مع التركيز على كتابة كود نظيف وقابل للتطوير.</p>
                    </div>
                </div>
            </section>

            <section data-aos="fade-up">
                <div class="section-header">
                    <h2 class="section-title">أبرز الخدمات</h2>
                    <a href="#services" class="view-all-link">عرض الكل <i class="fas fa-arrow-left"></i></a>
                </div>
                <div class="grid" id="services-grid">${skeletonCards(3)}</div>
            </section>

            <section data-aos="fade-up">
                <div class="section-header">
                    <h2 class="section-title">أبرز المشاريع</h2>
                    <a href="#projects" class="view-all-link">عرض الكل <i class="fas fa-arrow-left"></i></a>
                </div>
                <div class="grid" id="projects-grid">${skeletonCards(3)}</div>
            </section>

            <section data-aos="fade-up">
                <div class="section-header">
                    <h2 class="section-title">أحدث المقالات</h2>
                    <a href="#articles" class="view-all-link">عرض الكل <i class="fas fa-arrow-left"></i></a>
                </div>
                <div class="grid" id="articles-grid">${skeletonCards(3)}</div>
            </section>

            <section class="reviews-section" data-aos="fade-up">
                <h2 class="section-title" style="color:var(--text-main);">ماذا قالوا عن جذع؟</h2>
                <p class="reviews-scroll-hint"><i class="fas fa-hand-pointer"></i> اسحب للمزيد من الآراء</p>
                <div class="reviews-grid" id="reviews-grid">${skeletonReviews(2)}</div>
                <p class="reviews-cta">هل عملنا معاً؟ <a href="client/write-review.html">شاركنا رأيك</a></p>
            </section>

            <section id="contact-sec" class="contact-section" data-aos="fade-up">
                <div class="contact-info">
                    <h2 class="section-title">لنصنع حكاية جديدة</h2>
                    <p>تواصل معي لنبدأ مشروعك القادم ونروي معاً قصة نجاح.</p>
                    <div id="dynamic-contact-info"><div class="skeleton-line" style="height:20px; width:60%;"></div></div>
                </div>
                <div class="contact-form">
                    <div id="form-status" class="form-status" role="alert"></div>
                    <form id="public-contact-form">
                        <div class="form-group">
                            <label for="contact-name">الاسم</label>
                            <input type="text" id="contact-name" placeholder="اسمك الكريم" required>
                        </div>
                        <div class="form-group">
                            <label for="contact-email-input">البريد الإلكتروني</label>
                            <input type="email" id="contact-email-input" placeholder="example@email.com" required>
                        </div>
                        <div class="form-group">
                            <label for="contact-message">رسالتك</label>
                            <textarea id="contact-message" rows="4" placeholder="اكتب رسالتك هنا..." required></textarea>
                        </div>
                        <button type="submit" class="btn" style="width: 100%;">إرسال الرسالة</button>
                    </form>
                </div>
            </section>
        </div>
    `;

    const contactForm = document.getElementById('public-contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = contactForm.querySelector('button[type="submit"]');
            const statusEl = document.getElementById('form-status');
            btn.disabled = true;
            btn.textContent = 'جاري الإرسال...';
            statusEl.className = 'form-status';
            statusEl.style.display = 'none';
            try {
                const { addDoc } = await import('../firebase/firebase.js');
                await addDoc(collection(db, 'messages'), {
                    name: document.getElementById('contact-name').value,
                    email: document.getElementById('contact-email-input').value,
                    message: document.getElementById('contact-message').value,
                    date: new Date().toISOString(),
                    read: false
                });
                contactForm.reset();
                statusEl.textContent = 'تم إرسال رسالتك بنجاح! سأتواصل معك قريباً.';
                statusEl.className = 'form-status success';
            } catch (err) {
                console.error(err);
                statusEl.textContent = 'حدث خطأ أثناء الإرسال. حاول مجدداً.';
                statusEl.className = 'form-status error';
            } finally {
                btn.textContent = 'إرسال الرسالة';
                btn.disabled = false;
            }
        });
    }

    await loadHomeData();
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
                    ${data.mainImage ? `<img src="${escapeHtml(data.mainImage)}" class="detail-cover" alt="${escapeHtml(data.title)}">` : ''}
                    <div class="detail-content">
                        <p>${escapeHtml(data.fullDescription).replace(/\n/g, '<br>')}</p>
                        <div style="margin-top: 30px; display: flex; gap: 15px; flex-wrap: wrap;">
                            ${data.demoLink ? `<a href="${escapeHtml(data.demoLink)}" target="_blank" rel="noopener" class="btn">معاينة حية</a>` : ''}
                            ${data.githubLink ? `<a href="${escapeHtml(data.githubLink)}" target="_blank" rel="noopener" class="btn" style="background:var(--text-main);">الكود المصدري</a>` : ''}
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
                    ${data.coverImage ? `<img src="${escapeHtml(data.coverImage)}" class="detail-cover" alt="${escapeHtml(data.title)}">` : ''}
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

window.addEventListener('hashchange', router);
document.addEventListener('DOMContentLoaded', router);
