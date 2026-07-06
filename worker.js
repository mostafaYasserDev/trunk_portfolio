export default {
    async fetch(request, env, ctx) {
        try {
            const url = new URL(request.url);
            
            // 1. Sitemap Logic
            if (url.pathname === '/sitemap.xml') {
                return await handleSitemap(url);
            }

            // 2. SEO / Open Graph Meta Tags Logic (only for non-file requests)
            const staticPages = ['/contact', '/donation', '/donations', '/articles', '/projects', '/services', '/feedback'];
            const dynamicPrefixes = ['/article/', '/project/', '/service/'];
            
            const isStaticMatch = staticPages.includes(url.pathname);
            const isDynamicMatch = dynamicPrefixes.some(prefix => url.pathname.startsWith(prefix)) && !url.pathname.includes('.');

            if (isStaticMatch || isDynamicMatch) {
                try {
                    return await handleOGPage(env, url);
                } catch (ogErr) {
                    console.error('OG page error, falling back to raw asset:', ogErr);
                    // If OG generation fails, just serve the raw index.html
                    return env.ASSETS.fetch(new Request(`${url.protocol}//${url.hostname}/index.html`));
                }
            }

            // 3. Fallback: serve static assets
            const response = await env.ASSETS.fetch(request);
            
            // Single Page Application (SPA) Fallback for clean URLs
            if (response.status === 404 && !url.pathname.includes('.')) {
                return env.ASSETS.fetch(new Request(`${url.protocol}//${url.hostname}/index.html`));
            }
            
            return response;

        } catch (err) {
            // Top-level safety net — never let the worker crash with 1101
            console.error('Worker top-level error:', err);
            try {
                const url = new URL(request.url);
                return env.ASSETS.fetch(new Request(`${url.protocol}//${url.hostname}/index.html`));
            } catch {
                return new Response('Internal Server Error', { status: 500 });
            }
        }
    }
};

async function handleSitemap(url) {
    const baseUrl = `${url.protocol}//${url.hostname}`;

    const fetchCollection = async (collectionName) => {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collectionName}?pageSize=300`;
            const response = await fetch(firestoreUrl, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) return [];
            const data = await response.json();
            if (!data.documents) return [];
            return data.documents;
        } catch (e) {
            console.error('Error fetching ' + collectionName, e);
            return [];
        }
    };

    const [articles, projects, services] = await Promise.all([
        fetchCollection('articles'),
        fetchCollection('projects'),
        fetchCollection('services')
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    xml += `    <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/services</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/projects</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/articles</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/contact</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/donation</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;

    const processDocs = (docs, pathPrefix) => {
        docs.forEach(doc => {
            try {
                const fields = doc.fields || {};
                if (fields.visible && fields.visible.booleanValue === false) return;
                if (fields.active && fields.active.booleanValue === false) return;

                let identifier = doc.name.split('/').pop();
                if (fields.slug && fields.slug.stringValue) {
                    identifier = fields.slug.stringValue;
                }

                let date = new Date().toISOString();
                if (fields.publishDate && fields.publishDate.stringValue) {
                    date = new Date(fields.publishDate.stringValue).toISOString();
                } else if (fields.date && fields.date.stringValue) {
                    date = new Date(fields.date.stringValue).toISOString();
                } else if (doc.createTime) {
                    date = new Date(doc.createTime).toISOString();
                }

                xml += `    <url>\n        <loc>${baseUrl}/${pathPrefix}/${encodeURIComponent(identifier)}</loc>\n        <lastmod>${date}</lastmod>\n        <changefreq>weekly</changefreq>\n        <priority>0.7</priority>\n    </url>\n`;
            } catch (e) {
                // Skip malformed doc silently
            }
        });
    };

    processDocs(articles, 'article');
    processDocs(projects, 'project');
    processDocs(services, 'service');

    xml += `</urlset>`;

    return new Response(xml, {
        headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Cache-Control": "s-maxage=86400, stale-while-revalidate"
        }
    });
}

