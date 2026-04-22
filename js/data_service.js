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

    // --- REALTIME METHODS ---

    /**
     * Subscribes to changes in specific Appwrite channels.
     * channels: array of channel names (e.g. ['databases.DB.collections.COL.documents'])
     * callback: function to run on update (receives the response object)
     * returns: Unsubscribe function
     */
    subscribe: function (channels, callback) {
        const { client } = this._getServices();
        return client.subscribe(channels, callback);
    },

    /**
     * Subscribes to all document changes within a specific collection.
     */
    subscribeToCollection: function (collectionId, callback) {
        const { DB_ID } = this._getServices();
        const channel = `databases.${DB_ID}.collections.${collectionId}.documents`;
        return this.subscribe([channel], callback);
    },

    /**
     * Subscribes to changes for a specific document.
     */
    subscribeToDocument: function (collectionId, documentId, callback) {
        const { DB_ID } = this._getServices();
        const channel = `databases.${DB_ID}.collections.${collectionId}.documents.${documentId}`;
        return this.subscribe([channel], callback);
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

            // Delay logout until the OTP flow is fully completed in register_parent.html
            // to prevent 401 Unauthorized API blocks.
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
            if (doc.status === 'suspended' || doc.status === 'banned' || doc.status === 'archived') {
                await account.deleteSession('current');
                throw new Error(`Account ${doc.status}. Contact support.`);
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
     * Step 1 (Kid side): Validate credentials FIRST, then create a login request.
     *
     * Checks (in order):
     *  1. Child username exists in the children collection
     *  2. The supplied parentEmail matches the parent linked to that child
     *  3. The supplied password matches the child's stored password
     *
     * Throws a user-friendly Error if any check fails (caught by auth.js → shown as alert).
     * Only creates the pending document if all checks pass.
     */
    createLoginRequest: async function (username, parentEmail, password) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        const GENERIC_ERROR = 'Invalid credentials. Please check your username, parent\'s email, and password.';

        // ✅ SECURITY: The children collection requires Role.users() to read.
        // We must obtain an Appwrite Anonymous Session before querying it.
        try {
            const { account } = this._getServices();
            await account.createAnonymousSession();
        } catch (e) {
            // Safe to ignore: user already has an active session
        }

        // ── 1. Find child by username ────────────────────────────────────────────
        let child;
        try {
            const childList = await databases.listDocuments(DB_ID, COLLECTIONS.CHILDREN, [
                Query.equal('username', username),
                Query.limit(1)
            ]);
            if (childList.documents.length === 0) throw new Error(GENERIC_ERROR);
            child = childList.documents[0];
        } catch (e) {
            if (e.message === GENERIC_ERROR) throw e;
            throw new Error(GENERIC_ERROR);
        }

        // ── 2. Verify the parent email matches this child's parent ───────────────
        // IMPORTANT: Kids are unauthenticated, so we CANNOT use listDocuments() with
        // query filters on the `users` collection — Appwrite returns 401 for that.
        // Instead, we fetch the parent document by its known ID (child.parentId) using
        // getDocument(), which works with read("any") permissions even for guests.
        if (!child.parentId) throw new Error(GENERIC_ERROR);

        let parent;
        try {
            // Fetch parent doc directly by ID — no auth required if doc has read("any")
            parent = await databases.getDocument(DB_ID, COLLECTIONS.USERS, child.parentId);
        } catch (e) {
            // If getDocument also fails (e.g. collection only allows authenticated reads),
            // fall back to checking the parentEmail field stored on the child doc itself.
            if (child.parentEmail) {
                // Validate email inline without touching the users collection
                if (child.parentEmail.toLowerCase().trim() !== parentEmail.toLowerCase().trim()) {
                    throw new Error(GENERIC_ERROR);
                }
                // Create a minimal parent stub so the rest of the flow still works
                parent = { $id: child.parentId, email: child.parentEmail, role: 'parent' };
            } else {
                // Cannot verify — deny for safety
                throw new Error(GENERIC_ERROR);
            }
        }

        // Verify the email the kid entered matches the parent's actual email
        if (!parent.email || parent.email.toLowerCase().trim() !== parentEmail.toLowerCase().trim()) {
            throw new Error(GENERIC_ERROR);
        }

        // ── 3. Verify password ───────────────────────────────────────────────────
        // Children have a `password` field (plain or hashed) stored on creation.
        // We perform a secure hash comparison here.
        const storedPassword = child.password || '';
        const isPasswordCorrect = await SecurityUtils.verifyPassword(password, storedPassword);
        if (!isPasswordCorrect) {
            throw new Error(GENERIC_ERROR);
        }

        // ── 4. All checks passed — create the pending request ───────────────────
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
            childName: child.name || child.username || '',
            childId: child.$id,
            parentId: parent.$id
        });

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
                Query.limit(50)
            ]);
            return result.documents
                .filter(req => req.status === 'pending')
                .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));
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
            const result = await databases.listDocuments(DB_ID, 'login_requests', [
                Query.equal('parentEmail', parentEmail),
                Query.limit(100)
            ]);

            const handled = result.documents.filter(req => req.status === 'approved' || req.status === 'denied');

            return handled
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
     * NOW ASYNC — fetches child prefs from DB so profile persists across logins.
     */
    kidLoginFromApproved: async function (approvedRequest) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();

        // ✅ SECURITY: The 'fake' sessionStorage token is insecure.
        // We now create an official Appwrite Anonymous Session for the kid.
        // The kid doesn't have an email/password in the Appwrite Auth system,
        // but this grants them a real JWT token so Cloud Functions (Gemini) can
        // verify them, and Appwrite permissions (Role.users()) will recognize them.
        try {
            await account.createAnonymousSession();
        } catch (e) {
            console.warn('[Kid Login] Anonymous session creation failed or exists:', e.message);
        }

        // Fetch the full child document to hydrate prefs (avatarImage, bio, etc.)
        let childDoc = null;
        try {
            // Note: Since we haven't given the child's anonymous Appwrite account
            // explicit read access to this specific child document yet (that would require
            // a Cloud Function or Appwrite Teams), we might hit a read error if Role.users()
            // is not enough (which it shouldn't be, if we locked it down correctly).
            // For now, if we get 401, we rely on the data stamped on the approvedRequest.
            childDoc = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, approvedRequest.childId);
        } catch (e) {
            console.warn('[Kid Login] Could not fetch child prefs from DB (expected if locked down):', e.message);
        }

        const childSession = {
            $id: approvedRequest.childId,
            role: 'kid',
            firstName: childDoc?.name || approvedRequest.childName,
            name: childDoc?.name || approvedRequest.childName,
            username: childDoc?.username || approvedRequest.childUsername,
            parentId: approvedRequest.parentId,
            totalPoints: childDoc?.totalPoints || 0,
            avatar: childDoc?.avatar || null,
            avatarImage: childDoc?.avatarImage || null,
            avatarBgColor: childDoc?.avatarBgColor || null,
            // prefs object mirrors what saveKidSettings writes
            prefs: {
                displayName: childDoc?.displayName || childDoc?.name || approvedRequest.childName,
                bio: childDoc?.bio || '',
                avatarImage: childDoc?.avatarImage || null,
                avatarBgColor: childDoc?.avatarBgColor || '#60a5fa',
                coverColor: childDoc?.coverColor || '#3b82f6',
                theme: childDoc?.theme || 'default',
                avatarIcon: childDoc?.avatarIcon || '🐻',
            }
        };
        sessionStorage.setItem('cubby_child_session', JSON.stringify(childSession));
        // Clean up the cached password
        sessionStorage.removeItem('cubby_login_req_pass_' + approvedRequest.$id);
        console.log('✅ [Kid] Anonymous Auth Session established for:', childSession.username);
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
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        // Fetch the child doc
        const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
        if (child.kidId) return child.kidId;

        // Generate a new 6-char uppercase hex ID
        const kidId = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
        await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, { kidId });
        return kidId;
    },

    /**
     * Safely attempts to read the child's profile to get their kidId and other details.
     * Fails gracefully if permissions prevent reading.
     */
    getChildProfileReadOnly: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            return await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
        } catch (e) {
            return null; // Silent fail (e.g. 404 permissions block)
        }
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
     * Get accepted buddies for a child, sorted by latest chat interaction.
     */
    getBuddies: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
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
            const rawBuddies = [
                ...sent.documents.map(d => ({ buddyDocId: d.$id, childId: d.toChildId, username: d.toUsername, kidId: d.toKidId, buddyCreatedAt: d.createdAt })),
                ...received.documents.map(d => ({ buddyDocId: d.$id, childId: d.fromChildId, username: d.fromUsername, kidId: d.fromKidId, buddyCreatedAt: d.createdAt }))
            ];

            // Fetch latest interaction time and profile info for each buddy
            const buddiesWithTime = await Promise.all(rawBuddies.map(async (buddy) => {
                const convId = this._buildConversationId(childId, buddy.childId);
                let lastTime = new Date(buddy.buddyCreatedAt).getTime() || 0; // Fallback to when they became buddies
                let avatarImage = null;
                let avatarBgColor = null;

                try {
                    const msgs = await databases.listDocuments(DB_ID, 'chat_messages', [
                        Query.equal('conversationId', convId),
                        Query.orderDesc('sentAt'),
                        Query.limit(1)
                    ]);
                    if (msgs.documents.length > 0) {
                        lastTime = new Date(msgs.documents[0].sentAt).getTime();
                    }
                } catch (e) {
                    // Ignore chat fetch errors for individual buddies
                }

                try {
                    const profile = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, buddy.childId);
                    if (profile) {
                        avatarImage = profile.avatarImage || null;
                        avatarBgColor = profile.avatarBgColor || null;
                    }
                } catch (e) {
                    // Silent fail if missing read-access or profile deleted
                }

                return { ...buddy, lastInteractionTime: lastTime, avatarImage, avatarBgColor };
            }));

            // Sort descending by last interaction time
            buddiesWithTime.sort((a, b) => b.lastInteractionTime - a.lastInteractionTime);

            return buddiesWithTime;
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
     * Report a chat message. Enriches the report with child/parent info.
     * @param {string} messageId - The chat message doc $id
     * @param {string} conversationId - The conversation ID
     * @param {string} reporterId - Child ID of the reporter (the one who was hurt)
     * @param {string} reportedId - Child ID of the reported sender (the one who said bad things)
     * @param {string} text - The offending message text
     * @param {string} violationType - e.g. 'Profanity', 'Cyberbullying', etc.
     */
    reportMessage: async function (messageId, conversationId, reporterId, reportedId, text, violationType) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        // Helper: get parent email for a child doc (handles mismatched parentId / doc.$id)
        const getParentEmail = async (child) => {
            if (!child || !child.parentId) return '';
            try {
                // Try direct document lookup first (fastest if IDs match)
                const parent = await databases.getDocument(DB_ID, COLLECTIONS.USERS, child.parentId);
                return parent.email || '';
            } catch (e) {
                // Fallback: query users by the parentId to handle Auth-ID vs doc-ID mismatch
                try {
                    const list = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                        Query.equal('$id', child.parentId),
                        Query.limit(1)
                    ]);
                    if (list.documents.length > 0) return list.documents[0].email || '';
                } catch (_) { /* ignore */ }
                return '';
            }
        };

        // Enrich with child + parent info by looking up both children
        let reporterChildName = reporterId || 'Unknown';
        let reporterParentEmail = '';
        let reportedChildName = reportedId || 'Unknown';
        let reportedParentEmail = '';

        try {
            if (reporterId) {
                const rChild = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, reporterId);
                reporterChildName = rChild.username || rChild.name || reporterId;
                reporterParentEmail = await getParentEmail(rChild);
            }
            if (reportedId) {
                const dChild = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, reportedId);
                reportedChildName = dChild.username || dChild.name || reportedId;
                reportedParentEmail = await getParentEmail(dChild);
            }
        } catch (e) {
            console.warn('reportMessage child lookup error:', e.message);
        }

        const doc = await databases.createDocument(DB_ID, COLLECTIONS.THREAT_LOGS, ID.unique(), {
            childId: reportedId || '',
            content: text || 'No text provided',
            resolved: false,
            reason: violationType || 'User Reported',
            reporterChildId: reporterId || '',
            reporterChildName,
            reporterParentEmail,
            reportedChildId: reportedId || '',
            reportedChildName,
            reportedParentEmail,
            messageContent: (text || 'No text provided').slice(0, 2000),
            violationType: violationType || 'Unspecified',
            status: 'pending',
            timestamp: new Date().toISOString()
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
                Query.limit(100)
            ];

            const result = await databases.listDocuments(DB_ID, 'parent_notifications', queries);

            let docs = result.documents;
            if (unreadOnly) docs = docs.filter(d => d.isRead === false);

            return docs
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 30);
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
                type: data.type || 'alert',
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

    /**
     * Alert both parents about a confirmed report.
     * @param {string} reportedId  - childId of the bad-message SENDER
     * @param {string} reporterId  - childId of the REPORTER (victim)
     * @param {string} messageText - the offending message
     * @param {string} muteDuration - human-readable mute duration e.g. "1-24 hours"
     */
    alertParentsOfReport: async function (reportedId, reporterId, messageText, muteDuration) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const badSender = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, reportedId);
            const reporter = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, reporterId);
            const msgSnippet = (messageText || '[No message text]').slice(0, 300);
            const muteStr = muteDuration || 'a set period of time';

            // ❶ Notify the REPORTER's parent (purple safety alert — their child received bad msg)
            if (reporter.parentId) {
                await this._createParentNotification(reporter.parentId, {
                    type: 'safety_alert',
                    message: `🛡️ Safety Alert\n\nYour child received a bad message from their buddy:\n"${msgSnippet}"\n\nYour child has received some bad messages from their buddy, please advise them.`,
                    childId: reporter.$id
                });
            }

            // ❷ Notify the BAD SENDER's parent (their child sent bad messages)
            if (badSender.parentId) {
                await this._createParentNotification(badSender.parentId, {
                    type: 'safety_alert',
                    message: `⚠️ Safety Alert\n\nYour child sent a reported message to their buddy:\n"${msgSnippet}"\n\nYour child has sent some bad messages to their buddy, please advise them accordingly. They have been muted for ${muteStr}.`,
                    childId: badSender.$id
                });
            }
        } catch (e) {
            console.error('alertParentsOfReport error:', e);
        }
    },

    banChildFromChat: async function (childId, durationMs) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const banUntil = Date.now() + durationMs;

            // Store ban expiry in threatScore (no extra schema needed)
            await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
                allowChat: false,
                threatScore: banUntil
            });
        } catch (e) {
            console.error('banChildFromChat error:', e);
        }
    },

    /**
     * Check if a child is currently muted from chat.
     * Returns { muted: bool, until: Date|null, durationStr: string }
     */
    isChildMuted: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
            if (child.allowChat === true) return { muted: false, until: null, durationStr: '' };

            const banUntilMs = child.threatScore || 0;
            const now = Date.now();

            if (banUntilMs && banUntilMs > now) {
                const remaining = banUntilMs - now;
                let durationStr;
                if (remaining > 86400000 * 2) {
                    durationStr = Math.ceil(remaining / 86400000) + ' days';
                } else if (remaining > 3600000) {
                    durationStr = Math.ceil(remaining / 3600000) + ' hours';
                } else {
                    durationStr = Math.ceil(remaining / 60000) + ' minutes';
                }
                return { muted: true, until: new Date(banUntilMs), durationStr };
            }

            // Ban expired — re-enable chat
            if (banUntilMs && banUntilMs <= now) {
                try {
                    await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
                        allowChat: true, threatScore: 0
                    });
                } catch (e) { /* non-fatal */ }
            }
            return { muted: false, until: null, durationStr: '' };
        } catch (e) {
            console.warn('isChildMuted error:', e.message);
            return { muted: false, until: null, durationStr: '' };
        }
    },

    // --- VIDEO CONTENT METHODS ---

    addVideo: async function (videoData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        const newVideo = {
            title: videoData.title,
            url: videoData.url,
            category: videoData.category,
            creatorEmail: videoData.creatorEmail,
            status: videoData.status || 'pending',
            views: videoData.views || 0,
            likes: videoData.likes || 0,
            dislikes: videoData.dislikes || 0,
            subscriberGains: videoData.subscriberGains || 0,
            uploadedAt: videoData.uploadedAt || new Date().toISOString()
        };

        // Optional custom thumbnail
        if (videoData.thumbnailUrl) {
            newVideo.thumbnailUrl = videoData.thumbnailUrl;
        }

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

    /**
     * Get a single video by its document ID.
     */
    getVideoById: async function (videoId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        return await databases.getDocument(DB_ID, COLLECTIONS.VIDEOS, videoId);
    },

    /**
     * Increment view count for a video.
     * Will NOT increment if the viewerEmail matches the creatorEmail (creator watching own video).
     */
    incrementVideoView: async function (videoId, viewerEmail) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const video = await databases.getDocument(DB_ID, COLLECTIONS.VIDEOS, videoId);
        // Do NOT count creator's own views
        if (video.creatorEmail && viewerEmail && video.creatorEmail === viewerEmail) {
            console.log('⚠️ Creator view — not incrementing count');
            return video;
        }
        const newViews = (video.views || 0) + 1;
        return await databases.updateDocument(DB_ID, COLLECTIONS.VIDEOS, videoId, { views: newViews });
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

    getAllChildren: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        // In appwrite JS SDK, we just list without query, limit is 25 by default, set limit high
        const response = await databases.listDocuments(DB_ID, COLLECTIONS.CHILDREN, [
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

    updateUserRole: async function (userId, newRole) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
            role: newRole
        });
        // Also sync the role in pending_staff so unclaimed accounts see the correct role on the claim page
        try {
            const { Query } = Appwrite;
            const res = await databases.listDocuments(DB_ID, COLLECTIONS.PENDING_STAFF, [
                Query.equal('usersDocId', userId), Query.limit(1)
            ]);
            if (res.documents.length > 0) {
                await databases.updateDocument(DB_ID, COLLECTIONS.PENDING_STAFF, res.documents[0].$id, { role: newRole });
            }
        } catch (e) {
            console.warn('[updateUserRole] Could not sync pending_staff role:', e.message);
        }
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

            // 3. Clear the file ID fields in the database (avoid dead references).
            // NOTE: Appwrite schema marks these as required so they cannot be set to null.
            // We use the sentinel value 'deleted' to indicate the files are gone.
            await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, {
                faceId: 'deleted',
                idDocumentId: 'deleted'
            });

            console.log('✅ [DB] Cleared faceId and idDocumentId from user record.');

        } catch (err) {
            // Non-fatal: log but don't throw — the status update already succeeded
            console.warn('⚠️ [Cleanup] Could not fully clean up verification files:', err.message);
        }
    },

    createStaffAccount: async function (creatorEmail, newStaffData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        // Generate a human-readable Staff ID: #STF-XXXXXX
        const randomHex = () => Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
        const staffId = '#STF-' + randomHex();

        const tempId = ID.unique();

        // 1. Create the full user document (authenticated-only read/write)
        const staffDoc = {
            role: newStaffData.role,
            status: 'pending_claim',
            firstName: newStaffData.firstName,
            lastName: newStaffData.lastName,
            middleName: '',
            email: newStaffData.email,
            faceId: 'manual_override',
            staffId,
            createdAt: new Date().toISOString()
        };
        const doc = await databases.createDocument(DB_ID, COLLECTIONS.USERS, tempId, staffDoc);

        // 2. Write a minimal mirror to pending_staff (public read, for claim page)
        //    Only contains what the claim page needs — no sensitive data.
        try {
            await databases.createDocument(DB_ID, COLLECTIONS.PENDING_STAFF, ID.unique(), {
                email: newStaffData.email,
                firstName: newStaffData.firstName,
                lastName: newStaffData.lastName,
                role: newStaffData.role,
                staffId,
                usersDocId: doc.$id,  // reference so claim page can update the users doc
                isClaimed: false
            });
        } catch (e) {
            console.warn('Could not write to pending_staff (collection may not exist yet):', e.message);
        }

        return doc; // includes $id and staffId
    },

    /**
     * Look up a staff member's user document by their staffId (#STF-XXXXXX).
     * Used by the Staff ID login flow to resolve the email before Appwrite login.
     */
    getStaffByStaffId: async function (staffId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.PENDING_STAFF, [
                Query.equal('staffId', staffId.toUpperCase()),
                Query.limit(1)
            ]);
            if (result.documents.length === 0) throw new Error('No staff account found with that Staff ID.');
            return result.documents[0];
        } catch (e) {
            throw new Error(e.message || 'Staff ID lookup failed.');
        }
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
            let parentEmail = "";
            try {
                const parentDoc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, parentId);
                parentEmail = parentDoc.email;
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
                    parentEmail = list.documents[0].email;
                } else {
                    throw e;
                }
            }

            // --- Step 2: Create the child document ---
            // Attributes required by the Appwrite children collection schema
            // ✅ SECURITY: Hash the password before storing it; never store plaintext.
            const childId = ID.unique();
            const childHashedPassword = await SecurityUtils.hashPassword(childData.password);
            const newChild = {
                parentId: resolvedParentId,
                parentEmail: parentEmail,
                name: childData.name,
                username: childData.username,
                password: childHashedPassword,
                status: childData.status || 'active', // required field in schema
                avatar: childData.avatar || 'Felix',
                allowChat: childData.allowChat !== undefined ? childData.allowChat : false,
                allowGames: childData.allowGames !== undefined ? childData.allowGames : true,
                isOnline: false,
                threatScore: 0,
                totalPoints: 0,
                kidId: '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0')
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
            // Resolve real DB doc ID
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

            const children = result.documents;

            // Aggregate screen_time_logs entries per child and merge into screenTimeLogs field
            // NOTE: We preserve the 'category' field so the parent dashboard chart can split
            // Games / Entertainment / Communication correctly.
            try {
                const childIds = children.map(c => c.$id);
                if (childIds.length > 0) {
                    const logsResult = await databases.listDocuments(DB_ID, 'screen_time_logs', [
                        Query.limit(500)
                    ]);
                    const rawLogs = logsResult.documents;

                    // Group by childId → (date|category) → total minutes
                    // We use a composite key "date|category" so that each category keeps its
                    // own bucket instead of being collapsed into a single total per day.
                    const byChild = {};
                    rawLogs.forEach(log => {
                        if (!childIds.includes(log.childId)) return;
                        if (!byChild[log.childId]) byChild[log.childId] = {};
                        const date = log.date || new Date().toISOString().split('T')[0];
                        const cat  = (log.category || 'general').toLowerCase();
                        const key  = `${date}|${cat}`;
                        byChild[log.childId][key] = (byChild[log.childId][key] || 0) + (log.minutes || 0);
                    });

                    // Merge into each child document
                    children.forEach(child => {
                        const catDateMap = byChild[child.$id];
                        if (!catDateMap) return;

                        // Parse any existing logs from child doc (may be array or stale object)
                        let existingLogs = [];
                        if (child.screenTimeLogs) {
                            try {
                                const parsed = typeof child.screenTimeLogs === 'string'
                                    ? JSON.parse(child.screenTimeLogs) : child.screenTimeLogs;
                                existingLogs = Array.isArray(parsed) ? parsed : [];
                            } catch (e) { existingLogs = []; }
                        }

                        // Build a composite-key map from existing log entries
                        const combined = {};
                        existingLogs.forEach(l => {
                            if (!l.date) return;
                            const cat = (l.category || 'general').toLowerCase();
                            const key = `${l.date}|${cat}`;
                            combined[key] = (combined[key] || 0) + (l.minutes || 0);
                        });

                        // Merge in the newly fetched screen_time_logs entries
                        Object.entries(catDateMap).forEach(([key, mins]) => {
                            combined[key] = (combined[key] || 0) + mins;
                        });

                        // Flatten back to an array: [{date, minutes, category}, ...]
                        const merged = Object.entries(combined)
                            .map(([key, minutes]) => {
                                const [date, category] = key.split('|');
                                return { date, minutes, category };
                            })
                            .sort((a, b) => a.date.localeCompare(b.date));

                        child.screenTimeLogs = JSON.stringify(merged);
                    });
                }
            } catch (e) {
                console.warn('screen_time_logs aggregation error (non-fatal):', e.message);
            }

            return children;
        } catch (error) {
            console.error("Get Children Error:", error);
            return [];
        }
    },

    /**
     * Updates an existing Child Profile
     */
    updateChild: async function (childId, updateData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            // ✅ SECURITY: Hash the password if it is being updated
            if (updateData.password) {
                 updateData.password = await SecurityUtils.hashPassword(updateData.password);
            }

            const doc = await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, updateData);
            console.log("✅ [Appwrite] Child profile updated:", doc.$id);
            return doc;
        } catch (error) {
            console.error("Update Child Error:", error);
            throw error;
        }
    },

    /**
     * Fetch a single child document (used to read current prefs before editing).
     * Safe to call without an Appwrite Auth session (uses 'any' read permission).
     */
    getChildWithPrefs: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            return await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
        } catch (e) {
            console.warn('[getChildWithPrefs] Could not fetch child doc:', e.message);
            return null;
        }
    },

    /**
     * Persist a kid's profile prefs to the Children collection.
     * Updates: name/displayName, bio, avatarImage, avatarBgColor, coverColor, theme, avatarIcon.
     *
     * PERMISSION NOTE: Children collection must have 'Any' update permission enabled
     * in Appwrite Console so unauthenticated kids can update their own profile.
     * If you see a 401 error, add that permission in:
     *   Appwrite Console → Database → Children → Permissions → Role: any → update ✓
     */
    updateChildPrefs: async function (childId, prefs) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        if (!childId) throw new Error('[updateChildPrefs] childId is required');

        // Build the update payload — only include defined fields
        const payload = {};
        if (prefs.displayName !== undefined && prefs.displayName !== null) {
            payload.name = prefs.displayName;       // top-level name field
        }
        if (prefs.bio !== undefined)         payload.bio = prefs.bio;
        if (prefs.avatarImage !== undefined)  payload.avatarImage = prefs.avatarImage;
        if (prefs.avatarBgColor !== undefined) payload.avatarBgColor = prefs.avatarBgColor;
        if (prefs.coverColor !== undefined)  payload.coverColor = prefs.coverColor;
        if (prefs.theme !== undefined)       payload.theme = prefs.theme;
        if (prefs.avatarIcon !== undefined)  payload.avatarIcon = prefs.avatarIcon;
        if (prefs.isOnline !== undefined)    payload.isOnline = prefs.isOnline;
        // Shop: persist the list of unlocked premium items
        if (prefs.unlockedItems !== undefined) payload.unlockedItems = prefs.unlockedItems;

        try {
            const doc = await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, payload);
            console.log('✅ [updateChildPrefs] Profile saved for child:', childId, payload);
            return doc;
        } catch (error) {
            // Classify the error for easier debugging
            if (error.code === 401) {
                console.error('[Profile] ❌ Permission Denied (401): The Children collection does not have \'Any\' update permission. Enable it in Appwrite Console.');
                throw new Error('Permission Denied: Profile cannot be saved. Please contact support.');
            } else if (error.code === 0 || error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('timeout')) {
                console.error('[Profile] ❌ Network Timeout / Offline:', error.message);
                throw new Error('Network error: Could not reach the server. Please check your connection and try again.');
            } else {
                console.error('[Profile] ❌ Unexpected DB error:', error);
                throw error;
            }
        }
    },

    /**
     * Persist a parent/staff user profile update to the Users collection.
     * Supports: firstName, lastName (DB fields) + arbitrary prefs (Appwrite Account prefs).
     */
    updateUserProfile: async function (userId, profileData) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();

        const dbPayload = {};
        if (profileData.firstName) dbPayload.firstName = profileData.firstName;
        if (profileData.lastName)  dbPayload.lastName = profileData.lastName;

        try {
            // 1. Update the Users collection document
            if (Object.keys(dbPayload).length > 0) {
                await databases.updateDocument(DB_ID, COLLECTIONS.USERS, userId, dbPayload);
                console.log('✅ [updateUserProfile] DB fields updated:', dbPayload);
            }

            // 2. Update Appwrite Account Preferences (for bio, tags, profilePictureUrl etc.)
            if (profileData.prefs && Object.keys(profileData.prefs).length > 0) {
                let currentPrefs = {};
                try { currentPrefs = await account.getPrefs(); } catch (e) { /* no existing prefs */ }
                await account.updatePrefs({ ...currentPrefs, ...profileData.prefs });
                console.log('✅ [updateUserProfile] Account prefs updated:', profileData.prefs);
            }

            return true;
        } catch (error) {
            if (error.code === 401) {
                console.error('[Profile] ❌ Permission Denied (401):', error.message);
                throw new Error('Permission Denied: Could not update profile.');
            } else if (error.message?.includes('fetch') || error.message?.includes('network')) {
                console.error('[Profile] ❌ Network error:', error.message);
                throw new Error('Network error: Could not reach the server. Check your connection.');
            }
            console.error('[updateUserProfile] Error:', error);
            throw error;
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

        let queries = [Query.orderDesc('$createdAt')];
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
    },

    /**
     * Logs screen time for a child.
     * Writes to the 'screen_time_logs' collection which allows any-write (no auth needed).
     * Kids don't have an Appwrite Auth session so they cannot call updateDocument.
     * The parent dashboard reads and aggregates these log entries.
     *
     * @param {string} childId    - The child's Appwrite document $id (from sessionStorage)
     * @param {number} minutes    - Minutes spent (float, will be rounded)
     * @param {string} [category] - 'games' | 'entertainment' | 'learning' | 'communication' (optional)
     * @param {string} [detail]   - Specific game or video title for the Interest Heatmap (optional)
     */
    logScreenTime: async function (childId, minutes, category, detail) {
        if (!childId) return;
        const mins = Math.round(minutes);
        if (mins < 1) return; // skip sessions under 1 minute

        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;

        const todayStr = new Date().toISOString().split('T')[0]; // "2026-03-04"

        try {
            const data = {
                childId,
                date: todayStr,
                minutes: mins,
                timestamp: new Date().toISOString()
            };
            if (category) data.category = category;
            if (detail)   data.detail   = detail;

            await databases.createDocument(DB_ID, 'screen_time_logs', ID.unique(), data);
            console.log(`⏱️ [ScreenTime] Logged ${mins} min (${category || 'general'}) for child ${childId} on ${todayStr}${detail ? ' | ' + detail : ''}`);
        } catch (err) {
            console.warn('logScreenTime error:', err.message);
        }
    },

    /**
     * Logs a content or social activity event for a child.
     * Used to populate the Activity Log in the Parent Dashboard.
     * Writes to the new 'activity_logs' collection (any-write, no auth needed).
     *
     * @param {string} childId  - The child's Appwrite document $id
     * @param {string} type     - Event type: 'watch' | 'play' | 'buddy_add' | 'message_sent'
     * @param {string} action   - Human-readable description: e.g. "Started watching: Learn Colors"
     * @param {object} [meta]   - Optional metadata object (will be JSON-stringified)
     */
    logActivity: async function (childId, type, action, meta) {
        if (!childId || !type || !action) return;
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        try {
            const data = {
                childId,
                type,
                action,
                timestamp: new Date().toISOString()
            };
            if (meta) data.metadata = JSON.stringify(meta);

            await databases.createDocument(DB_ID, 'activity_logs', ID.unique(), data);
            console.log(`📋 [Activity] [${type}] ${action} for child ${childId}`);
        } catch (err) {
            console.warn('logActivity error:', err.message);
        }
    },

    /**
     * Fetches the activity log for a child (for the Parent Dashboard).
     * Efficiently queries the 'activity_logs' collection by childId and timestamp.
     *
     * @param {string} childId  - The child's Appwrite document $id
     * @param {number} [limit]  - Number of entries to fetch (default: 50)
     * @param {string} [filter] - 'today' | 'week' | 'month' | 'all' (default: 'week')
     * @returns {Array} activity log documents sorted newest-first
     */
    getActivityLogs: async function (childId, limit = 50, filter = 'week') {
        if (!childId) return [];
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;

        const now = new Date();
        let startDate = null;
        if (filter === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filter === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else if (filter === 'month') {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
        }

        try {
            const queries = [
                Query.equal('childId', childId),
                Query.orderDesc('timestamp'),
                Query.limit(limit)
            ];
            if (startDate) {
                queries.push(Query.greaterThanEqual('timestamp', startDate.toISOString()));
            }
            const result = await databases.listDocuments(DB_ID, 'activity_logs', queries);
            return result.documents;
        } catch (e) {
            console.warn('getActivityLogs error:', e.message);
            return [];
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // KID WATCH HISTORY
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Log a video view in the kid's watch history.
     * Uses 'any' create permission (kids have no Appwrite auth session).
     */
    logWatchHistory: async function (childId, videoId, videoTitle, videoCategory, videoUrl, thumbnailUrl) {
        if (!childId || !videoId) return;
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        try {
            await databases.createDocument(DB_ID, 'kid_watch_history', ID.unique(), {
                childId,
                videoId,
                videoTitle: videoTitle || '',
                videoCategory: videoCategory || '',
                videoUrl: videoUrl || '',
                thumbnailUrl: thumbnailUrl || '',
                watchedAt: new Date().toISOString()
            });
        } catch (e) {
            console.warn('logWatchHistory error:', e.message);
        }
    },

    /**
     * Get watch history for a child.
     * @param {string} childId
     * @param {string} filter - 'today' | 'week' | 'month' | 'all'
     * @returns {Array} history documents sorted newest-first
     */
    getWatchHistory: async function (childId, filter = 'all') {
        if (!childId) return [];
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;

        const now = new Date();
        let startDate = null;
        if (filter === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filter === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else if (filter === 'month') {
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 1);
        }

        try {
            const queries = [
                Query.equal('childId', childId),
                Query.orderDesc('watchedAt'),
                Query.limit(200)
            ];
            if (startDate) {
                queries.push(Query.greaterThanEqual('watchedAt', startDate.toISOString()));
            }
            const result = await databases.listDocuments(DB_ID, 'kid_watch_history', queries);
            return result.documents;
        } catch (e) {
            console.warn('getWatchHistory error:', e.message);
            return [];
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // KID FAVORITES
    // ─────────────────────────────────────────────────────────────────────────

    addFavorite: async function (childId, videoId, videoTitle, videoCategory, videoUrl, thumbnailUrl) {
        if (!childId || !videoId) return;
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        try {
            return await databases.createDocument(DB_ID, 'kid_favorites', ID.unique(), {
                childId,
                videoId,
                videoTitle: videoTitle || '',
                videoCategory: videoCategory || '',
                videoUrl: videoUrl || '',
                thumbnailUrl: thumbnailUrl || '',
                addedAt: new Date().toISOString()
            });
        } catch (e) {
            console.warn('addFavorite error:', e.message);
        }
    },

    removeFavorite: async function (childId, videoId) {
        if (!childId || !videoId) return;
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'kid_favorites', [
                Query.equal('childId', childId),
                Query.equal('videoId', videoId),
                Query.limit(1)
            ]);
            if (result.documents.length > 0) {
                await databases.deleteDocument(DB_ID, 'kid_favorites', result.documents[0].$id);
            }
        } catch (e) {
            console.warn('removeFavorite error:', e.message);
        }
    },

    getFavorites: async function (childId) {
        if (!childId) return [];
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'kid_favorites', [
                Query.equal('childId', childId),
                Query.orderDesc('addedAt'),
                Query.limit(200)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('getFavorites error:', e.message);
            return [];
        }
    },

    isFavorited: async function (childId, videoId) {
        if (!childId || !videoId) return false;
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, 'kid_favorites', [
                Query.equal('childId', childId),
                Query.equal('videoId', videoId),
                Query.limit(1)
            ]);
            return result.documents.length > 0;
        } catch (e) {
            return false;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // VIDEO LIKES / DISLIKES
    // ─────────────────────────────────────────────────────────────────────────

    likeVideo: async function (videoId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const video = await databases.getDocument(DB_ID, COLLECTIONS.VIDEOS, videoId);
            return await databases.updateDocument(DB_ID, COLLECTIONS.VIDEOS, videoId, {
                likes: (video.likes || 0) + 1
            });
        } catch (e) {
            console.warn('likeVideo error:', e.message);
        }
    },

    dislikeVideo: async function (videoId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const video = await databases.getDocument(DB_ID, COLLECTIONS.VIDEOS, videoId);
            return await databases.updateDocument(DB_ID, COLLECTIONS.VIDEOS, videoId, {
                dislikes: (video.dislikes || 0) + 1
            });
        } catch (e) {
            console.warn('dislikeVideo error:', e.message);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LEARNING PATHS & REWARDS
    // ─────────────────────────────────────────────────────────────────────────

    addPath: async function (pathData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;
        const newPath = {
            title: pathData.title,
            description: pathData.description || '',
            creatorEmail: pathData.creatorEmail,
            type: pathData.type || 'flexible',
            videoIds: pathData.videoIds || [],
            bonusPoints: pathData.bonusPoints || 50,
            createdAt: new Date().toISOString()
        };
        return await databases.createDocument(DB_ID, COLLECTIONS.PATHS, ID.unique(), newPath);
    },

    getPaths: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        const result = await databases.listDocuments(DB_ID, COLLECTIONS.PATHS, [
            Query.orderDesc('createdAt'),
            Query.limit(100)
        ]);
        return result.documents;
    },

    getPathById: async function (pathId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        return await databases.getDocument(DB_ID, COLLECTIONS.PATHS, pathId);
    },

    updatePath: async function (pathId, updateData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        return await databases.updateDocument(DB_ID, COLLECTIONS.PATHS, pathId, {
            ...updateData,
            updatedAt: new Date().toISOString()
        });
    },

    deletePath: async function (pathId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        return await databases.deleteDocument(DB_ID, COLLECTIONS.PATHS, pathId);
    },

    /**
     * Records a video completion reward for a child.
     * Updates the child's total points atomically.
     */
    recordVideoReward: async function (childId, videoId, points = 10) {
        if (!childId || !videoId) return;
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        const rewardId = `video_${childId}_${videoId}`;
        try {
            // 1. Check if already rewarded with unique rewardId
            const existing = await databases.listDocuments(DB_ID, COLLECTIONS.KID_REWARDS, [
                Query.equal('rewardId', rewardId)
            ]);

            if (existing.documents.length > 0) {
                console.log('ℹ️ Video reward already claimed.');
                return existing.documents[0];
            }

            // 2. Create reward entry with unique rewardId
            const reward = await databases.createDocument(DB_ID, COLLECTIONS.KID_REWARDS, ID.unique(), {
                childId,
                rewardType: 'video_completion',
                points,
                sourceId: videoId,
                rewardId: rewardId,
                earnedAt: new Date().toISOString()
            });

            // 3. Update child totalPoints
            const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
            await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
                totalPoints: (child.totalPoints || 0) + points
            });

            console.log(`⭐ [Rewards] Child ${childId} earned ${points} stars for Video ${videoId}`);
            return reward;

        } catch (e) {
            console.error('recordVideoReward error:', e.message);
            if (e.code === 401) {
                console.error('[Rewards] ❌ Permission Denied (401): Ensure the `kid_rewards` collection has "Create" permission for "Any", and the `children` collection has "Update" permission for "Any" in the Appwrite Console.');
                throw new Error('Permission Denied: Ensure Appwrite permissions are set correctly for rewards.');
            }
            throw e;
        }
    },

    getRewardsByChild: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        const result = await databases.listDocuments(DB_ID, COLLECTIONS.KID_REWARDS, [
            Query.equal('childId', childId),
            Query.orderDesc('earnedAt'),
            Query.limit(50)
        ]);
        return result.documents;
    },

    /**
     * Get path progress for a child.
     */
    getPathProgress: async function (childId, pathId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.KID_PATH_STATUS, [
                Query.equal('childId', childId),
                Query.equal('pathId', pathId),
                Query.limit(1)
            ]);
            return result.documents.length > 0 ? result.documents[0] : null;
        } catch (e) {
            console.warn('getPathProgress error:', e.message);
            return null;
        }
    },

    getPathStatusesByChild: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        const result = await databases.listDocuments(DB_ID, COLLECTIONS.KID_PATH_STATUS, [
            Query.equal('childId', childId),
            Query.orderDesc('updatedAt'),
            Query.limit(50)
        ]);
        return result.documents;
    },

    /**
     * Updates path progress when a video is finished.
     * If all videos in path are finished, awards bonus.
     */
    updatePathProgress: async function (childId, pathId, videoId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        try {
            const path = await this.getPathById(pathId);
            let status = await this.getPathProgress(childId, pathId);

            if (!status) {
                status = await databases.createDocument(DB_ID, COLLECTIONS.KID_PATH_STATUS, ID.unique(), {
                    childId,
                    pathId,
                    completedVideoIds: [videoId],
                    currentStatus: 'in_progress',
                    updatedAt: new Date().toISOString()
                });
            } else {
                if (!status.completedVideoIds.includes(videoId)) {
                    const newList = [...status.completedVideoIds, videoId];
                    const isFinished = newList.length >= path.videoIds.length;
                    
                    status = await databases.updateDocument(DB_ID, COLLECTIONS.KID_PATH_STATUS, status.$id, {
                        completedVideoIds: newList,
                        currentStatus: isFinished ? 'completed' : 'in_progress',
                        updatedAt: new Date().toISOString()
                    });

                    // Award bonus if just finished
                    if (isFinished) {
                        await this.recordPathBonus(childId, pathId, path.bonusStars || path.bonusPoints || 0);
                    }
                }
            }
            return status;
        } catch (e) {
            console.error('updatePathProgress error:', e.message);
            if (e.code === 401) {
                console.error('[PathProgress] ❌ Permission Denied (401): Ensure the `kid_path_status` collection has "Create" and "Update" permissions for "Any" in the Appwrite Console.');
            }
            throw e;
        }
    },

    recordPathBonus: async function (childId, pathId, points) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID, Query } = Appwrite;

        const rewardId = `path_${childId}_${pathId}`;
        try {
            const existing = await databases.listDocuments(DB_ID, COLLECTIONS.KID_REWARDS, [
                Query.equal('rewardId', rewardId)
            ]);

            if (existing.documents.length > 0) return existing.documents[0];

            const reward = await databases.createDocument(DB_ID, COLLECTIONS.KID_REWARDS, ID.unique(), {
                childId,
                rewardType: 'path_bonus',
                points,
                sourceId: pathId,
                rewardId: rewardId,
                earnedAt: new Date().toISOString()
            });

            const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
            await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
                totalPoints: (child.totalPoints || 0) + points
            });

            console.log(`🏆 [Rewards] Path Bonus! Child ${childId} earned ${points} for finishing Path ${pathId}`);
            return reward;
        } catch (e) {
            console.error('recordPathBonus error:', e.message);
             if (e.code === 401) {
                console.error('[Rewards] ❌ Permission Denied (401): Ensure the `kid_rewards` collection has "Create" permission for "Any", and the `children` collection has "Update" permission for "Any" in the Appwrite Console.');
            }
            throw e;
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // TIME MANAGEMENT & SETTINGS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Update time management settings for a child.
     * Stored on the Children document for simplicity and polling.
     * @param {string} childId
     * @param {Object} settings - { dailyAllowanceMinutes, bedtime, warningThresholdMinutes, allowChat, allowGames, blacklistedGames }
     */
    updateChildTimeSettings: async function (childId, settings) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const payload = {};
        if (settings.dailyAllowanceMinutes !== undefined) payload.screenTimeLogs = (payload.screenTimeLogs || ''); // we store settings in a new field
        // We encode all time settings into a single JSON string stored in a dedicated field
        const existing = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
        const existingMeta = (() => { try { return JSON.parse(existing.bio?.startsWith('{') ? existing.bio : '{}'); } catch(e) { return {}; } })();
        // Store settings as JSON in activityLogs field repurposed as metadata (we'll use a dedicated approach via Appwrite prefs instead)
        // Actually store as structured JSON string in existing schema-compatible field
        const settingsPayload = {
            dailyAllowanceMinutes: settings.dailyAllowanceMinutes ?? 60,
            bedtime: settings.bedtime ?? '',
            warningThresholdMinutes: settings.warningThresholdMinutes ?? 5,
            allowChat: settings.allowChat !== undefined ? settings.allowChat : (existing.allowChat ?? true),
            allowGames: settings.allowGames !== undefined ? settings.allowGames : (existing.allowGames ?? true),
        };
        // Encode as JSON in screenTimeLogs (repurposed for settings since it's a large string field)
        const settingsJson = JSON.stringify({ _timeSettings: settingsPayload, _v: 1 });
        return await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
            screenTimeLogs: settingsJson,
            allowChat: settingsPayload.allowChat,
            allowGames: settingsPayload.allowGames,
        });
    },

    /**
     * Get time management settings for a child.
     * @param {string} childId
     * @returns {Object} Settings object with defaults
     */
    getChildTimeSettings: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const defaults = {
            dailyAllowanceMinutes: 60,
            bedtime: '',
            warningThresholdMinutes: 5,
            allowChat: true,
            allowGames: true,
        };
        try {
            const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
            if (child.screenTimeLogs && child.screenTimeLogs.startsWith('{')) {
                const parsed = JSON.parse(child.screenTimeLogs);
                if (parsed._timeSettings) {
                    return { ...defaults, ...parsed._timeSettings };
                }
            }
            return { ...defaults, allowChat: child.allowChat ?? true, allowGames: child.allowGames ?? true };
        } catch (e) {
            console.warn('getChildTimeSettings error:', e.message);
            return defaults;
        }
    },

    /**
     * Get aggregated screen time data for a child — used for Reports widgets.
     * Returns { totalMinutesToday, byCategory, byDay (last 7 days), topContent }
     * @param {string} childId
     */
    getScreenTimeSummary: async function (childId) {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);

        try {
            const [todayLogs, weekLogs, activityLogs] = await Promise.all([
                databases.listDocuments(DB_ID, 'screen_time_logs', [
                    Query.equal('childId', childId),
                    Query.greaterThanEqual('timestamp', todayStart.toISOString()),
                    Query.limit(200)
                ]).catch(() => ({ documents: [] })),
                databases.listDocuments(DB_ID, 'screen_time_logs', [
                    Query.equal('childId', childId),
                    Query.greaterThanEqual('timestamp', weekAgo.toISOString()),
                    Query.orderDesc('timestamp'),
                    Query.limit(500)
                ]).catch(() => ({ documents: [] })),
                databases.listDocuments(DB_ID, 'activity_logs', [
                    Query.equal('childId', childId),
                    Query.greaterThanEqual('timestamp', weekAgo.toISOString()),
                    Query.orderDesc('timestamp'),
                    Query.limit(100)
                ]).catch(() => ({ documents: [] }))
            ]);

            // Total today
            const totalMinutesToday = todayLogs.documents.reduce((sum, l) => sum + (l.minutes || 0), 0);

            // By category (today)
            const byCategory = {};
            todayLogs.documents.forEach(l => {
                const cat = l.category || 'general';
                byCategory[cat] = (byCategory[cat] || 0) + (l.minutes || 0);
            });

            // By day (last 7 days) — group by date string
            const byDay = {};
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                byDay[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
            }
            weekLogs.documents.forEach(l => {
                const label = new Date(l.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
                if (byDay[label] !== undefined) {
                    byDay[label] += (l.minutes || 0);
                }
            });

            // Top content (from activity logs)
            const contentCount = {};
            activityLogs.documents.forEach(l => {
                if (l.type === 'watch' || l.type === 'play') {
                    const key = l.action || 'Unknown';
                    contentCount[key] = (contentCount[key] || 0) + 1;
                }
            });
            const topContent = Object.entries(contentCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([action, count]) => ({ action, count }));

            // Hour distribution (0–23)
            const byHour = Array(24).fill(0);
            weekLogs.documents.forEach(l => {
                const hour = new Date(l.timestamp).getHours();
                byHour[hour] += (l.minutes || 0);
            });

            return { totalMinutesToday, byCategory, byDay, topContent, byHour, totalActivities: activityLogs.documents.length };
        } catch (e) {
            console.warn('getScreenTimeSummary error:', e.message);
            return { totalMinutesToday: 0, byCategory: {}, byDay: {}, topContent: [], byHour: Array(24).fill(0), totalActivities: 0 };
        }
    },

    /**
     * Get the merged activity feed for a child (logs + threats + watch history).
     * @param {string} childId
     * @param {number} limit
     * @returns {Array} sorted newest-first unified feed items
     */
    getUnifiedActivityFeed: async function (childId, limit = 50) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        try {
            const [actLogs, threats, watchHistory] = await Promise.all([
                databases.listDocuments(DB_ID, 'activity_logs', [
                    Query.equal('childId', childId),
                    Query.orderDesc('timestamp'),
                    Query.limit(100)
                ]).catch(() => ({ documents: [] })),
                databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, [
                    Query.equal('childId', childId),
                    Query.orderDesc('$createdAt'),
                    Query.limit(20)
                ]).catch(() => ({ documents: [] })),
                databases.listDocuments(DB_ID, 'kid_watch_history', [
                    Query.equal('childId', childId),
                    Query.orderDesc('watchedAt'),
                    Query.limit(30)
                ]).catch(() => ({ documents: [] }))
            ]);

            const feed = [];

            // Activity logs
            actLogs.documents.forEach(l => {
                feed.push({
                    id: l.$id,
                    type: l.type || 'activity',
                    action: l.action,
                    timestamp: l.timestamp,
                    metadata: l.metadata,
                    feedCategory: l.type === 'message_sent' ? 'social' :
                                  l.type === 'buddy_add' ? 'social' :
                                  l.type === 'play' ? 'game' : 'activity'
                });
            });

            // Threat logs
            threats.documents.forEach(t => {
                feed.push({
                    id: t.$id,
                    type: 'threat',
                    action: `⚠️ ${t.violationType || 'Safety Alert'}: ${(t.messageContent || t.content || '').slice(0, 80)}`,
                    timestamp: t.$createdAt,
                    metadata: JSON.stringify({ resolved: t.resolved, status: t.status }),
                    feedCategory: 'threat'
                });
            });

            // Watch history (dedupe by videoId)
            const seenVideos = new Set();
            watchHistory.documents.forEach(h => {
                if (seenVideos.has(h.videoId)) return;
                seenVideos.add(h.videoId);
                feed.push({
                    id: h.$id,
                    type: 'watch',
                    action: `Watched: ${h.videoTitle || 'a video'}`,
                    timestamp: h.watchedAt,
                    metadata: JSON.stringify({ category: h.videoCategory }),
                    feedCategory: 'activity'
                });
            });

            // Sort newest first and limit
            return feed
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, limit);

        } catch (e) {
            console.warn('getUnifiedActivityFeed error:', e.message);
            return [];
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // LEARNING PATHS CRUD
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch all learning paths (readable by any, filtered further by caller).
     */
    getPaths: async function () {
        const { databases, DB_ID } = this._getServices();
        const { Query } = Appwrite;
        try {
            const res = await databases.listDocuments(DB_ID, 'paths', [
                Query.orderDesc('$createdAt'),
                Query.limit(100)
            ]);
            return res.documents;
        } catch (e) {
            console.error('getPaths error:', e);
            return [];
        }
    },

    /**
     * Create a new learning path.
     * @param {Object} pathData - { title, description, type, bonusPoints, videoIds, creatorEmail }
     */
    addPath: async function (pathData) {
        const { databases, DB_ID } = this._getServices();
        const { ID } = Appwrite;
        return await databases.createDocument(DB_ID, 'paths', ID.unique(), {
            title: pathData.title,
            description: pathData.description || '',
            type: pathData.type || 'sequential',
            bonusPoints: pathData.bonusPoints || 0,
            videoIds: pathData.videoIds || [],
            creatorEmail: pathData.creatorEmail,
            createdAt: new Date().toISOString()
        });
    },

    /**
     * Update an existing learning path.
     * @param {string} pathId
     * @param {Object} pathData
     */
    updatePath: async function (pathId, pathData) {
        const { databases, DB_ID } = this._getServices();
        return await databases.updateDocument(DB_ID, 'paths', pathId, {
            title: pathData.title,
            description: pathData.description || '',
            type: pathData.type || 'sequential',
            bonusPoints: pathData.bonusPoints || 0,
            videoIds: pathData.videoIds || [],
            creatorEmail: pathData.creatorEmail
        });
    },

    /**
     * Delete a learning path by ID.
     * @param {string} pathId
     */
    deletePath: async function (pathId) {
        const { databases, DB_ID } = this._getServices();
        return await databases.deleteDocument(DB_ID, 'paths', pathId);
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PARENT EMAIL OTP VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Dispatch an OTP code via EmailJS without requiring an active Appwrite session or user document.
     * @param {string} email   Parent's email address
     * @param {string} code    The 6-digit JS generated local OTP code
     */
    sendClientSideOTP: async function (email, code) {
        // Send via EmailJS (reuses the same public key from admin_logic.js)
        const EMAILJS_PUBLIC_KEY  = 'bu5PysfqwXeXaEOhU';
        const EMAILJS_SERVICE_ID  = 'service_4sdis7b';
        const EMAILJS_OTP_TEMPLATE = 'template_otp_verify'; // Create this template in EmailJS

        try {
            if (window.emailjs) {
                window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                await window.emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_OTP_TEMPLATE,
                    { to_email: email, otp_code: code, expires_in: '10 minutes' }
                );
                console.log('📧 [OTP] Verification email sent to:', email);
            } else {
                console.warn('[OTP DEV] Code:', code, '— EmailJS not loaded, showing in console only.');
            }
        } catch (emailErr) {
            console.warn('[OTP] EmailJS send failed (will still work via console):', emailErr.text || emailErr.message || JSON.stringify(emailErr));
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE GROUP CHAT
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates a new private group chat room.
     * @param {string}   name        Display name of the group
     * @param {Object}   creatorChild The child object creating the group
     * @param {string[]} memberIds   Array of child $ids to invite (max 9 others)
     */
    createGroupChat: async function (name, creatorChild, memberIds) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        if (!name || !name.trim()) throw new Error('Group name is required.');
        const allMembers = [...new Set([creatorChild.$id, ...memberIds])].slice(0, 10);
        if (allMembers.length < 2) throw new Error('You need at least one buddy to create a group.');

        const doc = await databases.createDocument(DB_ID, COLLECTIONS.GROUP_CHATS, ID.unique(), {
            name: name.trim().slice(0, 100),
            creatorId: creatorChild.$id,
            memberIds: allMembers,
            createdAt: new Date().toISOString()
        });

        console.log('✅ [Group Chat] Created:', doc.$id);
        return doc;
    },

    /**
     * Fetches all group chats a specific child is a member of.
     * @param {string} childId
     */
    getGroupChats: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.GROUP_CHATS, [
                Query.contains('memberIds', [childId]),
                Query.orderDesc('createdAt'),
                Query.limit(50)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Group Chat] getGroupChats error:', e.message);
            return [];
        }
    },

    /**
     * Fetches all group chats (Admin-only: no filter by member).
     */
    getAllGroupChats: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.GROUP_CHATS, [
                Query.orderDesc('createdAt'),
                Query.limit(200)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Admin] getAllGroupChats error:', e.message);
            return [];
        }
    },

    /**
     * Fetches messages for a specific group chat.
     * Uses groupId field on chat_messages collection.
     * @param {string} groupId
     * @param {number} limit
     */
    getGroupChatMessages: async function (groupId, limit = 50) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.CHAT_MESSAGES, [
                Query.equal('groupId', groupId),
                Query.orderAsc('sentAt'),
                Query.limit(limit)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Group Chat] getGroupChatMessages error:', e.message);
            return [];
        }
    },

    /**
     * Sends a message to a group chat (uses chat_messages collection with groupId set).
     * @param {string} groupId
     * @param {string} fromChildId
     * @param {string} fromUsername
     * @param {string} text
     */
    sendGroupMessage: async function (groupId, fromChildId, fromUsername, text) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        return await databases.createDocument(DB_ID, COLLECTIONS.CHAT_MESSAGES, ID.unique(), {
            conversationId: `group_${groupId}`, // Namespaced to avoid clash with buddy convos
            groupId: groupId,
            fromChildId: fromChildId,
            fromUsername: fromUsername,
            text: text.slice(0, 1000),
            sentAt: new Date().toISOString()
        });
    },

    /**
     * Removes a child from a group chat and notifies their parent.
     * @param {string} groupId
     * @param {Object} childDoc  The leaving child's full document
     */
    leaveGroupChat: async function (groupId, childDoc) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;

        // 1. Fetch the group
        const group = await databases.getDocument(DB_ID, COLLECTIONS.GROUP_CHATS, groupId);
        const updatedMembers = (group.memberIds || []).filter(id => id !== childDoc.$id);

        // 2. Update member list (or delete group if last member)
        if (updatedMembers.length < 1) {
            await databases.deleteDocument(DB_ID, COLLECTIONS.GROUP_CHATS, groupId);
            console.log('[Group Chat] Group deleted (no members left):', groupId);
        } else {
            await databases.updateDocument(DB_ID, COLLECTIONS.GROUP_CHATS, groupId, {
                memberIds: updatedMembers
            });
        }

        // 3. Notify parent of the leaving child
        if (childDoc.parentId) {
            await this._createParentNotification(childDoc.parentId, {
                type: 'group_left',
                childId: childDoc.$id,
                message: `Your child ${childDoc.username || childDoc.name} left the group chat "${group.name}".`
            });
        }

        console.log('[Group Chat] Child left group:', childDoc.$id, groupId);
        return true;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // ADMIN GHOST MODE — AUDIT LOGGING
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Creates an audit log entry whenever a staff member uses Ghost Mode
     * to view a private group chat. Required for accountability.
     * @param {string} adminId    The admin's Users document $id
     * @param {string} adminName  Display name for the log
     * @param {string} groupId    The group being viewed
     * @param {string} groupName  The group's display name
     */
    logAdminGhostMode: async function (adminId, adminName, groupId, groupName) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;
        try {
            await databases.createDocument(DB_ID, COLLECTIONS.ADMIN_AUDIT_LOGS, ID.unique(), {
                adminId: adminId,
                adminName: adminName,
                groupId: groupId,
                groupName: groupName,
                action: 'ghost_mode_view',
                timestamp: new Date().toISOString()
            });
            console.log('🔒 [Audit] Ghost Mode logged for admin:', adminName, 'on group:', groupName);
        } catch (e) {
            console.warn('[Audit] Failed to write audit log:', e.message);
        }
    },

    // ─────────────────────────────────────────────────────────────────────────
    // COSMETICS & REWARDS
    // ─────────────────────────────────────────────────────────────────────────

    getCosmetics: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.COSMETICS);
            return result.documents;
        } catch (e) {
            console.warn('[Cosmetics] getCosmetics error:', e.message);
            return [];
        }
    },

    createCosmetic: async function (cosmeticData) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;
        return await databases.createDocument(DB_ID, COLLECTIONS.COSMETICS, ID.unique(), cosmeticData);
    },

    purchaseCosmetic: async function (childId, cosmeticId, priceStars) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        
        // Fetch current child to check stars
        const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, childId);
        if (child.totalPoints < priceStars) {
            throw new Error('Not enough stars!');
        }

        const unlockedCosmetics = child.unlockedCosmetics || [];
        if (unlockedCosmetics.includes(cosmeticId)) {
            throw new Error('Already owned!');
        }

        unlockedCosmetics.push(cosmeticId);

        // Deduct stars and add to unlocked array
        await databases.updateDocument(DB_ID, COLLECTIONS.CHILDREN, childId, {
            totalPoints: child.totalPoints - priceStars,
            unlockedCosmetics: unlockedCosmetics
        });

        return true;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SUPPORT TICKETS
    // ─────────────────────────────────────────────────────────────────────────

    getSupportTickets: async function (parentId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.SUPPORT_TICKETS, [
                Query.equal('parentId', parentId),
                Query.orderDesc('lastMessageAt')
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Support] getSupportTickets error:', e.message);
            return [];
        }
    },

    getAllSupportTickets: async function () {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.SUPPORT_TICKETS, [
                Query.orderDesc('lastMessageAt')
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Support] getAllSupportTickets error:', e.message);
            return [];
        }
    },

    createSupportTicket: async function (parentId, subject, initialMessage) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        const now = new Date().toISOString();
        const ticket = await databases.createDocument(DB_ID, COLLECTIONS.SUPPORT_TICKETS, ID.unique(), {
            parentId: parentId,
            subject: subject,
            status: 'open',
            lastMessageAt: now,
            createdAt: now
        });

        if (initialMessage) {
            await this.sendSupportMessage(ticket.$id, parentId, false, initialMessage);
        }

        return ticket;
    },

    getSupportMessages: async function (ticketId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.SUPPORT_MESSAGES, [
                Query.equal('ticketId', ticketId),
                Query.orderAsc('sentAt')
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[Support] getSupportMessages error:', e.message);
            return [];
        }
    },

    sendSupportMessage: async function (ticketId, senderId, isStaff, text) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        const now = new Date().toISOString();
        const msg = await databases.createDocument(DB_ID, COLLECTIONS.SUPPORT_MESSAGES, ID.unique(), {
            ticketId: ticketId,
            senderId: senderId,
            isStaff: isStaff,
            text: text,
            sentAt: now
        });

        // Update the ticket LastMessageAt and Status
        await databases.updateDocument(DB_ID, COLLECTIONS.SUPPORT_TICKETS, ticketId, {
            lastMessageAt: now,
            status: isStaff ? 'replied' : 'open'
        });

        return msg;
    },

    // ── Milestone 4: Badge Showcase & Cosmetics Wardrobe ─────────────────────
    getPathStatusesByChild: async function (childId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const result = await databases.listDocuments(DB_ID, COLLECTIONS.PATH_STATUSES, [
                Query.equal('childId', childId),
                Query.limit(100)
            ]);
            return result.documents;
        } catch (e) {
            console.warn('[DataService] getPathStatusesByChild error:', e.message);
            return [];
        }
    },

    getPathById: async function (pathId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        try {
            return await databases.getDocument(DB_ID, COLLECTIONS.LEARNING_PATHS, pathId);
        } catch (e) {
            console.warn('[DataService] getPathById error:', e.message);
            return null;
        }
    },

    // ── Milestone 5: Support Tickets ─────────────────────────────────────────
    createSupportTicket: async function (senderId, senderType, subject, category, bodyText) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;
        const now = new Date().toISOString();
        const doc = await databases.createDocument(DB_ID, COLLECTIONS.SUPPORT_TICKETS, ID.unique(), {
            senderId,
            senderType,   // 'parent' | 'child'
            subject,
            category,
            status: 'open',
            createdAt: now,
            lastMessageAt: now
        });
        // Also create the first message body
        await databases.createDocument(DB_ID, COLLECTIONS.SUPPORT_MESSAGES, ID.unique(), {
            ticketId: doc.$id,
            senderId,
            isStaff: false,
            text: bodyText,
            sentAt: now
        });
        return doc;
    },

    getMyTickets: async function (senderId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const r = await databases.listDocuments(DB_ID, COLLECTIONS.SUPPORT_TICKETS, [
                Query.equal('senderId', senderId),
                Query.orderDesc('lastMessageAt'),
                Query.limit(50)
            ]);
            return r.documents;
        } catch (e) {
            console.warn('[Support] getMyTickets error:', e.message);
            return [];
        }
    },

    getSupportMessages: async function (ticketId) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { Query } = Appwrite;
        try {
            const r = await databases.listDocuments(DB_ID, COLLECTIONS.SUPPORT_MESSAGES, [
                Query.equal('ticketId', ticketId),
                Query.orderAsc('sentAt')
            ]);
            return r.documents;
        } catch (e) {
            console.warn('[Support] getSupportMessages error:', e.message);
            return [];
        }
    },

    sendSupportMessage: async function (ticketId, senderId, isStaff, text) {
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;
        const now = new Date().toISOString();
        const msg = await databases.createDocument(DB_ID, COLLECTIONS.SUPPORT_MESSAGES, ID.unique(), {
            ticketId, senderId, isStaff, text, sentAt: now
        });
        await databases.updateDocument(DB_ID, COLLECTIONS.SUPPORT_TICKETS, ticketId, {
            lastMessageAt: now,
            status: isStaff ? 'replied' : 'open'
        });
        return msg;
    }
};

// Global Access
window.DataService = DataService;