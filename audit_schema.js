const fs = require('fs');

const dataServiceStr = fs.readFileSync('js/data_service.js', 'utf8');
const setupStr = fs.readFileSync('js/appwrite_full_setup.js', 'utf8');

// Parse setup.js schema
const schemaMatch = setupStr.match(/const schema = \[([\s\S]*?)\];/);
let schemaCode = schemaMatch ? schemaMatch[1] : '';

const collections = {};
let currentKey = null;

const lines = setupStr.split('\n');
for (const line of lines) {
    if (line.includes("id: '")) {
        currentKey = line.match(/id:\s*'([^']+)'/)[1];
        collections[currentKey] = new Set();
    }
    if (currentKey && line.includes("key: '")) {
        const attr = line.match(/key:\s*'([^']+)'/)[1];
        collections[currentKey].add(attr);
    }
}

// Hardcode known collection mappings
const constants = {
    USERS: 'users',
    CHILDREN: 'children',
    VIDEOS: 'videos',
    THREAT_LOGS: 'threat_logs',
    ACCESS_LOGS: 'access_logs',
    BUDDIES: 'buddies',
    PARENT_NOTIFICATIONS: 'parent_notifications',
    CHAT_MESSAGES: 'chat_messages',
    KID_WATCH_HISTORY: 'kid_watch_history',
    KID_FAVORITES: 'kid_favorites',
    PATHS: 'paths',
    KID_REWARDS: 'kid_rewards',
    KID_PATH_STATUS: 'kid_path_status',
    LOGIN_REQUESTS: 'login_requests',
    PENDING_STAFF: 'pending_staff',
    SCREEN_TIME_LOGS: 'screen_time_logs',
    ACTIVITY_LOGS: 'activity_logs',
    GROUP_CHATS: 'group_chats',
    ADMIN_AUDIT_LOGS: 'admin_audit_logs'
};

const usedAttributes = {};

// Simple regex to catch keys in object literals passed to databases.createDocument and updateDocument
const lines2 = dataServiceStr.split('\n');
let insideObj = false;
let currentColl = null;

for (let i = 0; i < lines2.length; i++) {
    const line = lines2[i];
    
    const methodMatch = line.match(/databases\.(createDocument|updateDocument)\([^,]+,\s*(?:COLLECTIONS\.|')([A-Z_a-z]+)'?/);
    if (methodMatch) {
        currentColl = methodMatch[2];
        if (constants[currentColl]) currentColl = constants[currentColl];
        insideObj = true;
    }
    
    if (insideObj) {
        const keyMatch = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
        if (keyMatch) {
            if (!usedAttributes[currentColl]) usedAttributes[currentColl] = new Set();
            usedAttributes[currentColl].add(keyMatch[1]);
        }
    }
}

console.log("=== SCHEMA AUDIT REPORT ===");
for (let coll in usedAttributes) {
    if (!collections[coll]) {
        console.log(`[!] Unknown Collection: ${coll}`);
        continue;
    }
    const missing = [];
    for (let key of usedAttributes[coll]) {
        if (!collections[coll].has(key)) {
            missing.push(key);
        }
    }
    if (missing.length > 0) {
        console.log(`[!] Missing attributes in ${coll}: ${missing.join(', ')}`);
    } else {
        console.log(`[OK] ${coll}`);
    }
}
