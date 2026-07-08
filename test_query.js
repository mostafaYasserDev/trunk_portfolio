const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/jidhe-trunk/databases/(default)/documents';

async function test() {
    try {
        const queryResponse = await fetch(`${FIRESTORE_BASE}:runQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                structuredQuery: {
                    from: [{ collectionId: 'projects' }],
                    where: {
                        fieldFilter: {
                            field: { fieldPath: 'slug' },
                            op: 'EQUAL',
                            value: { stringValue: 'download-al_ribat-app' }
                        }
                    },
                    limit: 1
                }
            })
        });

        console.log('Status:', queryResponse.status);
        const data = await queryResponse.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
