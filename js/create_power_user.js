// ==========================================
// CREATE POWER USER SCRIPT
// ==========================================
// Copy and paste this script into your Browser Console (F12)
// while on the Appwrite Console (cloud.appwrite.io) page.

(async function createPowerUser() {

    // CONFIGURATION (Matches your project)
    const PROJECT_ID = '69904f4900396667cf4c';
    const DB_ID = '699054e500210206c665';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';

    console.log("🚀 Creating Super Admin User...");

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    // Helper to make requests
    async function api(method, path, body = null) {
        const options = {
            method,
            headers,
            credentials: 'include',
        };
        if (body && method !== 'GET') options.body = JSON.stringify(body);

        const response = await fetch(`${ENDPOINT}${path}`, options);
        // We handle errors manually in the main block for 409/404 logic
        return {
            ok: response.ok,
            status: response.status,
            data: await response.json().catch(() => ({}))
        };
    }

    try {
        // 1. Create Auth User
        console.log(`[1/2] Creating Auth Account...`);
        let userId;

        // Try to create
        const createRes = await api('POST', '/users', {
            userId: 'unique()',
            email: 'power_user@cubbycove.com',
            password: 'password123',
            name: 'Power User',
            emailVerification: true
        });

        if (createRes.ok) {
            userId = createRes.data.$id;
            console.log(` -> Created User (${userId}).`);
        } else if (createRes.status === 409) {
            console.log(` -> User already exists. Fetching ID...`);
            // List users to find ID
            const listRes = await api('GET', `/users?search=power_user@cubbycove.com`);
            if (listRes.ok && listRes.data.users && listRes.data.users.length > 0) {
                userId = listRes.data.users[0].$id;
                console.log(` -> Found User ID: ${userId}`);
            } else {
                throw new Error("User exists but could not be found via search.");
            }
        } else {
            throw new Error(`Failed to create user: ${createRes.data.message}`);
        }

        // 2. Create User Profile in Database
        console.log(`[2/2] Checking/Creating Database Profile...`);

        // Check if doc exists
        const docCheck = await api('GET', `/databases/${DB_ID}/collections/users/documents/${userId}`);

        if (docCheck.ok) {
            console.log(` -> Profile Document already exists.`);
        } else if (docCheck.status === 404) {
            // Create
            const docRes = await api('POST', `/databases/${DB_ID}/collections/users/documents`, {
                documentId: userId,
                data: {
                    role: 'super_admin', // Access Level
                    status: 'active',
                    firstName: 'Power',
                    lastName: 'User',
                    email: 'power_user@cubbycove.com',
                    createdAt: new Date().toISOString()
                }
            });

            if (!docRes.ok) throw new Error(`Failed to create profile: ${docRes.data.message}`);
            console.log(` -> Created Profile Document.`);
        } else {
            throw new Error(`Error checking profile: ${docCheck.data.message}`);
        }

        console.log("✅ POWER USER READY!");
        console.log("Email: power_user@cubbycove.com");
        console.log("Password: password123");

    } catch (err) {
        console.error("❌ SETUP FAILED:", err);
    }

})();
