export async function onRequest(context) {
    const url = new URL(context.request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const now = new Date().toISOString();

    const fetchCollection = async (collectionName) => {
        try {
            const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collectionName}?pageSize=200`;
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

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

    // Static Pages with lastmod
    const staticPages = [
        { path: '/', changefreq: 'daily', priority: '1.0' },
        { path: '/services', changefreq: 'weekly', priority: '0.8' },
        { path: '/projects', changefreq: 'weekly', priority: '0.8' },
        { path: '/articles', changefreq: 'weekly', priority: '0.8' },
        { path: '/donation', changefreq: 'monthly', priority: '0.5' },
    ];

    staticPages.forEach(page => {
        xml += `    <url>\n`;
        xml += `        <loc>${baseUrl}${page.path}</loc>\n`;
        xml += `        <lastmod>${now.split('T')[0]}</lastmod>\n`;
        xml += `        <changefreq>${page.changefreq}</changefreq>\n`;
        xml += `        <priority>${page.priority}</priority>\n`;
        xml += `    </url>\n`;
    });

    // Dynamic Pages
    const processDocs = (docs, pathPrefix) => {
        docs.forEach(doc => {
            const fields = doc.fields || {};

            // Skip invisible/inactive items
            if (fields.visible && fields.visible.booleanValue === false) return;
            if (fields.active && fields.active.booleanValue === false) return;

            let identifier = doc.name.split('/').pop();
            if (fields.slug && fields.slug.stringValue) {
                identifier = fields.slug.stringValue;
            }

            let date = now.split('T')[0];
            if (fields.publishDate && fields.publishDate.stringValue) {
                try { date = new Date(fields.publishDate.stringValue).toISOString().split('T')[0]; } catch(e){}
            } else if (fields.date && fields.date.stringValue) {
                try { date = new Date(fields.date.stringValue).toISOString().split('T')[0]; } catch(e){}
            } else if (doc.updateTime) {
                try { date = new Date(doc.updateTime).toISOString().split('T')[0]; } catch(e){}
            } else if (doc.createTime) {
                try { date = new Date(doc.createTime).toISOString().split('T')[0]; } catch(e){}
            }

            // Get image if available
            const coverImage = (fields.coverImage && fields.coverImage.stringValue) ||
                               (fields.mainImage && fields.mainImage.stringValue) ||
                               (fields.image && fields.image.stringValue) || '';
            const title = (fields.title && fields.title.stringValue) ||
                          (fields.name && fields.name.stringValue) || '';

            xml += `    <url>\n`;
            xml += `        <loc>${baseUrl}/${pathPrefix}/${encodeURIComponent(identifier)}</loc>\n`;
            xml += `        <lastmod>${date}</lastmod>\n`;
            xml += `        <changefreq>weekly</changefreq>\n`;
            xml += `        <priority>0.7</priority>\n`;

            if (coverImage && title) {
                xml += `        <image:image>\n`;
                xml += `            <image:loc>${coverImage.startsWith('http') ? coverImage : `${baseUrl}${coverImage}`}</image:loc>\n`;
                xml += `            <image:title>${title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</image:title>\n`;
                xml += `        </image:image>\n`;
            }

            xml += `    </url>\n`;
        });
    };

    processDocs(articles, 'article');
    processDocs(projects, 'project');
    processDocs(services, 'service');

    xml += `</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            'X-Robots-Tag': 'noindex'
        }
    });
}
