// ==========================================
// MASTER RESTORE SCRIPT (Power User + Schema)
// ==========================================
// Copy and paste this script into your Browser Console (F12)
// while on the Appwrite Console (cloud.appwrite.io) page.

(async function masterRestore() {

    const PROJECT_ID = '69b554060007d12c46ee';
    const DB_ID = '69b5543d0007695488c5';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    console.log("🚀 Starting System Restore...");

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

    try {
        // --- STEP 1: FIX SCHEMA ---
        console.log(`[1/3] Checking Schema...`);
        const schemaRes = await api('POST', `/databases/${DB_ID}/collections/users/attributes/string`, {
            key: 'createdAt', size: 50, required: false
        });

        if (schemaRes.ok) {
            console.log(" -> Added missing 'createdAt' attribute. Waiting 5s for indexing...");
            await new Promise(r => setTimeout(r, 5000));
        } else if (schemaRes.status === 409) {
            console.log(" -> Schema Looks Good ('createdAt' exists).");
        } else {
            console.warn(" -> Schema check warning:", schemaRes.data.message);
        }

        // --- STEP 2: ENSURE AUTH USER ---
        console.log(`[2/3] Checking Auth Account...`);
        let userId;

        const authRes = await api('POST', '/users', {
            userId: 'unique()',
            email: 'power_user@cubbycove.com',
            password: 'password123',
            name: 'Power User',
            emailVerification: true
        });

        if (authRes.ok) {
            userId = authRes.data.$id;
            console.log(` -> Created New Auth User (${userId}).`);
        } else if (authRes.status === 409) {
            const listRes = await api('GET', `/users?search=power_user@cubbycove.com`);
            if (listRes.ok && listRes.data.users.length > 0) {
                userId = listRes.data.users[0].$id;
                console.log(` -> Found Existing Auth User (${userId}).`);
            } else {
                throw new Error("User exists but lookup failed.");
            }
        } else {
            throw new Error(`Auth Creation Failed: ${authRes.data.message}`);
        }

        // --- STEP 3: ENSURE DB PROFILE ---
        console.log(`[3/3] Checking Database Profile...`);
        const docCheck = await api('GET', `/databases/${DB_ID}/collections/users/documents/${userId}`);

        if (docCheck.ok) {
            console.log(" -> Profile Document already exists. All Good.");
        } else if (docCheck.status === 404) {
            console.log(" -> Profile missing. Creating now...");
            // Exclude 'createdAt' if we suspect it's still initializing? No, try to include it.
            // If it fails, retry without it?

            const docData = {
                role: 'super_admin',
                status: 'active',
                firstName: 'Power',
                lastName: 'User',
                middleName: '',
                email: 'power_user@cubbycove.com',
                faceId: 'manual_override', // Required by schema
                createdAt: new Date().toISOString()
            };

            let docRes = await api('POST', `/databases/${DB_ID}/collections/users/documents`, {
                documentId: userId, data: docData
            });

            if (!docRes.ok && docRes.data.message.includes("Unknown attribute")) {
                console.warn(" -> 'createdAt' not ready yet. Retrying without it...");
                delete docData.createdAt;
                docRes = await api('POST', `/databases/${DB_ID}/collections/users/documents`, {
                    documentId: userId, data: docData
                });
            }

            if (!docRes.ok) throw new Error(`Profile Creation Failed: ${docRes.data.message}`);
            console.log(" -> Profile Created Successfully.");
        }

        console.log("✅ SYSTEM RESTORED! You can now login.");
        console.log("Email: power_user@cubbycove.com");
        console.log("Password: password123");

    } catch (err) {
        console.error("❌ RESTORE FAILED:", err);
    }

})();
