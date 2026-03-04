// ==========================================
// CUBBYCOVE — DATABASE MIGRATION SCRIPT v2
// ==========================================
// Run this ONCE in the Appwrite Console browser console (F12 → Console tab)
// while you are logged into cloud.appwrite.io on your project page.
//
// This script:
//  1. Migrates threat_logs: adds all new fields needed for the full report system
//  2. Creates screen_time_logs: a new any-write collection for kid screen time

(async function runMigration() {

    const PROJECT_ID = '69904f4900396667cf4c';
    const DB_ID = '699054e500210206c665';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    async function api(method, path, body = null) {
        const options = { method, headers, credentials: 'include' };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`${ENDPOINT}${path}`, options);
        const json = await res.json().catch(() => ({}));
        if (!res.ok && res.status !== 409) {
            throw new Error(`[${res.status}] ${json.message || path}`);
        }
        return { ...json, _status: res.status };
    }

    async function addAttr(collectionId, type, body) {
        const result = await api('POST', `/databases/${DB_ID}/collections/${collectionId}/attributes/${type}`, body);
        if (result._status === 409) {
            console.log(`  ⚠️  '${body.key}' already exists, skipping.`);
        } else {
            console.log(`  ✅ Created '${body.key}'`);
            await new Promise(r => setTimeout(r, 600)); // wait for Appwrite to process
        }
    }

    console.log('🚀 Starting CubbyCove DB Migration...\n');

    // ──────────────────────────────────────────────────────────────
    // 1. MIGRATE threat_logs — add all fields for full report system
    // ──────────────────────────────────────────────────────────────
    console.log('[1/2] Migrating threat_logs collection...');

    const threatFields = [
        { key: 'reporterChildId', type: 'string', size: 50 },
        { key: 'reporterChildName', type: 'string', size: 100 },
        { key: 'reporterParentEmail', type: 'string', size: 255 },
        { key: 'reportedChildId', type: 'string', size: 50 },
        { key: 'reportedChildName', type: 'string', size: 100 },
        { key: 'reportedParentEmail', type: 'string', size: 255 },
        { key: 'messageContent', type: 'string', size: 2000 },
        { key: 'violationType', type: 'string', size: 100 },
        { key: 'status', type: 'string', size: 50 },
        { key: 'resolution', type: 'string', size: 100 },
        { key: 'timestamp', type: 'string', size: 50 },
        { key: 'reason', type: 'string', size: 255 },
        // Legacy compat fields (may 409 if already exist — that's fine)
        { key: 'senderId', type: 'string', size: 50 },
        { key: 'receiverId', type: 'string', size: 50 },
    ];

    for (const f of threatFields) {
        try {
            await addAttr('threat_logs', 'string', {
                key: f.key,
                size: f.size,
                required: false,
                default: null
            });
        } catch (e) {
            console.warn(`  ⚠️  Could not add '${f.key}': ${e.message}`);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // 2. CREATE screen_time_logs (any-write, users-read)
    //    Kids write to this without an Appwrite Auth session.
    // ──────────────────────────────────────────────────────────────
    console.log('\n[2/2] Creating screen_time_logs collection...');

    try {
        await api('POST', `/databases/${DB_ID}/collections`, {
            collectionId: 'screen_time_logs',
            name: 'Screen Time Logs',
            permissions: [
                'create("any")',       // Kids can write without being logged in
                'read("users")',       // Parents (logged in) can read
                'update("users")',     // Logged-in users can update
                'delete("users")'
            ],
            documentSecurity: false
        });
        console.log('  ✅ Collection created');
        await new Promise(r => setTimeout(r, 800));
    } catch (e) {
        if (e.message.includes('409') || e.message.includes('already')) {
            console.log('  ⚠️  Collection already exists');
        } else {
            console.warn('  ❌ Collection error:', e.message);
        }
    }

    // Add attributes
    const screenTimeFields = [
        { key: 'childId', size: 50 },
        { key: 'date', size: 20 },  // "2026-03-04"
        { key: 'minutes', type: 'float' },
    ];

    for (const f of screenTimeFields) {
        try {
            if (f.type === 'float') {
                await addAttr('screen_time_logs', 'float', { key: f.key, required: false });
            } else {
                await addAttr('screen_time_logs', 'string', { key: f.key, size: f.size, required: false, default: null });
            }
        } catch (e) {
            console.warn(`  ⚠️  Could not add '${f.key}': ${e.message}`);
        }
    }

    // Also add screenTimeLogs to children (may already exist from previous run)
    console.log('\n[Bonus] Ensuring children.screenTimeLogs attribute exists...');
    try {
        await addAttr('children', 'string', { key: 'screenTimeLogs', size: 65535, required: false, default: null });
    } catch (e) {
        console.warn('  ⚠️ ', e.message);
    }

    console.log('\n✅ Migration complete! Refresh the Appwrite Console to verify.');
    console.log('🔔 Attributes take a few seconds to become "Available" — wait before testing.');

})();
