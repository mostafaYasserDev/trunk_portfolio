export async function onRequest(context) {
    const url = new URL(context.request.url);
    const path = url.pathname;

    let collectionName = '';
    let schemaType = '';
    
    if (path.startsWith('/article/')) { collectionName = 'articles'; schemaType = 'Article'; }
    else if (path.startsWith('/project/')) { collectionName = 'projects'; schemaType = 'CreativeWork'; }
    else if (path.startsWith('/service/')) { collectionName = 'services'; schemaType = 'Service'; }

    // Not a dynamic route, skip middleware
    if (!collectionName) {
        return context.next();
    }

    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length < 2) return context.next();
    const idOrSlug = decodeURIComponent(pathParts[1]);

    // Fetch data from Firestore
    let docFields = null;
    try {
        const queryResponse = await fetch(`https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents:runQuery`, {
            method: 'POST',
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: collectionName }],
                    where: { fieldFilter: { field: { fieldPath: "slug" }, op: "EQUAL", value: { stringValue: idOrSlug } } },
                    limit: 1
                }
            })
        });
        const queryData = await queryResponse.json();
        
        if (Array.isArray(queryData) && queryData[0] && queryData[0].document) {
            docFields = queryData[0].document.fields;
        } else {
            const getResponse = await fetch(`https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collectionName}/${encodeURIComponent(idOrSlug)}`);
            const getData = await getResponse.json();
            if (getData.fields) docFields = getData.fields;
        }
    } catch (e) {
        console.error('Error fetching data for SEO:', e);
    }

    const response = await context.next();
    const newResponse = new Response(response.body, response);
    if (!docFields) {
        newResponse.headers.set('X-Debug-Status', 'docFields-null');
        newResponse.headers.set('X-Debug-Id', encodeURIComponent(idOrSlug));
        return newResponse; // If not found, return generic HTML
    }
    newResponse.headers.set('X-Debug-Status', 'docFields-found');

    const getVal = (key) => docFields[key] ? (docFields[key].stringValue || docFields[key].integerValue || docFields[key].booleanValue || '') : '';
    
    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    const title = getVal('title');
    const description = getVal('description') || getVal('shortDescription') || title;
    const image = getVal('coverImage') || getVal('mainImage');
    const datePublished = getVal('publishDate') || getVal('date');

    const canonicalUrl = `${url.protocol}//${url.hostname}${path}`;
    
    // JSON-LD Structured Data
    let jsonLd = {
        "@context": "https://schema.org",
        "@type": schemaType,
        "name": title,
        "headline": title,
        "description": description,
        "url": canonicalUrl
    };
    
    if (image) {
        jsonLd.image = image;
    }
    if (datePublished) {
        jsonLd.datePublished = new Date(datePublished).toISOString();
    }

    // Inject custom tags. We only add og:image if image exists.
    let tagsToInject = `
    <title>${escapeHtml(title)} - جذع</title>
    <meta name="description" content="${escapeHtml(description)}">
    <meta property="og:title" content="${escapeHtml(title)} - جذع">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="${schemaType === 'Article' ? 'article' : 'website'}">
    <meta name="twitter:title" content="${escapeHtml(title)} - جذع">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    `;

    if (image) {
        tagsToInject += `
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
        `;
    }

    // Remove old generic tags and insert new ones
    return new HTMLRewriter()
        .on('title', { element(el) { el.remove(); } })
        .on('#meta-description', { element(el) { el.remove(); } })
        .on('#og-title', { element(el) { el.remove(); } })
        .on('#og-description', { element(el) { el.remove(); } })
        .on('#og-image', { element(el) { el.remove(); } })
        .on('#twitter-title', { element(el) { el.remove(); } })
        .on('#twitter-description', { element(el) { el.remove(); } })
        .on('#twitter-image', { element(el) { el.remove(); } })
        .on('head', {
            element(el) {
                el.append(tagsToInject, { html: true });
            }
        })
        .transform(response);
}