async function handleOGPage(env, url) {
    const defaultImage = `${url.protocol}//${url.hostname}/assets/logo.png`;
    let title = 'جذع - حكاية تنمو';
    let description = 'جذع - بورتفوليو شخصي. أروي حكايات برمجية بروح فنية ولمسة إبداعية.';
    let image = defaultImage;

    const pathParts = url.pathname.split('/').filter(Boolean);
    const type = pathParts[0];
    const id = pathParts[1];

    if (type === 'contact') title = 'تواصل معي - جذع';
    else if (type === 'donation' || type === 'donations') title = 'الدعم - جذع';
    else if (type === 'articles') title = 'المقالات - جذع';
    else if (type === 'projects') title = 'المشاريع - جذع';
    else if (type === 'services') title = 'الخدمات - جذع';
    else if (type === 'feedback') title = 'رأيك يهمنا - جذع';

    if ((type === 'article' || type === 'project' || type === 'service') && id) {
        const collection = type + 's';

        try {
            // Only request specific fields to avoid downloading huge base64 images
            const queryUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents:runQuery`;
            const queryBody = {
                structuredQuery: {
                    from: [{ collectionId: collection }],
                    where: {
                        fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: id } }
                    },
                    select: {
                        fields: [
                            { fieldPath: "title" },
                            { fieldPath: "shortDescription" },
                            { fieldPath: "description" },
                            { fieldPath: "coverImage" },
                            { fieldPath: "mainImage" },
                            { fieldPath: "slug" }
                        ]
                    },
                    limit: 1
                }
            };
            
            let fields = null;
            const queryRes = await fetch(queryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryBody),
                signal: AbortSignal.timeout(8000)
            });
            
            if (queryRes.ok) {
                const queryData = await queryRes.json();
                if (queryData && queryData.length > 0 && queryData[0].document) {
                    fields = queryData[0].document.fields;
                }
            }
            
            // Fallback: try by document ID
            if (!fields) {
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collection}/${id}`;
                const response = await fetch(firestoreUrl, { signal: AbortSignal.timeout(8000) });
                if (response.ok) {
                    const data = await response.json();
                    fields = data.fields;
                }
            }
            
            if (fields) {
                if (fields.title?.stringValue) {
                    title = `${fields.title.stringValue} - جذع`;
                }

                if (type === 'article' || type === 'project') {
                    description = fields.shortDescription?.stringValue || description;
                    const rawImg = fields.coverImage?.stringValue || fields.mainImage?.stringValue || '';
                    // Only use image URL if it's a real URL (not base64)
                    if (rawImg && rawImg.startsWith('http')) {
                        image = rawImg;
                    }
                } else if (type === 'service') {
                    description = fields.description?.stringValue || description;
                }
            }
        } catch (err) {
            console.error("Error fetching Firestore for OG tags:", err);
            // Continue with default meta tags — do NOT rethrow
        }
    }

    // Escape special HTML characters to prevent HTMLRewriter failures
    const escape = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const safeTitle = escape(title);
    const safeDesc = escape(description);
    const safeImage = escape(image);

    const indexResp = await env.ASSETS.fetch(new Request(`${url.protocol}//${url.hostname}/index.html`));

    return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(title); } })
        .on('meta[id="og-title"]', { element(e) { e.setAttribute("content", safeTitle); } })
        .on('meta[id="og-description"]', { element(e) { e.setAttribute("content", safeDesc); } })
        .on('meta[id="og-image"]', { element(e) { e.setAttribute("content", safeImage); } })
        .on('meta[id="twitter-title"]', { element(e) { e.setAttribute("content", safeTitle); } })
        .on('meta[id="twitter-description"]', { element(e) { e.setAttribute("content", safeDesc); } })
        .on('meta[id="twitter-image"]', { element(e) { e.setAttribute("content", safeImage); } })
        .on('meta[id="meta-description"]', { element(e) { e.setAttribute("content", safeDesc); } })
        .transform(indexResp);
}
