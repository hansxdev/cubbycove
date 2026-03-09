// ==========================================
// CUBBYCOVE — ADD CHAT MESSAGES COLLECTION
// ==========================================
// Run this in your Appwrite Console browser (F12) while logged in as Admin.
// It creates the 'chat_messages' collection used by CubbyChat's real-time system.

(async function setupChatMessages() {

    const PROJECT_ID = '69904f4900396667cf4c';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
    const headers = { 'content-type': 'application/json', 'x-appwrite-project': PROJECT_ID, 'x-appwrite-mode': 'admin' };

    async function api(method, path, body) {
        const options = { method, headers, credentials: 'include' };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${ENDPOINT}${path}`, options);
        if (res.status === 204) return { ok: true };
        const data = await res.json();
        if (!res.ok) {
            if (res.status === 409) { console.log('   ↳ Already exists, skipping.'); return { exists: true }; }
            throw new Error(`[${res.status}] ${data.message}`);
        }
        return data;
    }

    const dbList = await api('GET', '/databases');
    const DB_ID = dbList.databases[0].$id;
    console.log('✅ Database: ' + DB_ID);

    // ─────────────────────────────────────────────────────────────
    // Create 'chat_messages' collection
    // ─────────────────────────────────────────────────────────────
    console.log('\n> Creating chat_messages collection...');
    await api('POST', `/databases/${DB_ID}/collections`, {
        collectionId: 'chat_messages',
        name: 'Chat Messages',
        // any = unauthenticated kids can write (they use sessionStorage, not Appwrite Auth)
        permissions: ['read("any")', 'create("any")', 'update("users")', 'delete("users")'],
        documentSecurity: false
    });
    await new Promise(r => setTimeout(r, 800));

    const attrs = [
        { key: 'conversationId', size: 120, required: true },  // "<childId_A>_<childId_B>" sorted
        { key: 'fromChildId', size: 50, required: true },
        { key: 'fromUsername', size: 50, required: true },
        { key: 'text', size: 1000, required: true },
        { key: 'sentAt', size: 50, required: true }
    ];

    console.log('> Creating attributes...');
    for (const attr of attrs) {
        console.log('  - ' + attr.key + '...');
        await api('POST', `/databases/${DB_ID}/collections/chat_messages/attributes/string`, {
            key: attr.key, size: attr.size, required: attr.required
        });
        await new Promise(r => setTimeout(r, 600));
    }

    // Wait for attributes to be ready before adding indexes
    await new Promise(r => setTimeout(r, 4000));

    const indexes = [
        { key: 'idx_conversationId', type: 'key', attributes: ['conversationId'], orders: ['ASC'] },
        { key: 'idx_sentAt', type: 'key', attributes: ['sentAt'], orders: ['ASC'] }
    ];

    console.log('> Creating indexes...');
    for (const idx of indexes) {
        console.log('  - ' + idx.key + '...');
        await api('POST', `/databases/${DB_ID}/collections/chat_messages/indexes`, idx);
        await new Promise(r => setTimeout(r, 800));
    }

    console.log('\n🎉 chat_messages collection is ready!');
    console.log('   Make sure Realtime is enabled for this project in your Appwrite Console.');

})();
