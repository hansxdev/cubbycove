// ==========================================
// APPWRITE SETUP SCRIPT
// ==========================================
// Copy and paste this ENTIRE script into your Browser Console (F12)
// while you are on the Appwrite Console (cloud.appwrite.io) page
// and inside your project.

(async function setupAppwrite() {

    // CONFIGURATION
    const PROJECT_ID = '69904f4900396667cf4c'; // From your .env
    const DB_ID = 'cubbycove_db';
    const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1'; // Correct Regional Endpoint.

    console.log("🚀 Starting CubbyCove Database Setup...");

    const headers = {
        'content-type': 'application/json',
        'x-appwrite-project': PROJECT_ID,
        'x-appwrite-mode': 'admin'
    };

    // Helper to make requests
    async function api(method, path, body = {}) {
        const options = {
            method,
            headers,
            credentials: 'include', //  <-- CRITICAL: Sends your Admin Cookies
        };
        if (method !== 'GET') options.body = JSON.stringify(body);

        const response = await fetch(`${ENDPOINT}${path}`, options);
        if (!response.ok) {
            const err = await response.json();
            // Ignore "Already Exists" errors
            if (response.status === 409) return { exists: true };
            throw new Error(`API Error [${path}]: ${err.message}`);
        }
        return await response.json();
    }

    try {
        // 1. Check/Create Database
        console.log(`[1/5] Checking Database...`);
        let targetDbId = DB_ID;

        // Check if we can create one or if we should use existing
        const dbList = await api('GET', '/databases');

        if (dbList.total > 0) {
            // Use the first existing database
            targetDbId = dbList.databases[0].$id;
            console.log(` -> Existing database found: '${dbList.databases[0].name}' (${targetDbId}). Using this one.`);
        } else {
            // Create new if none exist
            console.log(` -> Creating new database '${DB_ID}'...`);
            const db = await api('POST', '/databases', {
                databaseId: DB_ID,
                name: 'CubbyCove DB'
            });
            targetDbId = db.$id;
            console.log(` -> Created Database.`);
        }

        // Print the ID so user knows to update config
        console.log(`⚠️ IMPORTANT: Update your appwrite_config.js with DB_ID = '${targetDbId}'`);

        // 2. Create Collections & Attributes
        const collections = [
            {
                id: 'users',
                name: 'Users',
                attributes: [
                    { key: 'role', type: 'string', size: 50, required: true },
                    { key: 'status', type: 'string', size: 50, required: true }, // pending, active
                    { key: 'firstName', type: 'string', size: 100, required: true },
                    { key: 'middleName', type: 'string', size: 100, required: false }, // Added middleName
                    { key: 'lastName', type: 'string', size: 100, required: true },
                    { key: 'email', type: 'string', size: 255, required: true },
                    { key: 'faceId', type: 'string', size: 5000, required: false }, // Big string for descriptors
                ]
            },
            {
                id: 'children',
                name: 'Children',
                attributes: [
                    { key: 'parentId', type: 'string', size: 50, required: true }, // Link to User ID
                    { key: 'name', type: 'string', size: 100, required: true },
                    { key: 'username', type: 'string', size: 50, required: true },
                    { key: 'password', type: 'string', size: 100, required: true }, // Simple password
                    { key: 'isOnline', type: 'boolean', required: false, default: false },
                    { key: 'threatScore', type: 'integer', required: false, default: 0 },
                ]
            },
            {
                id: 'videos',
                name: 'Videos',
                attributes: [
                    { key: 'title', type: 'string', size: 255, required: true },
                    { key: 'url', type: 'string', size: 255, required: true }, // YouTube URL/ID
                    { key: 'category', type: 'string', size: 100, required: true },
                    { key: 'creatorEmail', type: 'string', size: 255, required: true },
                    { key: 'status', type: 'string', size: 50, required: true }, // pending, approved
                    { key: 'views', type: 'integer', required: false, default: 0 },
                    { key: 'uploadedAt', type: 'string', size: 50, required: false },
                ]
            },
            {
                id: 'threat_logs',
                name: 'Threat Logs',
                attributes: [
                    { key: 'childId', type: 'string', size: 50, required: true },
                    { key: 'content', type: 'string', size: 5000, required: true },
                    { key: 'resolved', type: 'boolean', required: false, default: false },
                ]
            }
        ];

        console.log(`[2/5] Creating ${collections.length} Collections inside '${targetDbId}'...`);

        for (const col of collections) {
            console.log(`  > Processing '${col.name}'...`);

            // Create Collection
            const c = await api('POST', `/databases/${targetDbId}/collections`, {
                collectionId: col.id,
                name: col.name,
                permissions: [
                    // Permissions: Any user can read? No. 
                    // For Simplicity in this Starter, we allow Any Logged In User to Read/Write
                    Permission.read(Role.users()),
                    Permission.write(Role.users())
                ],
                documentSecurity: false
            });

            if (c.exists) console.log(`    - Collection exists.`);
            else console.log(`    - Created Collection.`);

            // Create Attributes
            for (const attr of col.attributes) {
                // Determine API endpoint based on type
                let typePath = 'string';
                const body = {
                    key: attr.key,
                    required: attr.required,
                    default: attr.default
                };

                if (attr.type === 'string') {
                    typePath = 'string';
                    body.size = attr.size || 255;
                } else if (attr.type === 'integer') {
                    typePath = 'integer';
                } else if (attr.type === 'boolean') {
                    typePath = 'boolean';
                }

                // Use targetDbId here!
                const attRes = await api('POST', `/databases/${targetDbId}/collections/${col.id}/attributes/${typePath}`, body);
                if (attRes.exists) {
                    // exists
                } else {
                    console.log(`    - Created Attribute '${attr.key}'.`);
                    await new Promise(r => setTimeout(r, 500));
                }
            }
            // Wait between collections
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log("✅ SETUP COMPLETE! attributes may take a few seconds to become 'Available'.");
        console.log("You can now refresh your Appwrite Console to see your new Database structure.");

    } catch (err) {
        console.error("❌ SETUP FAILED:", err);
    }

})();

// Mocking SDK Constants if run in pure console without SDK var
var Permission = {
    read: (r) => `read("${r}")`,
    write: (r) => `write("${r}")`
};
var Role = {
    users: () => 'users',
    any: () => 'any'
};
