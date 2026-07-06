export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // 1. Sitemap Logic
        if (url.pathname === '/sitemap.xml') {
            return await handleSitemap(request, env);
        }

        // 2. SEO / Open Graph Meta Tags Logic
        // Matches routes that need custom meta tags
        const staticPages = ['/contact', '/donation', '/donations', '/articles', '/projects', '/services', '/feedback'];
        const dynamicPrefixes = ['/article/', '/project/', '/service/'];
        
        const isStaticMatch = staticPages.includes(url.pathname);
        const isDynamicMatch = dynamicPrefixes.some(prefix => url.pathname.startsWith(prefix));

        if (isStaticMatch || isDynamicMatch) {
            return await handleOGPage(request, env, url);
        }

        // 3. Fallback: serve static assets
        let response = await env.ASSETS.fetch(request);
        
        // Single Page Application (SPA) Fallback
        if (response.status === 404 && !url.pathname.includes('.')) {
            const indexReq = new Request(`${url.protocol}//${url.hostname}/index.html`, request);
            return env.ASSETS.fetch(indexReq);
        }
        
        return response;
    }
};

async function handleSitemap(request, env) {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;

    const fetchCollection = async (collectionName) => {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collectionName}`;
            const response = await fetch(firestoreUrl);
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

async function handleOGPage(request, env, url) {
    let title = 'جذع - حكاية تنمو';
    let description = 'جذع - بورتفوليو شخصي. أروي حكايات برمجية بروح فنية ولمسة إبداعية.';
    let image = `${url.protocol}//${url.hostname}/assets/logo.png`; 

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
        let collection = type + 's'; 

        try {
            const queryUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents:runQuery`;
            const queryBody = {
                structuredQuery: {
                    from: [{ collectionId: collection }],
                    where: {
                        fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: id } }
                    },
                    limit: 1
                }
            };
            
            let fields = null;
            const queryRes = await fetch(queryUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryBody)
            });
            
            if (queryRes.ok) {
                const queryData = await queryRes.json();
                if (queryData && queryData.length > 0 && queryData[0].document) {
                    fields = queryData[0].document.fields;
                }
            }
            
            if (!fields) {
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collection}/${id}`;
                const response = await fetch(firestoreUrl);
                if (response.ok) {
                    const data = await response.json();
                    fields = data.fields;
                }
            }
            
            if (fields) {
                title = fields.title?.stringValue ? `${fields.title.stringValue} - جذع` : title;
                if (type === 'article' || type === 'project') {
                    description = fields.shortDescription?.stringValue || description;
                    image = fields.coverImage?.stringValue || fields.mainImage?.stringValue || image;
                } else if (type === 'service') {
                    description = fields.description?.stringValue || description;
                }
            }
        } catch (err) {
            console.error("Error fetching Firestore:", err);
        }
    }

    if (image && image.startsWith('data:image/')) {
        // Fallback for base64 images if they exceed meta tag limits or cannot be rendered
        // Ideally we'd serve them via another endpoint, but for simplicity we keep the original image
        image = `${url.protocol}//${url.hostname}/assets/logo.png`;
    } else if (image && !image.startsWith('http')) {
        image = `${url.protocol}//${url.hostname}/${image.replace(/^\//, '')}`;
    }

    const indexReq = new Request(`${url.protocol}//${url.hostname}/index.html`, request);
    const response = await env.ASSETS.fetch(indexReq);

    return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(title); } })
        .on('meta[id="og-title"]', { element(e) { e.setAttribute("content", title); } })
        .on('meta[id="og-description"]', { element(e) { e.setAttribute("content", description); } })
        .on('meta[id="og-image"]', { element(e) { e.setAttribute("content", image); } })
        .on('meta[id="twitter-title"]', { element(e) { e.setAttribute("content", title); } })
        .on('meta[id="twitter-description"]', { element(e) { e.setAttribute("content", description); } })
        .on('meta[id="twitter-image"]', { element(e) { e.setAttribute("content", image); } })
        .on('meta[id="meta-description"]', { element(e) { e.setAttribute("content", description); } })
        .transform(response);
}
