// ==========================================
// FIX SCHEMA SCRIPT
// ==========================================
// Run this in your Browser Console to add the missing 'createdAt' attribute.

(async function fixSchema() {

    const PROJECT_ID = '69904f4900396667cf4c';
    const DB_ID = '699054e500210206c665';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    console.log("🛠️ Fixing Schema...");

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

    // Add 'createdAt' to 'users'
    console.log("Adding 'createdAt' to Users collection...");
    const res = await api('POST', `/databases/${DB_ID}/collections/users/attributes/string`, {
        key: 'createdAt',
        size: 50,
        required: false
    });

    if (res.ok) {
        console.log("✅ 'createdAt' Attribute Created!");
        console.log("WAIT ~30 seconds for it to become 'available' before running the Power User script again.");
    } else if (res.status === 409) {
        console.log("✅ 'createdAt' already exists.");
    } else {
        console.error("❌ Failed to add attribute:", res.data);
    }

})();
