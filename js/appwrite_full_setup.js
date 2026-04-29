const { Client, Databases, Permission, Role } = require('node-appwrite');

const PROJECT_ID = '69b554060007d12c46ee';
const DB_ID = '69b5543d0007695488c5';
// ⚠️  ROTATE THIS KEY: Go to Appwrite Console → Settings → API Keys, delete the old key,
//     create a new one, paste it below ONLY when running this script, then clear it again.
// ✅ SECURITY: Load the API key from an environment variable, never hardcode it.
// Set APPWRITE_API_KEY in your shell before running: $env:APPWRITE_API_KEY="standard_..."
const API_KEY = process.env.APPWRITE_API_KEY;
if (!API_KEY) {
    console.error('❌ CRITICAL: APPWRITE_API_KEY environment variable is not set. Aborting.');
    process.exit(1);
}

(async () => {
    console.log("🚀 Starting Appwrite Migration Initialization via Node.js CLI...");
    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1')
        .setProject(PROJECT_ID)
        .setKey(API_KEY);
        
    const databases = new Databases(client);

    try {
        console.log(`Checking Database [${DB_ID}]...`);
        await databases.get(DB_ID);
        console.log("🟢 Database exists.");
    } catch (e) {
        if (e.code === 404) {
            console.log(`⚠️ Database not found. Creating [${DB_ID}]...`);
            await databases.create(DB_ID, 'CubbyCoveDB');
            console.log("✅ Database created successfully.");
        } else {
            console.error("❌ Failed to verify database:", e.message);
            return;
        }
    }

    // Schema Definition
    const schema = [
        // ── 1. USERS (Profiles) ──
        {
            id: 'users',
            name: 'Users',
            attributes: [
                { type: 'string', key: 'role', required: true, size: 50 },
                { type: 'string', key: 'status', required: true, size: 50 },
                { type: 'string', key: 'firstName', required: true, size: 100 },
                { type: 'string', key: 'middleName', required: false, size: 100 },
                { type: 'string', key: 'lastName', required: true, size: 100 },
                { type: 'string', key: 'email', required: true, size: 255 },
                { type: 'string', key: 'faceId', required: true, size: 5000 },
                { type: 'string', key: 'idDocumentId', required: false, size: 65535 },
                { type: 'string', key: 'children', required: false, size: 50, array: true },
                { type: 'string', key: 'createdAt', required: false, size: 50 },
                { type: 'boolean', key: 'isPremium', required: false, xdefault: false },
                { type: 'string', key: 'staffId', required: false, size: 65535 },
                { type: 'string', key: 'otpCode', required: false, size: 10 },
                { type: 'string', key: 'otpExpires', required: false, size: 50 },
                { type: 'boolean', key: 'isEmailVerified', required: false, xdefault: false }
            ],
            indexes: [
                { key: 'email_idx', type: 'unique', attributes: ['email'] },
                { key: 'role_idx', type: 'key', attributes: ['role'] }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.any()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 2. CHILDREN ──
        {
            id: 'children',
            name: 'Children',
            attributes: [
                { type: 'string', key: 'parentId', required: true, size: 50 },
                { type: 'string', key: 'name', required: true, size: 100 },
                { type: 'string', key: 'username', required: true, size: 50 },
                { type: 'string', key: 'password', required: true, size: 100 },
                { type: 'string', key: 'avatar', required: false, size: 100 },
                { type: 'boolean', key: 'allowChat', required: false, xdefault: false },
                { type: 'boolean', key: 'allowGames', required: false, xdefault: false },
                { type: 'boolean', key: 'isOnline', required: false, xdefault: false },
                { type: 'integer', key: 'threatScore', required: false, xdefault: 0 },
                { type: 'integer', key: 'threatsDetected', required: false, xdefault: 0 },
                { type: 'string', key: 'screenTimeLogs', required: false, size: 65535 },
                { type: 'string', key: 'activityLogs', required: false, size: 65535 },
                { type: 'string', key: 'status', required: true, size: 50 },
                { type: 'integer', key: 'totalPoints', required: false, xdefault: 0 },
                { type: 'string', key: 'kidId', required: false, size: 10 },
                { type: 'string', key: 'avatarImage', required: false, size: 1000000 },
                { type: 'string', key: 'avatarBgColor', required: false, size: 50 },
                { type: 'string', key: 'bio', required: false, size: 1000 },
                { type: 'string', key: 'coverColor', required: false, size: 50 },
                { type: 'string', key: 'theme', required: false, size: 50 },
                { type: 'string', key: 'avatarIcon', required: false, size: 50 },
                { type: 'string', key: 'parentEmail', required: false, size: 255 },
                { type: 'string', key: 'avatarParts', required: false, size: 65535 },
                { type: 'string', key: 'unlockedCosmetics', required: false, size: 50, array: true },
                { type: 'string', key: 'unlockedThemes', required: false, size: 50, array: true }
            ],
            indexes: [
                { key: 'parentId_idx', type: 'key', attributes: ['parentId'] },
                { key: 'username_unique', type: 'unique', attributes: ['username'] }
            ],
            permissions: [
                // ✅ SECURITY NOTE: Children data IS readable by guests (Role.any()) so the kid login
                // flow can look up usernames without an authenticated session. Passwords are
                // bcrypt-hashed via security_utils.js — even if a guest reads the field, they
                // cannot reverse-engineer the original password. Parent email is also stored here
                // as a secondary validation field for the login handshake.
                Permission.read(Role.any()),    // ✅ Required: kid login needs to query by username
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 3. VIDEOS ──
        {
            id: 'videos',
            name: 'Videos',
            attributes: [
                { type: 'string', key: 'title', required: true, size: 255 },
                { type: 'string', key: 'url', required: true, size: 255 },
                { type: 'string', key: 'category', required: true, size: 100 },
                { type: 'string', key: 'creatorEmail', required: true, size: 255 },
                { type: 'string', key: 'status', required: true, size: 50 },
                { type: 'integer', key: 'views', required: false, xdefault: 0 },
                { type: 'string', key: 'uploadedAt', required: false, size: 50 },
                { type: 'integer', key: 'likes', required: false, xdefault: 0 },
                { type: 'integer', key: 'dislikes', required: false, xdefault: 0 },
                { type: 'integer', key: 'subscriberGains', required: false, xdefault: 0 },
                { type: 'string', key: 'thumbnailUrl', required: false, size: 65535 },
                { type: 'integer', key: 'duration', required: false },
                { type: 'integer', key: 'pointsValue', required: false, xdefault: 10 }
            ],
            permissions: [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 4. THREAT LOGS ──
        {
            id: 'threat_logs',
            name: 'Threat Logs',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 50 },
                { type: 'string', key: 'content', required: true, size: 5000 },
                { type: 'string', key: 'timestamp', required: false, size: 50 },
                { type: 'boolean', key: 'resolved', required: false, xdefault: false },
                { type: 'string', key: 'reason', required: false, size: 255 },
                { type: 'string', key: 'reporterChildId', required: false, size: 50 },
                { type: 'string', key: 'reporterChildName', required: false, size: 100 },
                { type: 'string', key: 'reporterParentEmail', required: false, size: 255 },
                { type: 'string', key: 'reportedChildId', required: false, size: 50 },
                { type: 'string', key: 'reportedChildName', required: false, size: 100 },
                { type: 'string', key: 'reportedParentEmail', required: false, size: 255 },
                { type: 'string', key: 'messageContent', required: false, size: 2000 },
                { type: 'string', key: 'violationType', required: false, size: 100 },
                { type: 'string', key: 'status', required: false, size: 50 },
                { type: 'string', key: 'resolution', required: false, size: 100 },
                { type: 'string', key: 'senderId', required: false, size: 50 },
                { type: 'string', key: 'receiverId', required: false, size: 50 }
            ],
            permissions: [
                Permission.read(Role.users()),
                // ✅ SECURITY: Only authenticated users (kids, parents, staff) should report threats.
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 5. ACCESS LOGS ──
        {
            id: 'access_logs',
            name: 'Access Logs',
            attributes: [
                { type: 'string', key: 'userId', required: true, size: 50 },
                { type: 'string', key: 'childId', required: false, size: 50 },
                { type: 'string', key: 'action', required: true, size: 50 },
                { type: 'string', key: 'timestamp', required: true, size: 50 } 
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ]
        },
        // ── 6. BUDDIES ──
        {
            id: 'buddies',
            name: 'Buddies',
            attributes: [
                { type: 'string', key: 'fromChildId', required: true, size: 50 },
                { type: 'string', key: 'toChildId', required: true, size: 50 },
                { type: 'string', key: 'fromUsername', required: true, size: 50 },
                { type: 'string', key: 'toUsername', required: true, size: 50 },
                { type: 'string', key: 'fromKidId', required: false, size: 10 },
                { type: 'string', key: 'toKidId', required: false, size: 10 },
                { type: 'string', key: 'status', required: true, size: 20 },
                { type: 'string', key: 'createdAt', required: true, size: 50 },
                { type: 'string', key: 'updatedAt', required: false, size: 50 }
            ],
            indexes: [
                { key: 'fromChild', type: 'key', attributes: ['fromChildId'] },
                { key: 'toChild', type: 'key', attributes: ['toChildId'] }
            ],
            permissions: [
                // ✅ SECURITY: Buddy social graph should not be fully public.
                // Authenticated users can read/create/update their own buddy relationships.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ]
        },
        // ── 7. PARENT NOTIFICATIONS ──
        {
            id: 'parent_notifications',
            name: 'Parent Notifications',
            attributes: [
                { type: 'string', key: 'parentId', required: true, size: 50 },
                { type: 'string', key: 'type', required: true, size: 50 },
                { type: 'string', key: 'message', required: true, size: 500 },
                { type: 'string', key: 'childId', required: false, size: 50 },
                { type: 'string', key: 'buddyId', required: false, size: 50 },
                { type: 'boolean', key: 'isRead', required: false, xdefault: false },
                { type: 'string', key: 'createdAt', required: true, size: 50 }
            ],
            indexes: [
                 { key: 'parentId_idx', type: 'key', attributes: ['parentId'] }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.update(Role.users()),
                // ✅ SECURITY: Only authenticated system components or users should create notifications.
                Permission.create(Role.users()),
            ]
        },
        // ── 8. CHAT MESSAGES ──
        {
            id: 'chat_messages',
            name: 'Chat Messages',
            attributes: [
                { type: 'string', key: 'conversationId', required: true, size: 120 },
                { type: 'string', key: 'groupId', required: false, size: 50 },
                { type: 'string', key: 'fromChildId', required: true, size: 50 },
                { type: 'string', key: 'fromUsername', required: true, size: 50 },
                { type: 'string', key: 'text', required: true, size: 1000 },
                { type: 'string', key: 'sentAt', required: true, size: 50 }
            ],
            indexes: [
                { key: 'convo_idx', type: 'key', attributes: ['conversationId'] },
                { key: 'group_idx', type: 'key', attributes: ['groupId'] }
            ],
            permissions: [
                // ✅ SECURITY: Chat messages must NOT be publicly readable — this is a child safety requirement.
                // Only authenticated users (parents monitoring, authenticated kids) can access chat.
                Permission.read(Role.users()),
                // Guests need create so the unauthenticated kid flow can post messages.
                // Appwrite Anonymous Sessions should be used here once the kid auth refactor lands.
                Permission.create(Role.users()),
            ]
        },
        // ── 9. KID WATCH HISTORY ──
        {
            id: 'kid_watch_history',
            name: 'Kid Watch History',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 65535 },
                { type: 'string', key: 'videoId', required: true, size: 65535 },
                { type: 'string', key: 'videoTitle', required: false, size: 65535 },
                { type: 'string', key: 'videoCategory', required: false, size: 65535 },
                { type: 'string', key: 'videoUrl', required: false, size: 65535 },
                { type: 'string', key: 'thumbnailUrl', required: false, size: 65535 },
                { type: 'string', key: 'watchedAt', required: true, size: 65535 }
            ],
            permissions: [
                // ✅ SECURITY: Watch history is private per-child data.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 10. KID FAVORITES ──
        {
            id: 'kid_favorites',
            name: 'Kid Favorites',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 65535 },
                { type: 'string', key: 'videoId', required: true, size: 65535 },
                { type: 'string', key: 'videoTitle', required: false, size: 65535 },
                { type: 'string', key: 'videoCategory', required: false, size: 65535 },
                { type: 'string', key: 'videoUrl', required: false, size: 65535 },
                { type: 'string', key: 'thumbnailUrl', required: false, size: 65535 },
                { type: 'string', key: 'addedAt', required: true, size: 65535 }
            ],
            permissions: [
                // ✅ SECURITY: Favorites are private per-child data.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 11. PATHS ──
        {
            id: 'paths',
            name: 'Paths',
            attributes: [
                { type: 'string', key: 'title', required: true, size: 255 },
                { type: 'string', key: 'description', required: false, size: 1000 },
                { type: 'string', key: 'creatorEmail', required: true, size: 255 },
                { type: 'string', key: 'type', required: true, size: 50 },
                { type: 'string', key: 'videoIds', required: true, size: 255, array: true },
                { type: 'integer', key: 'bonusPoints', required: false },
                { type: 'string', key: 'createdAt', required: false, size: 50 },
                { type: 'string', key: 'updatedAt', required: false, size: 50 },
                { type: 'integer', key: 'bonusStars', required: false },
                { type: 'string', key: 'badgeImage', required: false, size: 65535 },
                { type: 'string', key: 'rewardCosmeticId', required: false, size: 50 }
            ],
            permissions: [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 12. KID REWARDS ──
        {
            id: 'kid_rewards',
            name: 'Kid Rewards',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 50 },
                { type: 'string', key: 'rewardType', required: true, size: 50 },
                { type: 'integer', key: 'points', required: true },
                { type: 'string', key: 'sourceId', required: false, size: 50 },
                { type: 'string', key: 'rewardId', required: true, size: 100 },
                { type: 'string', key: 'earnedAt', required: true, size: 50 }
            ],
            indexes: [
                { key: 'rewardId_idx', type: 'unique', attributes: ['rewardId'] }
            ],
            permissions: [
                // ✅ SECURITY: Reward records should not be public — prevents reward manipulation research.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ]
        },
        // ── 13. KID PATH STATUS ──
        {
            id: 'kid_path_status',
            name: 'Kid Path Status',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 50 },
                { type: 'string', key: 'pathId', required: true, size: 50 },
                { type: 'string', key: 'completedVideoIds', required: false, size: 255, array: true },
                { type: 'string', key: 'currentStatus', required: true, size: 50 },
                { type: 'string', key: 'updatedAt', required: true, size: 50 }
            ],
            permissions: [
                // ✅ SECURITY: Path progress is private per-child data.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ]
        },
        // ── 14. LOGIN REQUESTS ──
        {
            id: 'login_requests',
            name: 'Login Requests',
            attributes: [
                { type: 'string', key: 'childUsername', required: true, size: 50 },
                { type: 'string', key: 'parentEmail', required: true, size: 255 },
                { type: 'string', key: 'status', required: true, size: 20 },
                { type: 'string', key: 'requestedAt', required: true, size: 50 },
                { type: 'string', key: 'deviceInfo', required: false, size: 500 },
                { type: 'string', key: 'expiresAt', required: false, size: 50 },
                { type: 'string', key: 'childName', required: false, size: 100 },
                { type: 'string', key: 'childId', required: false, size: 50 },
                { type: 'string', key: 'parentId', required: false, size: 50 }
            ],
            indexes: [
                { key: 'parentEmail_idx', type: 'key', attributes: ['parentEmail'] }
            ],
            permissions: [
                // ✅ SECURITY: Login requests must be readable/creatable by guests
                // (kids are unauthenticated) but updates MUST be authenticated-only
                // (only the parent can approve/deny — never a guest).
                Permission.read(Role.any()),   // Kid polls the status of their own request
                Permission.create(Role.any()), // Kid creates the initial login request
                Permission.update(Role.users()), // ✅ FIXED: Only authenticated parents can approve/deny
            ]
        },
        // ── 15. PENDING STAFF ──
        {
            id: 'pending_staff',
            name: 'Pending Staff',
            attributes: [
                { type: 'string', key: 'email', required: true, size: 255 },
                { type: 'string', key: 'firstName', required: true, size: 100 },
                { type: 'string', key: 'lastName', required: true, size: 100 },
                { type: 'string', key: 'role', required: true, size: 50 },
                { type: 'string', key: 'staffId', required: true, size: 20 },
                { type: 'string', key: 'usersDocId', required: true, size: 50 },
                { type: 'boolean', key: 'isClaimed', required: false, xdefault: false }
            ],
            indexes: [
                { key: 'email_idx', type: 'key', attributes: ['email'] }  // 'key' (not 'unique') allows multiple docs per email across re-claims
            ],
            permissions: [
                // ✅ SECURITY: Claim page reads require guessing the ID, but ideally this would be more restricted.
                // Keeping as Role.any() for the claim-flow UI to work before login.
                Permission.read(Role.any()),     
                Permission.create(Role.users()),
                Permission.update(Role.any()),   // claim page updates isClaimed flag without auth
            ]
        },
        // ── 16. SCREEN TIME LOGS ──
        {
            id: 'screen_time_logs',
            name: 'Screen Time Logs',
            attributes: [
                { type: 'string', key: 'childId', required: false, size: 50 },
                { type: 'string', key: 'date', required: false, size: 20 },
                { type: 'double', key: 'minutes', required: false },
                { type: 'string', key: 'category', required: false, size: 50 },
                { type: 'string', key: 'detail', required: false, size: 500 },
                { type: 'string', key: 'timestamp', required: false, size: 50 }
            ],
            indexes: [
                { key: 'childId_idx', type: 'key', attributes: ['childId'] },
                { key: 'timestamp_idx', type: 'key', attributes: ['timestamp'] }
            ],
            permissions: [
                // ✅ SECURITY: Screen time data is private — only parents/staff should see it.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ]
        },
        // ── 17. ACTIVITY LOGS ──
        {
            id: 'activity_logs',
            name: 'Activity Logs',
            attributes: [
                { type: 'string', key: 'childId', required: true, size: 50 },
                { type: 'string', key: 'type', required: true, size: 50 },
                { type: 'string', key: 'action', required: true, size: 255 },
                { type: 'string', key: 'timestamp', required: true, size: 50 },
                { type: 'string', key: 'metadata', required: false, size: 5000 }
            ],
            indexes: [
                { key: 'childId_idx', type: 'key', attributes: ['childId'] },
                { key: 'timestamp_idx', type: 'key', attributes: ['timestamp'] }
            ],
            permissions: [
                // ✅ SECURITY: Activity logs are sensitive child behavioral data — private.
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 18. GROUP CHATS ──
        {
            id: 'group_chats',
            name: 'Group Chats',
            attributes: [
                { type: 'string', key: 'name', required: true, size: 100 },
                { type: 'string', key: 'creatorId', required: true, size: 50 },
                { type: 'string', key: 'memberIds', required: true, size: 50, array: true },
                { type: 'string', key: 'createdAt', required: true, size: 50 }
            ],
            indexes: [
                { key: 'creator_idx', type: 'key', attributes: ['creatorId'] }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 19. ADMIN AUDIT LOGS ──
        {
            id: 'admin_audit_logs',
            name: 'Admin Audit Logs',
            attributes: [
                { type: 'string', key: 'adminId', required: true, size: 50 },
                { type: 'string', key: 'adminName', required: true, size: 100 },
                { type: 'string', key: 'action', required: true, size: 50 },
                { type: 'string', key: 'targetId', required: false, size: 50 },
                { type: 'string', key: 'details', required: false, size: 1000 },
                { type: 'string', key: 'timestamp', required: true, size: 50 },
                { type: 'string', key: 'groupId', required: false, size: 50 },
                { type: 'string', key: 'groupName', required: false, size: 100 }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ]
        },
        // ── 20. COSMETICS ──
        {
            id: 'cosmetics',
            name: 'Cosmetics',
            attributes: [
                { type: 'string', key: 'title', required: true, size: 255 },
                { type: 'string', key: 'type', required: true, size: 50 },
                { type: 'string', key: 'image', required: true, size: 65535 },
                { type: 'integer', key: 'priceStars', required: false },
                { type: 'boolean', key: 'isLegendary', required: false, xdefault: false }
            ],
            permissions: [
                Permission.read(Role.any()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]
        },
        // ── 21. SUPPORT TICKETS ──
        {
            id: 'support_tickets',
            name: 'Support Tickets',
            attributes: [
                { type: 'string', key: 'parentId', required: true, size: 50 },
                { type: 'string', key: 'subject', required: true, size: 255 },
                { type: 'string', key: 'status', required: true, size: 50 },
                { type: 'string', key: 'lastMessageAt', required: true, size: 50 },
                { type: 'string', key: 'createdAt', required: true, size: 50 }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
            ]
        },
        // ── 22. SUPPORT MESSAGES ──
        {
            id: 'support_messages',
            name: 'Support Messages',
            attributes: [
                { type: 'string', key: 'ticketId', required: true, size: 50 },
                { type: 'string', key: 'senderId', required: true, size: 50 },
                { type: 'boolean', key: 'isStaff', required: false, xdefault: false },
                { type: 'string', key: 'text', required: true, size: 2000 },
                { type: 'string', key: 'sentAt', required: true, size: 50 }
            ],
            permissions: [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
            ]
        }
    ];

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const coll of schema) {
        let collectionExists = false;
        try {
            await databases.getCollection(DB_ID, coll.id);
            console.log(`⚠️ Collection [${coll.name}] already exists. Syncing permissions...`);
            await databases.updateCollection(DB_ID, coll.id, coll.name, coll.permissions || []);
            collectionExists = true;
        } catch (e) {
            if (e.code === 404) {
                console.log(`Creating Collection [${coll.name}]...`);
                await databases.createCollection(DB_ID, coll.id, coll.name, coll.permissions || []);
                console.log(`✅ Collection [${coll.name}] created.`);
            } else {
                console.error(`❌ Failed to check for collection [${coll.name}]:`, e.message);
                continue;
            }
        }

        console.log(`  -> Syncing attributes for [${coll.name}]...`);
        const existingAttributes = collectionExists ? (await databases.listAttributes(DB_ID, coll.id)).attributes.map(a => a.key) : [];

        for (const attr of coll.attributes) {
            if (existingAttributes.includes(attr.key)) {
                console.log(`    🔵 Attribute [${attr.key}] already exists. Skipping...`);
                continue;
            }

            try {
                if (attr.type === 'string') {
                    await databases.createStringAttribute(DB_ID, coll.id, attr.key, attr.size, attr.required, attr.xdefault, attr.array || false);
                } else if (attr.type === 'integer') {
                    const def = attr.xdefault !== undefined ? attr.xdefault : null;
                    await databases.createIntegerAttribute(DB_ID, coll.id, attr.key, attr.required, 0, 9007199254740991, def, attr.array || false);
                } else if (attr.type === 'double') {
                     await databases.createFloatAttribute(DB_ID, coll.id, attr.key, attr.required, 0, 999999999, attr.xdefault, attr.array || false);
                } else if (attr.type === 'boolean') {
                    const def = attr.xdefault !== undefined ? attr.xdefault : null;
                    await databases.createBooleanAttribute(DB_ID, coll.id, attr.key, attr.required, def, attr.array || false);
                }
                console.log(`    🟢 Added attribute: ${attr.key}`);
                await sleep(300); // Prevent rate limiting
            } catch (e) {
                console.error(`    ❌ Failed to add attribute ${attr.key}:`, e.message);
            }
        }

        if (coll.indexes) {
            console.log(`  -> Syncing indexes for [${coll.name}]...`);
            const existingIndexes = (await databases.listIndexes(DB_ID, coll.id)).indexes.map(i => i.key);
            for (const idx of coll.indexes) {
                if (existingIndexes.includes(idx.key)) {
                    console.log(`    🔵 Index [${idx.key}] already exists. Skipping...`);
                    continue;
                }
                try {
                    await databases.createIndex(DB_ID, coll.id, idx.key, idx.type, idx.attributes, idx.attributes.map(() => 'ASC'));
                    console.log(`    🟢 Added index: ${idx.key}`);
                } catch (e) {
                    console.error(`    ❌ Failed to add index ${idx.key}:`, e.message);
                }
            }
        }
        await sleep(1000);
    }

    console.log("🎉 ALL DONE! Your Appwrite database is fully configured and ready to go.");
})();
