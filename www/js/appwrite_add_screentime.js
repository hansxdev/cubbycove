// ==========================================
// ADD screenTimeLogs ATTRIBUTE TO children COLLECTION
// ==========================================
// Run this in your Browser Console (F12) while on the Appwrite Console page
// (cloud.appwrite.io) and inside your project.
//
// This adds a large string attribute to store the JSON-encoded screen time logs
// so that DataService.logScreenTime() can write to it.

(async function addScreenTimeLogsAttribute() {

    const PROJECT_ID = '69904f4900396667cf4c';
    const DB_ID = '699054e500210206c665'; // Your CubbyCoveDB
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
    const COLLECTION = 'children';

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    async function api(method, path, body = null) {
        const options = { method, headers, credentials: 'include' };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${ENDPOINT}${path}`, options);
        const json = await res.json();
        if (!res.ok && res.status !== 409) throw new Error(json.message || 'API error');
        return json;
    }

    console.log('🔧 Adding screenTimeLogs attribute to children collection...');

    try {
        await api('POST',
            `/databases/${DB_ID}/collections/${COLLECTION}/attributes/string`,
            {
                key: 'screenTimeLogs',
                size: 65535,   // ~64 KB — enough for ~3 years of daily logs
                required: false,
                default: null
            }
        );
        console.log('✅ screenTimeLogs attribute created! It may take a few seconds to become "Available".');
        console.log('Refresh the Appwrite Console → Database → Children collection to confirm.');
    } catch (e) {
        if (e.message && e.message.includes('409')) {
            console.log('ℹ️  screenTimeLogs attribute already exists — no changes needed.');
        } else {
            console.error('❌ Failed:', e.message);
        }
    }

})();
