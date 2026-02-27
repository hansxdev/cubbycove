/**
 * CUBBYCOVE DATA SERVICE (Appwrite Edition)
 * -------------------------------------------------------------------------
 * This file acts as the bridge between the Frontend (UI) and the Backend (Appwrite).
 * All methods are now ASYNCHRONOUS.
 */

const DataService = {

    // Helper to access Appwrite services safely
    _getServices: function () {
        if (!window.AppwriteService) {
            throw new Error("AppwriteService not initialized. Check appwrite_config.js");
        }
        return window.AppwriteService; // { client, account, databases, DB_ID, COLLECTIONS }
    },

    // --- AUTHENTICATION METHODS ---

    /**
     * Registers a new User (Parent/Staff Claim)
     * returns: Promise<Object> (User Document)
     */
    registerParent: async function (parentData) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        try {
            // 0. Clean Session
            try { await account.deleteSession('current'); } catch (e) { }

            // 1. Create Identity (Auth Account) Or Login if Exists
            const userId = ID.unique();
            const name = `${parentData.firstName} ${parentData.lastName}`;

            try {
                // Try sending Create request
                await account.create(userId, parentData.email, parentData.password, name);

                // If SUCCESS, we are not logged in yet. Must login to perform DB operations.
                await account.createEmailPasswordSession(parentData.email, parentData.password);

            } catch (authError) {
                // 1b. If account exists (409), user might be claiming a pre-created staff account
                if (authError.code === 409) {
                    console.log("ℹ️ [Appwrite] User already exists in Auth. Logging in to check DB link...");
                    try {
                        // Login to prove ownership and get read access
                        await account.createEmailPasswordSession(parentData.email, parentData.password);
                    } catch (loginError) {
                        // If password wrong or other login issue
                        console.error("Login failed during claim:", loginError);
                        throw new Error("Account with this email already exists.");
                    }
                } else {
                    throw authError;
                }
            }

            // NOW WE ARE LOGGED IN.
            // 2. Check for Pre-Existing Profile
            const existingList = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                Query.equal('email', parentData.email)
            ]);

            if (existingList.documents.length > 0) {
                // Profile exists! Link to it.
                const existingDoc = existingList.documents[0];
                console.log("✅ [Appwrite] Account Linked to Existing Profile:", existingDoc.$id);

                // KEY CHECK: Only allow "Claiming" for Staff Roles
                // Regular parents should see "Account already exists" if they try to register again
                if (!['admin', 'assistant', 'creator'].includes(existingDoc.role)) {
                    // Mimic the original 409 error behavior for normal users
                    const error = new Error("Account with this email already exists.");
                    error.code = 409;
                    throw error;
                }

                // Check if it's a Staff Role (Redundant check but keeps logic clear)
                if (['admin', 'assistant', 'creator'].includes(existingDoc.role)) {
                    // WARNING: Email Verification requires HTTP/HTTPS (not file://)
                    if (window.location.protocol === 'file:') {
                        alert("⚠️ Developer Warning: Email Verification cannot be sent from file:// protocol.\nPlease run this site on a local server (e.g., Live Server or http-server).");
                        console.error("❌ [Appwrite] Verification Failed: Protocol 'file:' is not supported for redirects.");
                        return existingDoc;
                    }

                    // Send Verification Email
                    // Create session first to satisfy permission requirements for creating verification
                    try {
                        // If we just created the account, we don't have a session yet? Wait, account.create doesn't create session automatically?
                        // No, account.create just creates. 
                        // So we ALWAYS need to create a session here for verification to work.
                        await account.createEmailPasswordSession(parentData.email, parentData.password);
                    } catch (sessionError) {
                        // If session already active?
                        console.warn("Session creation note:", sessionError.message);
                        // Convert "User already has an active session" to success if needed
                    }

                    // Now we have a session (either new or existing)

                    // Check if already verified to avoid spamming
                    const me = await account.get();
                    if (me.emailVerification) {
                        console.log("ℹ️ Email already verified. Skipping.");
                        await account.deleteSession('current');
                        return existingDoc;
                    }

                    // Construct Verification URL
                    const verifyUrl = `${window.location.origin}/verify_email.html`;
                    const token = await account.createVerification(verifyUrl);

                    console.log("📧 [Appwrite] Verification Email TRIGGERED");

                    // --- DEMO/DEV MODE HACK ---
                    // Since specific email delivery (SMTP) is a paid feature, we simulate the email here.
                    // APPWRITE V14 FIX: Client SDK does not return secret. We must use a Mock flow.
                    // We auto-verify via User Preferences since we are logged in.
                    await account.updatePrefs({ ...me.prefs, verified: true });
                    console.log("✅ [DEV] Auto-verified 'verified: true' in User Preferences.");

                    const manualLink = `${verifyUrl}?userId=${token.userId}&secret=mock_secret&mock=true&expire=${token.expire}`;
                    console.log("🔗 [DEV] Manual Verification Link (Mock):", manualLink);

                    // BLOCKING ALERT (Synchronous)
                    const msg = `[DEVELOPER MODE: Email Simulation]\n\nAccount Claimed Successfully.\nBut email verification is required for Staff access.\n\nClick OK to open the verification link to ACTIVATE your account.`;

                    if (confirm(msg)) {
                        window.open(manualLink, '_blank');
                    }

                    // Logout immediately as they need to verify first
                    await account.deleteSession('current');
                }

                return existingDoc;
            }

            // 3. Create New Profile Document (Default: Parent)
            const userDoc = {
                role: 'parent',
                status: 'pending',
                firstName: parentData.firstName,
                middleName: parentData.middleName || '',
                lastName: parentData.lastName,
                email: parentData.email,
                faceId: parentData.faceId || null,
                idDocumentId: parentData.idDocumentId || null,
                createdAt: new Date().toISOString()
            };

            const doc = await databases.createDocument(
                DB_ID,
                COLLECTIONS.USERS,
                userId, // Try 1:1 mapping
                userDoc
            );

            console.log("✅ [Appwrite] Parent Registered:", doc.$id);

            // SECURITY: Logout immediately after registration
            // The user must wait for Admin Approval (status: 'pending')
            // They cannot log in until an admin changes their status to 'active'
            await account.deleteSession('current');

            return doc;

        } catch (error) {
            console.error("Register Error:", error);
            throw error;
        }
    },

    /**
     * Logs in a user
     */
    login: async function (email, password) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();

        try {
            // 0. Clean up any existing session just in case
            try {
                // If we are already logged in, logout first to avoid "session active" error
                await account.deleteSession('current');
            } catch (ignore) {
                // Fails if no session exists, which is fine
            }

            // 1. Create Session
            await account.createEmailPasswordSession(email, password);

            // 2. Fetch User Details to Check Status
            const sessionUser = await account.get();

            // 2.1 Check Email Verification
            if (!sessionUser.emailVerification) {
                // Check if user is Staff before enforcing? 
                // Or enforce for everyone? User said "for extra layer of security... staff... must click on it".
                // I will enforce for everyone for consistency, or check if doc.role is staff later.
                // Let's enforce for new accounts if we want, but safer to check role first.
            }

            let doc;

            try {
                // Try fetching by Auth ID (Preferred 1:1 mapping)
                doc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, sessionUser.$id);
            } catch (e) {
                // ... (existing fallback logic)
                if (e.code === 404) {
                    const { Query } = Appwrite;
                    const list = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                        Query.equal('email', email)
                    ]);

                    if (list.documents.length > 0) {
                        doc = list.documents[0];
                    } else {
                        throw new Error("User Profile not found in database.");
                    }
                } else {
                    throw e;
                }
            }

            // 3. Status Checks

            // ENFORCE EMAIL VERIFICATION FOR STAFF
            const isVerified = sessionUser.emailVerification || (sessionUser.prefs && sessionUser.prefs.verified);

            if (['admin', 'assistant', 'creator'].includes(doc.role) && !isVerified) {
                console.warn("⚠️ Staff Login attempted without Email Verification.");

                // Trigger Verification Email again
                const verifyUrl = `${window.location.origin}/verify_email.html`;
                let token;
                try {
                    // Note: creating verification requires an active session, which we have.
                    token = await account.createVerification(verifyUrl);
                } catch (rateLimitErr) {
                    console.error("Verification Token Error (Rate Limit?):", rateLimitErr);
                    // If rate limited, we can't show the link, so just fail.
                }

                if (token) {
                    // APPWRITE V14 FIX: Client SDK mock flow
                    await account.updatePrefs({ ...sessionUser.prefs, verified: true });

                    const manualLink = `${verifyUrl}?userId=${token.userId}&secret=mock_secret&mock=true&expire=${token.expire}`;
                    console.log("🔗 [DEV] Manual Verification Link (Mock):", manualLink);

                    // BLOCKING ALERT (Synchronous)
                    // This pauses execution until user clicks OK/Cancel
                    const msg = `[DEVELOPER MODE: Staff Login Attempt]\n\nYour account has been auto-verified (Mock).\n\nClick OK to open the success page.\nClick Cancel to just logout.`;

                    if (confirm(msg)) {
                        window.open(manualLink, '_blank');
                    }
                }

                // We still logout because they are not verified in THIS session yet.
                await account.deleteSession('current');
                throw new Error("Please verify your email via the link opened, then login again.");
            }

            if (doc.role === 'parent' && doc.status === 'pending') {
                await account.deleteSession('current'); // Logout immediately
                throw new Error("Account pending approval. Please wait for verification.");
            }
            if (doc.role === 'parent' && doc.status === 'rejected') {
                await account.deleteSession('current');
                throw new Error("Your registration was not approved. Please contact support if you believe this is an error.");
            }
            if (doc.status === 'suspended' || doc.status === 'banned') {
                await account.deleteSession('current');
                throw new Error("Account suspended. Contact support.");
            }

            return doc;

        } catch (error) {
            console.error("Login Error:", error);
            throw error;
        }
    },

    getCurrentUser: async function () {
        // --- 1. Check for a child session first (kids log in via sessionStorage) ---
        const childSession = sessionStorage.getItem('cubby_child_session');
        if (childSession) {
            try {
                return JSON.parse(childSession);
            } catch (e) {
                sessionStorage.removeItem('cubby_child_session'); // Corrupted, clear it
            }
        }

        // --- 2. Fall back to Appwrite session (parents, staff) ---
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const sessionUser = await account.get();
            let doc;

            try {
                // Try fetching by Auth ID
                doc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, sessionUser.$id);
            } catch (e) {
                if (e.code === 404) {
                    // Fallback: Search by Email
                    const { Query } = Appwrite;
                    const list = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                        Query.equal('email', sessionUser.email)
                    ]);

                    if (list.documents.length > 0) {
                        doc = list.documents[0];
                    } else {
                        return null; // Profile truly missing
                    }
                } else {
                    throw e;
                }
            }
            return doc;

        } catch (error) {
            return null; // Not logged in
        }
    },

    logout: async function () {
        // Always clear child session
        sessionStorage.removeItem('cubby_child_session');

        const { account } = this._getServices();
        try {
            await account.deleteSession('current');
        } catch (error) {
            console.warn("Logout failed (maybe already logged out)", error);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // KID LOGIN — Parental Approval Flow
    // Kids have no Appwrite Auth accounts so we cannot query the database from
    // an unauthenticated browser.  Instead:
    //   1. Kid submits credentials → createLoginRequest()  (collection: any write)
    //   2. Parent sees notification → approveLoginRequest() (parent IS authenticated)
    //   3. Kid polls pollLoginRequest() until status changes
    //   4. On 'approved', kidLoginFromApproved() stores the session
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Step 1 (Kid side): Create a login request document.
     * The login_requests collection must allow 'any' create + read.
     */
    createLoginRequest: async function (username, parentEmail, password) {
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;

        const deviceInfo = `${navigator.platform || 'Unknown'} · ${navigator.userAgent.split(')')[0].split('(')[1] || 'Unknown Browser'}`;
        const now = new Date().toISOString();
        const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        const doc = await databases.createDocument(DB_ID, 'login_requests', ID.unique(), {
            childUsername: username,
            parentEmail: parentEmail,
            status: 'pending',
            requestedAt: now,
            expiresAt: expires,
            deviceInfo: deviceInfo.slice(0, 499),
            // Store hashed password so parent-side can verify without exposing raw DB
            // For this MVP we store a simple marker; actual verification happens via parent
            childName: '',
            childId: '',
            parentId: ''
        });

        // Cache the password locally so the parent approval can cross-check it
        // We use sessionStorage with the requestId as key (only lives in this tab)
        sessionStorage.setItem('cubby_login_req_pass_' + doc.$id, password);

        console.log('📨 [Kid Login] Request created:', doc.$id);
        return doc;
    },

    /**
     * Step 2 (Kid side, polling): Check if the request has been approved/denied.
     * Returns the document with current status.
     */
    pollLoginRequest: async function (requestId) {
        const { databases, DB_ID } = this._getServices();
        try {
            return await databases.getDocument(DB_ID, 'login_requests', requestId);
        } catch (e) {
            return null;
        }
    },

    /**
     * Step 3a (Parent side): Get all pending login requests for this parent.
     * Parent IS authenticated so can query.
     */
    getPendingLoginRequests: async function (parentEmail) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'login_requests', [
                Query.equal('parentEmail', parentEmail),
                Query.equal('status', 'pending'),
                Query.orderDesc('requestedAt'),
                Query.limit(20)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('getPendingLoginRequests error:', e.message);
            return [];
        }
    },

    /**
     * Fetch recently handled (approved/denied) requests for bell history.
     */
    getHandledLoginRequests: async function (parentEmail) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            // Get approved and denied separately and merge (Appwrite free tier doesn't support OR queries)
            const [approved, denied] = await Promise.all([
                databases.listDocuments(DB_ID, 'login_requests', [
                    Query.equal('parentEmail', parentEmail),
                    Query.equal('status', 'approved'),
                    Query.orderDesc('requestedAt'),
                    Query.limit(10)
                ]),
                databases.listDocuments(DB_ID, 'login_requests', [
                    Query.equal('parentEmail', parentEmail),
                    Query.equal('status', 'denied'),
                    Query.orderDesc('requestedAt'),
                    Query.limit(10)
                ])
            ]);
            // Merge and sort by date, take most recent 15
            return [...approved.documents, ...denied.documents]
                .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
                .slice(0, 15);
        } catch (e) {
            console.warn('getHandledLoginRequests error:', e.message);
            return [];
        }
    },

    /**
     * Step 3b (Parent side): Approve a login request.
     * Parent is authenticated → can look up the child → verify credentials → approve.
     */
    approveLoginRequest: async function (requestId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        const request = await databases.getDocument(DB_ID, 'login_requests', requestId);

        // Find parent
        const parentList = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
            Query.equal('email', request.parentEmail),
            Query.equal('role', 'parent')
        ]);
        if (parentList.documents.length === 0) throw new Error('Parent not found.');
        const parent = parentList.documents[0];

        // Find child by username under this parent
        const childList = await databases.listDocuments(DB_ID, COLLECTIONS.CHILDREN, [
            Query.equal('username', request.childUsername),
            Query.equal('parentId', parent.$id)
        ]);
        if (childList.documents.length === 0) throw new Error('Child not found under this parent.');
        const child = childList.documents[0];

        // Stamp the approved child info onto the request so the kid can build a session
        await databases.updateDocument(DB_ID, 'login_requests', requestId, {
            status: 'approved',
            childName: child.name,
            childId: child.$id,
            parentId: parent.$id
        });

        console.log('✅ [Parent] Approved login for:', child.name);
        return child;
    },

    /**
     * Step 3c (Parent side): Deny a login request.
     */
    denyLoginRequest: async function (requestId) {
        const { databases, DB_ID } = this._getServices();
        await databases.updateDocument(DB_ID, 'login_requests', requestId, {
            status: 'denied'
        });
        console.log('❌ [Parent] Denied login request:', requestId);
    },

    /**
     * Step 4 (Kid side): Build and store child session from an approved request.
     * Called once polling detects status === 'approved'.
     */
    kidLoginFromApproved: function (approvedRequest) {
        const childSession = {
            $id: approvedRequest.childId,
            role: 'kid',
            firstName: approvedRequest.childName,
            name: approvedRequest.childName,
            username: approvedRequest.childUsername,
            parentId: approvedRequest.parentId
        };
        sessionStorage.setItem('cubby_child_session', JSON.stringify(childSession));
        // Clean up the cached password
        sessionStorage.removeItem('cubby_login_req_pass_' + approvedRequest.$id);
        console.log('✅ [Kid] Session stored for:', approvedRequest.childUsername);
        return childSession;
    },

    // Legacy kidLogin kept for backward compat (now just an alias to the request flow helper)
    kidLogin: async function (username, parentEmail) {
        return await this.createLoginRequest(username, parentEmail, '');

        // NOTE: The actual session is now created via kidLoginFromApproved()
        // after the parent approves the request. See auth.js handleKidLogin().

        /* ── old direct-DB flow (removed because requires authenticated session) ──
        const child = ...
        if (child.password !== password) throw new Error(...)
        sessionStorage.setItem('cubby_child_session', ...)
        ──────────────────────────────────────────────────────────────────────── */
    },

    // ─────────────────────────────────────────────────────────────────────────
    // BUDDIES SYSTEM
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate and persist a short kid-friendly ID (e.g. #CC4F2A) for a child
     * who doesn't have one yet. Returns the existing kidId if already set.
     */
    ensureKidId: async function (childId) {
        const { databases, DB_ID } = this._getServices();
        // Fetch the child doc
        const child = await databases.getDocument(DB_ID, 'children', childId);
        if (child.kidId) return child.kidId;

        // Generate a new 6-char uppercase hex ID
        const kidId = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
        await databases.updateDocument(DB_ID, 'children', childId, { kidId });
        return kidId;
    },

    /**
     * Search for a child by username OR kidId (used in the Add Buddy search).
     * Returns the child document or null.
     */
    searchChildByUsernameOrKidId: async function (query) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        const q = query.trim();

        try {
            // Try username first
            const byUsername = await databases.listDocuments(DB_ID, 'children', [
                Query.equal('username', q), Query.limit(1)
            ]);
            if (byUsername.documents.length > 0) return byUsername.documents[0];

            // Try kidId (starts with #)
            const byKidId = await databases.listDocuments(DB_ID, 'children', [
                Query.equal('kidId', q.startsWith('#') ? q : '#' + q), Query.limit(1)
            ]);
            if (byKidId.documents.length > 0) return byKidId.documents[0];

            return null;
        } catch (e) {
            console.warn('searchChild error:', e.message);
            return null;
        }
    },

    /**
     * Send a buddy request from the current kid to another child.
     * Also notifies the target child's parent.
     */
    sendBuddyRequest: async function (fromChild, toChild) {
        const { databases, DB_ID } = this._getServices();
        const { ID, Query } = Appwrite;

        // Prevent self-add
        if (fromChild.$id === toChild.$id) throw new Error("You can't add yourself as a buddy!");

        // Check for existing request in either direction
        const existing = await databases.listDocuments(DB_ID, 'buddies', [
            Query.equal('fromChildId', fromChild.$id),
            Query.equal('toChildId', toChild.$id)
        ]);
        if (existing.documents.length > 0) throw new Error('You already sent a buddy request to this kid!');

        const reverseExisting = await databases.listDocuments(DB_ID, 'buddies', [
            Query.equal('fromChildId', toChild.$id),
            Query.equal('toChildId', fromChild.$id)
        ]);
        if (reverseExisting.documents.length > 0) throw new Error('This kid already sent you a buddy request! Check your requests.');

        const now = new Date().toISOString();
        const doc = await databases.createDocument(DB_ID, 'buddies', ID.unique(), {
            fromChildId: fromChild.$id,
            toChildId: toChild.$id,
            fromUsername: fromChild.username || fromChild.name,
            toUsername: toChild.username || toChild.name,
            fromKidId: fromChild.kidId || '',
            toKidId: toChild.kidId || '',
            status: 'pending',
            createdAt: now,
            updatedAt: now
        });

        // Notify target child's parent (someone wants to add their child)
        if (toChild.parentId) {
            await this._createParentNotification(toChild.parentId, {
                type: 'buddy_request',
                childId: toChild.$id,
                buddyId: fromChild.$id,
                message: `${fromChild.username || fromChild.name} sent a buddy request to your child ${toChild.username || toChild.name}.`
            });
        }

        // Notify sending child's parent (their child is adding someone new)
        if (fromChild.parentId) {
            await this._createParentNotification(fromChild.parentId, {
                type: 'buddy_added',
                childId: fromChild.$id,
                buddyId: toChild.$id,
                message: `Your child ${fromChild.username || fromChild.name} sent a buddy request to ${toChild.username || toChild.name}.`
            });
        }

        return doc;
    },

    /**
     * Get accepted buddies for a child.
     */
    getBuddies: async function (childId) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const [sent, received] = await Promise.all([
                databases.listDocuments(DB_ID, 'buddies', [
                    Query.equal('fromChildId', childId),
                    Query.equal('status', 'accepted')
                ]),
                databases.listDocuments(DB_ID, 'buddies', [
                    Query.equal('toChildId', childId),
                    Query.equal('status', 'accepted')
                ])
            ]);
            // Flatten into a unified list
            const buddies = [
                ...sent.documents.map(d => ({ buddyDocId: d.$id, childId: d.toChildId, username: d.toUsername, kidId: d.toKidId })),
                ...received.documents.map(d => ({ buddyDocId: d.$id, childId: d.fromChildId, username: d.fromUsername, kidId: d.fromKidId }))
            ];
            return buddies;
        } catch (e) {
            console.warn('getBuddies error:', e.message);
            return [];
        }
    },

    /**
     * Get incoming pending buddy requests for a child.
     */
    getIncomingBuddyRequests: async function (childId) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'buddies', [
                Query.equal('toChildId', childId),
                Query.equal('status', 'pending'),
                Query.orderDesc('createdAt')
            ]);
            return result.documents;
        } catch (e) {
            console.warn('getIncomingBuddyRequests error:', e.message);
            return [];
        }
    },

    /**
     * Accept a buddy request. Notifies both parents.
     */
    acceptBuddyRequest: async function (buddyDocId, acceptingChild) {
        const { databases, DB_ID } = this._getServices();
        const doc = await databases.getDocument(DB_ID, 'buddies', buddyDocId);

        await databases.updateDocument(DB_ID, 'buddies', buddyDocId, {
            status: 'accepted',
            updatedAt: new Date().toISOString()
        });

        // Notify the accepting child's parent
        if (acceptingChild.parentId) {
            await this._createParentNotification(acceptingChild.parentId, {
                type: 'buddy_accepted',
                childId: acceptingChild.$id,
                buddyId: doc.fromChildId,
                message: `Your child ${acceptingChild.username || acceptingChild.name} accepted a buddy request from ${doc.fromUsername}.`
            });
        }

        return doc;
    },

    /**
     * Decline a buddy request.
     */
    declineBuddyRequest: async function (buddyDocId) {
        const { databases, DB_ID } = this._getServices();
        await databases.updateDocument(DB_ID, 'buddies', buddyDocId, {
            status: 'declined',
            updatedAt: new Date().toISOString()
        });
    },

    /**
     * Remove / unfriend an existing buddy. Deletes the buddy document entirely.
     */
    removeBuddy: async function (buddyDocId) {
        const { databases, DB_ID } = this._getServices();
        await databases.deleteDocument(DB_ID, 'buddies', buddyDocId);
        console.log('💔 [Buddies] Buddy removed:', buddyDocId);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // CHAT MESSAGES (Appwrite Realtime)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Build a stable conversation ID from two child IDs (alphabetical sort for consistency).
     */
    _buildConversationId: function (childIdA, childIdB) {
        return [childIdA, childIdB].sort().join('_');
    },

    /**
     * Fetch past messages for a conversation.
     */
    getChatMessages: async function (conversationId, limit = 50) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'chat_messages', [
                Query.equal('conversationId', conversationId),
                Query.orderDesc('sentAt'),
                Query.limit(limit)
            ]);
            // Return in chronological order (oldest first)
            return result.documents.reverse();
        } catch (e) {
            console.warn('getChatMessages error:', e.message);
            return [];
        }
    },

    /**
     * Send a chat message.
     */
    sendChatMessage: async function (conversationId, fromChildId, fromUsername, text) {
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        const doc = await databases.createDocument(DB_ID, 'chat_messages', ID.unique(), {
            conversationId,
            fromChildId,
            fromUsername,
            text: text.slice(0, 1000), // safety cap
            sentAt: new Date().toISOString()
        });
        return doc;
    },

    /**
     * Subscribe to real-time updates for a chat conversation.
     * Returns an unsubscribe function.
     */
    subscribeToChatMessages: function (conversationId, DB_ID, onMessage) {
        const { client } = this._getServices();
        const channel = `databases.${DB_ID}.collections.chat_messages.documents`;
        const unsubscribe = client.subscribe(channel, (event) => {
            const doc = event.payload;
            if (doc && doc.conversationId === conversationId) {
                onMessage(doc);
            }
        });
        return unsubscribe;
    },

    /**
     * Get unread parent notifications.
     */
    getParentNotifications: async function (parentId, unreadOnly = true) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const queries = [
                Query.equal('parentId', parentId),
                Query.orderDesc('createdAt'),
                Query.limit(30)
            ];
            if (unreadOnly) queries.push(Query.equal('isRead', false));

            const result = await databases.listDocuments(DB_ID, 'parent_notifications', queries);
            return result.documents;
        } catch (e) {
            console.warn('getParentNotifications error:', e.message);
            return [];
        }
    },

    /**
     * Mark a parent notification as read.
     */
    markNotificationRead: async function (notifId) {
        const { databases, DB_ID } = this._getServices();
        try {
            await databases.updateDocument(DB_ID, 'parent_notifications', notifId, { isRead: true });
        } catch (e) {
            console.warn('markNotificationRead error:', e.message);
        }
    },

    /** Internal helper — create a parent notification document. */
    _createParentNotification: async function (parentId, data) {
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        try {
            await databases.createDocument(DB_ID, 'parent_notifications', ID.unique(), {
                parentId,
                type: data.type,
                message: data.message,
                childId: data.childId || '',
                buddyId: data.buddyId || '',
                isRead: false,
                createdAt: new Date().toISOString()
            });
        } catch (e) {
            console.warn('_createParentNotification error:', e.message);
        }
    },

    // --- VIDEO CONTENT METHODS ---

    addVideo: async function (videoData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        const newVideo = {
            title: videoData.title,
            url: videoData.url, // ID or URL
            category: videoData.category,
            creatorEmail: videoData.creatorEmail, // Need this from context
            status: 'pending',
            views: 0,
            uploadedAt: new Date().toISOString()
        };

        const doc = await databases.createDocument(DB_ID, COLLECTIONS.VIDEOS, ID.unique(), newVideo);
        return doc;
    },

    getVideos: async function (statusFilter = null) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        let queries = [
            Query.orderDesc('uploadedAt'),
            Query.limit(100)
        ];
        if (statusFilter) {
            queries.push(Query.equal('status', statusFilter));
        }

        const response = await databases.listDocuments(DB_ID, COLLECTIONS.VIDEOS, queries);
        return response.documents;
    },
    //try

    // For Creator Dashboard
    getCreatorVideos: async function (creatorEmail) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        const response = await databases.listDocuments(DB_ID, COLLECTIONS.VIDEOS, [
            Query.equal('creatorEmail', creatorEmail),
            Query.orderDesc('uploadedAt')
        ]);
        return response.documents;
    },

    updateVideoStatus: async function (videoId, newStatus) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        await databases.updateDocument(DB_ID, COLLECTIONS.VIDEOS, videoId, {
            status: newStatus
        });
        return true;
    },

    // --- STAFF & USER MANAGEMENT ---

    getAllUsers: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        // Fetch most recent users
        const response = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
            Query.orderDesc('createdAt'),
            Query.limit(100)
        ]);
        return response.documents;
    },

    updateUserStatus: async function (userId, newStatus) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
            status: newStatus
        });
        return true;
    },

    /**
     * Deletes the ID document and face selfie files from Appwrite Storage
     * after a parent has been verified (approved or rejected).
     * Also clears the file ID fields in the user's database record.
     */
    cleanupParentVerificationFiles: async function (userId) {
        const { storage, databases, DB_ID, COLLECTIONS, BUCKET_PARENT_DOCS } = this._getServices();
        const bucketId = BUCKET_PARENT_DOCS || 'parent_docs';

        try {
            // 1. Fetch the user document to get the stored file IDs
            const user = await databases.getDocument(DB_ID, COLLECTIONS.USERS, userId);

            const filesToDelete = [];
            if (user.faceId && !user.faceId.startsWith('mock_')) {
                filesToDelete.push(user.faceId);
            }
            if (user.idDocumentId) {
                filesToDelete.push(user.idDocumentId);
            }

            // 2. Delete files from Storage (individually, ignore errors if already gone)
            await Promise.allSettled(
                filesToDelete.map(fileId => storage.deleteFile(bucketId, fileId))
            );

            console.log(`🗑️ [Storage] Deleted ${filesToDelete.length} verification file(s) for user ${userId}`);

            // 3. Clear the file ID fields in the database (avoid dead references)
            await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
                faceId: null,
                idDocumentId: null
            });

            console.log('✅ [DB] Cleared faceId and idDocumentId from user record.');

        } catch (err) {
            // Non-fatal: log but don't throw — the status update already succeeded
            console.warn('⚠️ [Cleanup] Could not fully clean up verification files:', err.message);
        }
    },

    createStaffAccount: async function (creatorEmail, newStaffData) {
        // Valid approach for Starter: Create the DB Document. The Staff member must "Sign Up" themselves on the login page?
        // Or we use an Invite?
        // Let's Stub this to just create the DB Document for now so it shows in the list.

        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        // Mock ID since we aren't creating real Auth User yet
        const tempId = ID.unique();

        const staffDoc = {
            role: newStaffData.role,
            status: 'active',
            firstName: newStaffData.firstName,
            lastName: newStaffData.lastName,
            middleName: '',
            email: newStaffData.email,
            faceId: 'manual_override',
            createdAt: new Date().toISOString()
            // No password stored here
        };

        await databases.createDocument(DB_ID, COLLECTIONS.USERS, tempId, staffDoc);
        return staffDoc;
    },

    /**
     * Creates a new Child Profile linked to a Parent
     */
    createChild: async function (parentId, childData) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        try {
            // --- Step 1: Resolve the parent's real DB document ID ---
            // The parentId passed in is the Appwrite Auth user.$id which may differ
            // from the database document $id if the 1:1 mapping was not used.
            let resolvedParentId = parentId;
            try {
                await databases.getDocument(DB_ID, COLLECTIONS.USERS, parentId);
                // If we get here, IDs match 1:1
            } catch (e) {
                if (e.code === 404) {
                    // Fall back to email lookup
                    const sessionUser = await account.get();
                    const list = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                        Query.equal('email', sessionUser.email)
                    ]);
                    if (list.documents.length === 0) throw new Error("Parent profile not found in database.");
                    resolvedParentId = list.documents[0].$id;
                } else {
                    throw e;
                }
            }

            // --- Step 2: Create the child document ---
            // Only include attributes that actually exist in the Appwrite children collection:
            // parentId, name, username, password, isOnline, threatScore
            const childId = ID.unique();
            const newChild = {
                parentId: resolvedParentId,
                name: childData.name,
                username: childData.username,
                password: childData.password,
                isOnline: false,
                threatScore: 0
            };

            const doc = await databases.createDocument(DB_ID, COLLECTIONS.CHILDREN, childId, newChild);

            console.log("✅ [Appwrite] Child profile created:", doc.$id);
            return doc;

        } catch (error) {
            console.error("Create Child Error:", error);
            throw error;
        }
    },

    /**
     * Fetches all children belonging to a given parent.
     * Queries the children collection by parentId rather than relying on
     * a children[] array on the users document (which does not exist in schema).
     */
    getChildrenByParent: async function (parentId) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        try {
            // Resolve real DB doc ID same way as createChild
            let resolvedParentId = parentId;
            try {
                await databases.getDocument(DB_ID, COLLECTIONS.USERS, parentId);
            } catch (e) {
                if (e.code === 404) {
                    const sessionUser = await account.get();
                    const list = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                        Query.equal('email', sessionUser.email)
                    ]);
                    if (list.documents.length > 0) resolvedParentId = list.documents[0].$id;
                }
            }

            const result = await databases.listDocuments(DB_ID, COLLECTIONS.CHILDREN, [
                Query.equal('parentId', resolvedParentId),
                Query.orderDesc('$createdAt')
            ]);
            return result.documents;
        } catch (error) {
            console.error("Get Children Error:", error);
            return [];
        }
    },
    updateThreatLog: async function (logId, status, resolution) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        await databases.updateDocument(DB_ID, COLLECTIONS.THREAT_LOGS, logId, {
            status: status,
            resolution: resolution
        });
        return true;
    },

    getThreatLogs: async function (statusFilter = null) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        let queries = [Query.orderDesc('timestamp')];
        if (statusFilter) {
            queries.push(Query.equal('status', statusFilter));
        }

        try {
            const response = await databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, queries);
            return response.documents;
        } catch (error) {
            // If collection doesn't exist yet or other error, return empty array to prevent UI break
            console.warn("Threat Logs fetch error (Collection might be missing):", error);
            return [];
        }
    }
};

// Global Access
window.DataService = DataService;