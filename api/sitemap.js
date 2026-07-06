module.exports = async (req, res) => {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'trunk-portfolio.vercel.app';
    const baseUrl = `${protocol}://${host}`;

    const fetchCollection = async (collectionName) => {
        try {
            const url = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collectionName}`;
            const response = await fetch(url);
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
    
    // Static Pages
    xml += `    <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/services</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/projects</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/articles</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/contact</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    xml += `    <url><loc>${baseUrl}/donation</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;

    // Dynamic Pages
    const processDocs = (docs, pathPrefix) => {
        docs.forEach(doc => {
            const fields = doc.fields || {};
            
            // Skip hidden items if you have a 'visible' boolean (like in reviews or projects)
            if (fields.visible && fields.visible.booleanValue === false) return;
            if (fields.active && fields.active.booleanValue === false) return;

            // Determine identifier (slug or ID)
            let identifier = doc.name.split('/').pop(); // fallback to document ID
            if (fields.slug && fields.slug.stringValue) {
                identifier = fields.slug.stringValue;
            }

            // Determine last modified date
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

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); // Cache for 1 day
    res.status(200).send(xml);
};
