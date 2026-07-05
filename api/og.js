const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
    const { type, id } = req.query;
    
    // Default meta tags
    let title = 'جذع - حكاية تنمو';
    let description = 'جذع - بورتفوليو شخصي. أروي حكايات برمجية بروح فنية ولمسة إبداعية.';
    let image = 'https://trunk-portfolio.vercel.app/assets/logo.png'; 
    
    if (type && id) {
        let collection = '';
        if (type === 'article') collection = 'articles';
        else if (type === 'project') collection = 'projects';
        else if (type === 'service') collection = 'services';
        
        if (collection) {
            try {
                const firestoreUrl = `https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents/${collection}/${id}`;
                const response = await fetch(firestoreUrl);
                if (response.ok) {
                    const data = await response.json();
                    const fields = data.fields;
                    if (fields) {
                        title = fields.title?.stringValue ? `${fields.title.stringValue} - جذع` : title;
                        
                        if (type === 'article' || type === 'project') {
                            description = fields.shortDescription?.stringValue || description;
                            image = fields.coverImage?.stringValue || fields.mainImage?.stringValue || image;
                        } else if (type === 'service') {
                            description = fields.description?.stringValue || description;
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching Firestore:", err);
            }
        }
    }
    
    if (image && image.startsWith('data:image/')) {
        image = `https://${req.headers.host || 'jidhe-trunk.web.app'}/api/image?type=${type}&id=${id}`;
    } else if (image && !image.startsWith('http')) {
        image = `https://${req.headers.host || 'jidhe-trunk.web.app'}/${image.replace(/^\//, '')}`;
    }

    try {
        const indexPath = path.join(__dirname, '../index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        
        html = html.replace(/<title>.*<\/title>/gi, `<title>${title}</title>`);
        html = html.replace(/<meta\s+id="og-title"[^>]*>/gi, `<meta id="og-title" property="og:title" content="${title}">`);
        html = html.replace(/<meta\s+id="og-description"[^>]*>/gi, `<meta id="og-description" property="og:description" content="${description}">`);
        html = html.replace(/<meta\s+id="og-image"[^>]*>/gi, `<meta id="og-image" property="og:image" content="${image}">`);
        html = html.replace(/<meta\s+id="twitter-title"[^>]*>/gi, `<meta id="twitter-title" name="twitter:title" content="${title}">`);
        html = html.replace(/<meta\s+id="twitter-description"[^>]*>/gi, `<meta id="twitter-description" name="twitter:description" content="${description}">`);
        html = html.replace(/<meta\s+id="twitter-image"[^>]*>/gi, `<meta id="twitter-image" name="twitter:image" content="${image}">`);
        html = html.replace(/<meta\s+id="meta-description"[^>]*>/gi, `<meta id="meta-description" name="description" content="${description}">`);
        
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600');
        res.status(200).send(html);
    } catch (err) {
        console.error("Error reading index.html:", err);
        res.status(500).send("Internal Server Error");
    }
};
