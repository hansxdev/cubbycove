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
     * Registers a new Parent Account
     * returns: Promise<Object> (User Document)
     */
    registerParent: async function (parentData) {
        const { account, databases, DB_ID, COLLECTIONS } = this._getServices();
        const { ID } = Appwrite;

        try {
            // 1. Create Identity (Auth Account)
            // Using email as ID for easier lookup? No, let's use ID.unique() for UserId
            const userId = ID.unique();
            const name = `${parentData.firstName} ${parentData.lastName}`;

            await account.create(userId, parentData.email, parentData.password, name);

            // 2. Create Profile Document in 'Users' Collection
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

            // We use the SAME ID for the Document as the Auth User for 1:1 mapping
            const doc = await databases.createDocument(
                DB_ID,
                COLLECTIONS.USERS,
                userId,
                userDoc
            );

            console.log("✅ [Appwrite] Parent Registered:", doc.$id);
            return doc;

        } catch (error) {
            console.error("Register Error:", error);
            throw error; // Re-throw to UI
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
            let doc;

            try {
                // Try fetching by Auth ID (Preferred 1:1 mapping)
                doc = await databases.getDocument(DB_ID, COLLECTIONS.USERS, sessionUser.$id);
            } catch (e) {
                // If Auth ID doesn't match Doc ID (Legacy or Created via Staff Tool randomly), search by Email
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
        // NOTE: Creating user accounts requires server-side or Cloud Functions properly.
        // Doing it client-side means we have to logout the current admin, create account, logout, re-login admin.
        // OR use Appwrite Teams/Invites (Better).
        // For THIS Prototype: We will use the 'Client Side Auth Juggling' approach which is hacky but expected for pure client-side demos.
        // OR: Just create the DB document and let them "Sign Up" later? No, we want to create the auth.
        // Strategy: We will create the Document directly. The User must separate "Sign Up" themselves using that email?
        // No, let's try the juggle for now, or just throw error saying "Feature requires Cloud Functions for production".

        // Let's implement the 'Register Logic' but for staff.
        // ACTUALLY: We can't easily create another user session while logged in.
        // Alternative: Just create the DB Entry and assume Auth exists? No.

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
    }
};

// Global Access
window.DataService = DataService;