module.exports = async (req, res) => {
    const { type, id } = req.query;
    
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
                        let image = '';
                        if (type === 'article' || type === 'project') {
                            image = fields.coverImage?.stringValue || fields.mainImage?.stringValue || '';
                        }
                        
                        if (image && image.startsWith('data:image/')) {
                            // Extract mime type and base64 data
                            const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                            if (matches && matches.length === 3) {
                                const mimeType = matches[1];
                                const buffer = Buffer.from(matches[2], 'base64');
                                res.setHeader('Content-Type', mimeType);
                                res.setHeader('Cache-Control', 's-maxage=31536000, stale-while-revalidate');
                                return res.status(200).send(buffer);
                            }
                        } else if (image && image.startsWith('http')) {
                            // If it's already an HTTP URL, redirect
                            return res.redirect(image);
                        }
                    }
                }
            } catch (err) {
                console.error("Error fetching image:", err);
            }
        }
    }
    
    // Fallback image
    res.redirect('https://trunk-portfolio.vercel.app/assets/logo.png');
};
