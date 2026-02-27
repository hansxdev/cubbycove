// ==========================================
// FIX CHILDREN SCHEMA SCRIPT
// ==========================================
// Run this in your Browser Console on the Appwrite Dashboard to add missing child attributes.

(async function fixChildrenSchema() {
    const PROJECT_ID = '69904f4900396667cf4c';
    const DB_ID = '699054e500210206c665';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    console.log("🛠️ Adding new attributes to Children collection...");

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    async function api(method, path, body = null) {
        const options = {
            method,
            headers,
            credentials: 'include',
        };
        if (body && method !== 'GET') options.body = JSON.stringify(body);
        const response = await fetch(`${ENDPOINT}${path}`, options);
        return { ok: response.ok, status: response.status, data: await response.json().catch(() => ({})) };
    }

    const attrs = [
        { type: 'string', key: 'avatar', size: 100, required: false },
        { type: 'boolean', key: 'allowChat', required: false },
        { type: 'boolean', key: 'allowGames', required: false }
    ];

    for (const attr of attrs) {
        console.log(`Adding '${attr.key}'...`);
        const res = await api('POST', `/databases/${DB_ID}/collections/children/attributes/${attr.type}`, attr);
        if (res.ok) {
            console.log(`✅ '${attr.key}' Attribute Created!`);
        } else if (res.status === 409) {
            console.log(`✅ '${attr.key}' already exists.`);
        } else {
            console.error(`❌ Failed to add '${attr.key}':`, res.data);
        }
    }

    console.log("🎉 All done! Wait ~30 seconds for attributes to become 'available'.");
})();
