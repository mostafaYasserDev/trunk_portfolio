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

    const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents';

    // Fetch data from Firestore with timeout
    let docFields = null;
    let fetchMethod = 'none';
    let actualDocId = idOrSlug;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);

        // Try slug query first
        try {
            const queryResponse = await fetch(`${FIRESTORE_BASE}:runQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    structuredQuery: {
                        from: [{ collectionId: collectionName }],
                        where: {
                            fieldFilter: {
                                field: { fieldPath: 'slug' },
                                op: 'EQUAL',
                                value: { stringValue: idOrSlug }
                            }
                        },
                        limit: 1
                    }
                }),
                signal: controller.signal
            });

            if (queryResponse.ok) {
                const queryData = await queryResponse.json();
                if (Array.isArray(queryData) && queryData[0] && queryData[0].document) {
                    docFields = queryData[0].document.fields;
                    fetchMethod = 'slug-query';
                    if (queryData[0].document.name) {
                        actualDocId = queryData[0].document.name.split('/').pop();
                    }
                }
            }
        } catch (slugErr) {
            // Slug query failed, try direct ID
        }

        // Fallback: try direct document ID
        if (!docFields) {
            try {
                const getResponse = await fetch(
                    `${FIRESTORE_BASE}/${collectionName}/${encodeURIComponent(idOrSlug)}`,
                    { signal: controller.signal }
                );
                if (getResponse.ok) {
                    const getData = await getResponse.json();
                    if (getData.fields) {
                        docFields = getData.fields;
                        fetchMethod = 'direct-id';
                    }
                }
            } catch (idErr) {
                // Both methods failed
            }
        }

        clearTimeout(timeout);
    } catch (e) {
        // Timeout or network error
    }

    // Get the base response (index.html content)
    const response = await context.next();

    if (!docFields) {
        // Return response with debug headers for troubleshooting
        const debugResp = new Response(response.body, response);
        debugResp.headers.set('X-SEO-Status', 'no-data');
        debugResp.headers.set('X-SEO-Slug', idOrSlug.substring(0, 50));
        return debugResp;
    }

    // Helper functions
    const getVal = (key) => {
        if (!docFields[key]) return '';
        return docFields[key].stringValue || docFields[key].integerValue?.toString() || '';
    };
    const getBool = (key) => docFields[key]?.booleanValue;

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Check visibility
    if (getBool('visible') === false || getBool('active') === false) {
        // Item is hidden — redirect to listing page
        return Response.redirect(`${url.protocol}//${url.hostname}/${collectionName}`, 302);
    }

    const title = getVal('title') || getVal('name');
    const description = getVal('description') || getVal('shortDescription') || getVal('summary') || title;
    const image = getVal('coverImage') || getVal('mainImage') || getVal('image') || getVal('thumbnail');
    const datePublished = getVal('publishDate') || getVal('date') || getVal('createdAt');
    const author = getVal('author') || 'مصطفى ياسر';
    const tags = getVal('tags') || getVal('keywords');

    const siteUrl = `${url.protocol}//${url.hostname}`;
    const canonicalUrl = `${siteUrl}${path}`;
    const siteName = 'جذع';
    
    let finalImage = image;
    if (image && image.startsWith('data:image')) {
        finalImage = `${siteUrl}/img/${collectionName}/${actualDocId}.jpg`;
    } else if (!image) {
        finalImage = `${siteUrl}/assets/logo.png`;
    }

    // Truncate description to 160 chars max for SEO
    const shortDescription = description.length > 160
        ? description.substring(0, 157) + '...'
        : description;

    // JSON-LD Structured Data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': schemaType,
        'name': title,
        'headline': title,
        'description': shortDescription,
        'url': canonicalUrl,
        'image': finalImage,
        'inLanguage': 'ar',
        'author': {
            '@type': 'Person',
            'name': author,
            'url': siteUrl
        },
        'publisher': {
            '@type': 'Person',
            'name': siteName,
            'url': siteUrl,
            'logo': {
                '@type': 'ImageObject',
                'url': `${siteUrl}/assets/logo.png`
            }
        }
    };

    if (datePublished) {
        try {
            jsonLd.datePublished = new Date(datePublished).toISOString();
            jsonLd.dateModified = jsonLd.datePublished;
        } catch (e) { /* ignore invalid date */ }
    }

    if (tags) {
        jsonLd.keywords = tags;
    }

    const pageTitle = `${escapeHtml(title)} - ${siteName}`;
    const ogType = schemaType === 'Article' ? 'article' : 'website';

    // Build all meta tags to inject
    const tagsToInject = `
    <title>${pageTitle}</title>
    <meta name="description" content="${escapeHtml(shortDescription)}">
    <meta name="author" content="${escapeHtml(author)}">
    ${tags ? `<meta name="keywords" content="${escapeHtml(tags)}">` : ''}
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}">
    <meta property="og:title" content="${pageTitle}">
    <meta property="og:description" content="${escapeHtml(shortDescription)}">
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
    <meta property="og:type" content="${ogType}">
    <meta property="og:image" content="${escapeHtml(finalImage)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeHtml(title)}">
    <meta property="og:site_name" content="${siteName}">
    <meta property="og:locale" content="ar_AR">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${pageTitle}">
    <meta name="twitter:description" content="${escapeHtml(shortDescription)}">
    <meta name="twitter:image" content="${escapeHtml(finalImage)}">
    <meta name="twitter:image:alt" content="${escapeHtml(title)}">
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    `;

    // Use HTMLRewriter to remove old generic tags and inject new dynamic ones
    return new HTMLRewriter()
        // Remove old title and generic meta tags
        .on('title', { element(el) { el.remove(); } })
        .on('link[rel="canonical"]', { element(el) { el.remove(); } })
        .on('#meta-description', { element(el) { el.remove(); } })
        .on('#og-title', { element(el) { el.remove(); } })
        .on('#og-description', { element(el) { el.remove(); } })
        .on('#og-image', { element(el) { el.remove(); } })
        .on('#og-url', { element(el) { el.remove(); } })
        .on('#twitter-title', { element(el) { el.remove(); } })
        .on('#twitter-description', { element(el) { el.remove(); } })
        .on('#twitter-image', { element(el) { el.remove(); } })
        .on('[property="og:type"]', { element(el) { el.remove(); } })
        .on('[property="og:locale"]', { element(el) { el.remove(); } })
        .on('[name="twitter:card"]', { element(el) { el.remove(); } })
        // Remove existing JSON-LD from head (will be replaced)
        .on('script[type="application/ld+json"]', { element(el) { el.remove(); } })
        // Inject all new tags at end of <head>
        .on('head', {
            element(el) {
                el.append(tagsToInject, { html: true });
            }
        })
        .transform(response);
}
