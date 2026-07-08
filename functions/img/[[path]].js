export async function onRequest(context) {
    const { path } = context.params;
    
    // path should be ['collectionName', 'documentId.jpg']
    if (!path || path.length < 2) {
        return new Response('Not found', { status: 404 });
    }

    const collection = path[0];
    const idWithExt = path[1];
    const id = idWithExt.replace(/\.[^/.]+$/, ""); // Remove extension like .jpg or .png
    
    const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents';
    
    try {
        const response = await fetch(`${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`);
        
        if (!response.ok) {
            return new Response('Image not found', { status: 404 });
        }
        
        const docData = await response.json();
        const fields = docData.fields;
        
        if (!fields) {
            return new Response('No fields found', { status: 404 });
        }
        
        // Check standard image field names
        const base64Str = (fields.coverImage && fields.coverImage.stringValue) || 
                          (fields.mainImage && fields.mainImage.stringValue) || 
                          (fields.image && fields.image.stringValue) ||
                          (fields.thumbnail && fields.thumbnail.stringValue);
                          
        if (!base64Str || !base64Str.startsWith('data:image')) {
            // If it's a real HTTP URL, redirect
            if (base64Str && base64Str.startsWith('http')) {
                return Response.redirect(base64Str, 302);
            }
            return new Response('No valid image data', { status: 404 });
        }
        
        // Match base64 data URL
        // format: data:image/jpeg;base64,/9j/4AAQSk...
        const matches = base64Str.match(/^data:(image\/[^;]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
            return new Response('Invalid image format', { status: 400 });
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        
        // Convert base64 string to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Return image response
        return new Response(bytes.buffer, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=86400, s-maxage=31536000'
            }
        });
        
    } catch (error) {
        return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
}
