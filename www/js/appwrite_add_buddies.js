// ==========================================
// CUBBYCOVE — ADD BUDDIES SYSTEM
// ==========================================
// Run this in your Appwrite Console browser (F12) while logged in.
// It creates:
//   1. 'buddies' collection (buddy requests + relationships)
//   2. 'parent_notifications' collection (buddy events for parents)
//   3. Adds 'kidId' attribute to the existing 'children' collection

(async function setupBuddies() {

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
    // 1. Add 'kidId' to the children collection
    // ─────────────────────────────────────────────────────────────
    console.log('\n> Adding kidId to children collection...');
    await api('POST', `/databases/${DB_ID}/collections/children/attributes/string`, {
        key: 'kidId', size: 10, required: false
    });
    await new Promise(r => setTimeout(r, 800));

    // Add index for searching by kidId
    await api('POST', `/databases/${DB_ID}/collections/children/indexes`, {
        key: 'idx_kidId', type: 'key', attributes: ['kidId'], orders: ['ASC']
    });
    await new Promise(r => setTimeout(r, 800));

    // ─────────────────────────────────────────────────────────────
    // 2. Create 'buddies' collection
    // ─────────────────────────────────────────────────────────────
    console.log('\n> Creating buddies collection...');
    await api('POST', `/databases/${DB_ID}/collections`, {
        collectionId: 'buddies',
        name: 'Buddies',
        permissions: ['read("any")', 'create("any")', 'update("any")', 'delete("any")'],
        documentSecurity: false
    });
    await new Promise(r => setTimeout(r, 800));

    const buddyAttrs = [
        { key: 'fromChildId', size: 50, required: true },
        { key: 'toChildId', size: 50, required: true },
        { key: 'fromUsername', size: 50, required: true },
        { key: 'toUsername', size: 50, required: true },
        { key: 'fromKidId', size: 10, required: false },
        { key: 'toKidId', size: 10, required: false },
        { key: 'status', size: 20, required: true }, // pending | accepted | declined
        { key: 'createdAt', size: 50, required: true },
        { key: 'updatedAt', size: 50, required: false },
    ];

    console.log('> Creating buddy attributes...');
    for (const attr of buddyAttrs) {
        console.log('  - ' + attr.key + '...');
        await api('POST', `/databases/${DB_ID}/collections/buddies/attributes/string`, { key: attr.key, size: attr.size, required: attr.required });
        await new Promise(r => setTimeout(r, 600));
    }

    await new Promise(r => setTimeout(r, 4000));

    const buddyIndexes = [
        { key: 'idx_fromChildId', type: 'key', attributes: ['fromChildId'], orders: ['ASC'] },
        { key: 'idx_toChildId', type: 'key', attributes: ['toChildId'], orders: ['ASC'] },
        { key: 'idx_status', type: 'key', attributes: ['status'], orders: ['ASC'] },
    ];

    console.log('> Creating buddy indexes...');
    for (const idx of buddyIndexes) {
        console.log('  - ' + idx.key + '...');
        await api('POST', `/databases/${DB_ID}/collections/buddies/indexes`, idx);
        await new Promise(r => setTimeout(r, 800));
    }

    // ─────────────────────────────────────────────────────────────
    // 3. Create 'parent_notifications' collection
    // ─────────────────────────────────────────────────────────────
    console.log('\n> Creating parent_notifications collection...');
    await api('POST', `/databases/${DB_ID}/collections`, {
        collectionId: 'parent_notifications',
        name: 'Parent Notifications',
        permissions: ['read("any")', 'create("any")', 'update("users")', 'delete("users")'],
        documentSecurity: false
    });
    await new Promise(r => setTimeout(r, 800));

    const notifAttrs = [
        { key: 'parentId', size: 50, required: true },
        { key: 'type', size: 50, required: true }, // buddy_request | buddy_accepted
        { key: 'message', size: 500, required: true },
        { key: 'childId', size: 50, required: false },
        { key: 'buddyId', size: 50, required: false },
        { key: 'isRead', required: false },  // boolean
        { key: 'createdAt', size: 50, required: true },
    ];

    console.log('> Creating notification attributes...');
    for (const attr of notifAttrs) {
        if (attr.size) {
            await api('POST', `/databases/${DB_ID}/collections/parent_notifications/attributes/string`, { key: attr.key, size: attr.size, required: attr.required });
        } else {
            // boolean
            await api('POST', `/databases/${DB_ID}/collections/parent_notifications/attributes/boolean`, { key: attr.key, required: attr.required, default: false });
        }
        console.log('  - ' + attr.key + '...');
        await new Promise(r => setTimeout(r, 600));
    }

    await new Promise(r => setTimeout(r, 4000));

    await api('POST', `/databases/${DB_ID}/collections/parent_notifications/indexes`, {
        key: 'idx_parentId', type: 'key', attributes: ['parentId'], orders: ['ASC']
    });
    console.log('  - idx_parentId...');
    await new Promise(r => setTimeout(r, 800));

    await api('POST', `/databases/${DB_ID}/collections/parent_notifications/indexes`, {
        key: 'idx_isRead', type: 'key', attributes: ['isRead'], orders: ['ASC']
    });
    console.log('  - idx_isRead...');

    console.log('\n🎉 Buddies system ready! Run the app and generate kidIds for existing children via DataService.');

})();
