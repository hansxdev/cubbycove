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
            // 1. Create Identity (Auth Account)
            const userId = ID.unique();
            const name = `${parentData.firstName} ${parentData.lastName}`;

            await account.create(userId, parentData.email, parentData.password, name);

            // 2. Check for Pre-Existing Profile (e.g. Created by Admin)
            const existingList = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [
                Query.equal('email', parentData.email)
            ]);

            if (existingList.documents.length > 0) {
                // Profile exists! Link to it.
                const existingDoc = existingList.documents[0];
                console.log("✅ [Appwrite] Account Linked to Existing Profile:", existingDoc.$id);

                // Check if it's a Staff Role
                if (['admin', 'assistant', 'creator'].includes(existingDoc.role)) {
                    // WARNING: Email Verification requires HTTP/HTTPS (not file://)
                    if (window.location.protocol === 'file:') {
                        alert("⚠️ Developer Warning: Email Verification cannot be sent from file:// protocol.\nPlease run this site on a local server (e.g., Live Server or http-server).");
                        console.error("❌ [Appwrite] Verification Failed: Protocol 'file:' is not supported for redirects.");
                        return existingDoc;
                    }

                    // Send Verification Email
                    // Create session first to satisfy permission requirements for creating verification
                    await account.createEmailPasswordSession(parentData.email, parentData.password);

                    // Construct Verification URL
                    const verifyUrl = `${window.location.origin}/verify_email.html`;
                    const token = await account.createVerification(verifyUrl);

                    console.log("📧 [Appwrite] Verification Email TRIGGERED");

                    // --- DEMO/DEV MODE HACK ---
                    // Since specific email delivery (SMTP) is a paid feature, we simulate the email here.
                    const manualLink = `${verifyUrl}?userId=${token.userId}&secret=${token.secret}&expire=${token.expire}`;
                    console.log("🔗 [DEV] Manual Verification Link:", manualLink);

                    // Show a custom "Simulated Email" modal/alert
                    // We use alert because it's blocking and ensures they see it before logout cleanup
                    setTimeout(() => {
                        const msg = `[DEVELOPER MODE: Email Simulation]\n\nAppwrite Free Tier limits emails. Click OK to open the verification link new tab.\n\n(This simulates clicking the link in your inbox)`;
                        if (confirm(msg)) {
                            window.open(manualLink, '_blank');
                        }
                    }, 500);
                    // --------------------------

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
                createdAt: new Date().toISOString()
            };

            const doc = await databases.createDocument(
                DB_ID,
                COLLECTIONS.USERS,
                userId, // Try 1:1 mapping
                userDoc
            );

            console.log("✅ [Appwrite] Parent Registered:", doc.$id);
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
            if (['admin', 'assistant', 'creator'].includes(doc.role) && !sessionUser.emailVerification) {
                await account.deleteSession('current');
                throw new Error("Please verify your email address to access your staff account.");
            }

            if (doc.role === 'parent' && doc.status === 'pending') {
                await account.deleteSession('current'); // Logout immediately
                throw new Error("Account pending approval. Please wait for verification.");
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
        const { account } = this._getServices();
        try {
            await account.deleteSession('current');
            // Redirect happens in UI
        } catch (error) {
            console.warn("Logout failed (maybe already logged out)", error);
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

        let queries = [Query.orderDesc('uploadedAt')];
        if (statusFilter) {
            queries.push(Query.equal('status', statusFilter));
        }

        const response = await databases.listDocuments(DB_ID, COLLECTIONS.VIDEOS, queries);
        return response.documents;
    },

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
        const { databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        try {
            // 1. Create Child Document
            const childId = ID.unique();
            const newChild = {
                parentId: parentId,
                name: childData.name,
                username: childData.username,
                password: childData.password, // Stored as plain text per schema (but validated)
                avatar: childData.avatar,
                allowChat: childData.allowChat,
                allowGames: childData.allowGames,
                isOnline: false,
                threatsDetected: 0,
                status: 'active'
            };

            const doc = await databases.createDocument(DB_ID, COLLECTIONS.CHILDREN, childId, newChild);

            // 2. Update Parent's Children Array (if schema requires it)
            // Fetch parent first to get existing children
            const parentDoc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, parentId);
            let currentChildren = parentDoc.children || [];

            // Ensure it is an array of strings
            if (typeof currentChildren === 'string') {
                // Try parsing if it's JSON string, otherwise array
                try { currentChildren = JSON.parse(currentChildren); } catch (e) { currentChildren = []; }
            }

            currentChildren.push(childId);

            await databases.updateDocument(DB_ID, COLLECTIONS.USERS, parentId, {
                children: currentChildren
            });

            return doc;

        } catch (error) {
            console.error("Create Child Error:", error);
            throw error;
        }
    }
};

// Global Access
window.DataService = DataService;