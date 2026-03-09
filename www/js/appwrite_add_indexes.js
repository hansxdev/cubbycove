// ==========================================
// CUBBYCOVE — ADD INDEXES SCRIPT
// ==========================================
// Paste this ENTIRE script into your Browser Console (F12)
// while logged into cloud.appwrite.io INSIDE your project.

(async function addIndexes() {

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
            if (res.status === 409) { console.log(`   ↳ Already exists, skipping.`); return { exists: true }; }
            throw new Error(`[${res.status}] ${data.message}`);
        }
        return data;
    }

    // --- Find the database ID automatically ---
    console.log('🔍 Finding database...');
    const dbList = await api('GET', '/databases');
    if (!dbList.databases || dbList.databases.length === 0) {
        console.error('❌ No database found. Run the main setup script first.');
        return;
    }
    const DB_ID = dbList.databases[0].$id;
    console.log(`✅ Using database: "${dbList.databases[0].name}" (${DB_ID})`);

    // --- Indexes to create ---
    const indexes = [
        // children collection
        { collection: 'children', key: 'idx_username', type: 'key', attributes: ['username'], orders: ['ASC'] },
        { collection: 'children', key: 'idx_parentId', type: 'key', attributes: ['parentId'], orders: ['ASC'] },

        // users collection
        { collection: 'users', key: 'idx_email', type: 'key', attributes: ['email'], orders: ['ASC'] },
        { collection: 'users', key: 'idx_role', type: 'key', attributes: ['role'], orders: ['ASC'] },
    ];

    console.log(`\n📌 Creating ${indexes.length} indexes...\n`);

    for (const idx of indexes) {
        console.log(`  > [${idx.collection}] index: "${idx.key}" on (${idx.attributes.join(', ')})...`);
        try {
            const result = await api(
                'POST',
                `/databases/${DB_ID}/collections/${idx.collection}/indexes`,
                {
                    key: idx.key,
                    type: idx.type,
                    attributes: idx.attributes,
                    orders: idx.orders
                }
            );
            if (!result.exists) {
                console.log(`   ✅ Created.`);
            }
        } catch (err) {
            console.error(`   ❌ Failed: ${err.message}`);
        }
        // Small delay so Appwrite can process each index
        await new Promise(r => setTimeout(r, 800));
    }

    console.log('\n🎉 Done! Indexes may take a few seconds to become "Available".');
    console.log('Refresh your Appwrite Console → collection → Indexes tab to verify.');

})();
