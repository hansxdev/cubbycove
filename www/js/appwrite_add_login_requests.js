// ==========================================
// CUBBYCOVE — CREATE login_requests COLLECTION
// ==========================================
// Paste this ENTIRE script into your Browser Console (F12)
// while logged into cloud.appwrite.io INSIDE your project.

(async function createLoginRequests() {

    const PROJECT_ID = '69904f4900396667cf4c';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    async function api(method, path, body) {
        const options = { method, headers, credentials: 'include' };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${ENDPOINT}${path}`, options);
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 409) { console.log('   ↳ Already exists, skipping.'); return { exists: true }; }
            throw new Error(`[${res.status}] ${data.message}`);
        }
        return data;
    }

    // Find DB
    const dbList = await api('GET', '/databases');
    const DB_ID = dbList.databases[0].$id;
    console.log('✅ Database: ' + DB_ID);

    // 1. Create the collection with any-read + any-write
    console.log('\n> Creating login_requests collection...');
    await api('POST', `/databases/${DB_ID}/collections`, {
        collectionId: 'login_requests',
        name: 'Login Requests',
        permissions: [
            'read("any")',
            'create("any")',
            'update("users")',
            'delete("users")'
        ],
        documentSecurity: false
    });

    // 2. Create attributes (wait between each)
    const attrs = [
        { path: 'string', body: { key: 'childUsername', size: 50, required: true } },
        { path: 'string', body: { key: 'parentEmail', size: 255, required: true } },
        { path: 'string', body: { key: 'status', size: 20, required: true } },
        { path: 'string', body: { key: 'requestedAt', size: 50, required: true } },
        { path: 'string', body: { key: 'deviceInfo', size: 500, required: false } },
        { path: 'string', body: { key: 'expiresAt', size: 50, required: false } },
        { path: 'string', body: { key: 'childName', size: 100, required: false } },
        { path: 'string', body: { key: 'childId', size: 50, required: false } },
        { path: 'string', body: { key: 'parentId', size: 50, required: false } },
    ];

    console.log('\n> Creating attributes...');
    for (const attr of attrs) {
        console.log(`  - ${attr.body.key}...`);
        await api('POST', `/databases/${DB_ID}/collections/login_requests/attributes/${attr.path}`, attr.body);
        await new Promise(r => setTimeout(r, 600));
    }

    // 3. Wait for attributes to be available before creating indexes
    console.log('\n⏳ Waiting 5s for attributes to become available...');
    await new Promise(r => setTimeout(r, 5000));

    // 4. Create indexes
    const indexes = [
        { key: 'idx_parentEmail', type: 'key', attributes: ['parentEmail'], orders: ['ASC'] },
        { key: 'idx_status', type: 'key', attributes: ['status'], orders: ['ASC'] },
    ];

    console.log('\n> Creating indexes...');
    for (const idx of indexes) {
        console.log(`  - ${idx.key}...`);
        await api('POST', `/databases/${DB_ID}/collections/login_requests/indexes`, idx);
        await new Promise(r => setTimeout(r, 800));
    }

    console.log('\n🎉 login_requests collection ready!');
    console.log('Refresh your Appwrite Console to verify.');

})();
