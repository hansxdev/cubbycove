/**
 * CUBBYCOVE DATA SERVICE
 * -------------------------------------------------------------------------
 * This file acts as the bridge between the Frontend (UI) and the Backend.
 * * CURRENT STATE: using localStorage (Prototyping)
 * FUTURE STATE:  Replace the logic inside these functions with Appwrite SDK
 */

const DataService = {

    // --- AUTHENTICATION METHODS ---

    /**
     * Registers a new Parent Account
     * @param {Object} parentData - { firstName, middleName, lastName, email, password, faceId }
     * @returns {Object} - The created user object or throws error
     */
    registerParent: function (parentData) {
        // 1. Validate Email Uniqueness (Mock Check)
        const existingUsers = this._getLocalStorage('users') || [];
        const isTaken = existingUsers.some(u => u.email === parentData.email);

        if (isTaken) {
            throw new Error("This email is already registered.");
        }

        // 2. Create User Object
        const newUser = {
            id: 'parent_' + Date.now(),
            role: 'parent',
            status: 'pending', // Pending approval
            firstName: parentData.firstName,
            middleName: parentData.middleName,
            lastName: parentData.lastName,
            email: parentData.email,
            password: parentData.password, // In Appwrite, this is handled securely automatically
            faceId: parentData.faceId || null,
            children: [], // Array of child objects
            createdAt: new Date().toISOString(),
            // Analytics Containers (Empty on create)
            screenTimeLogs: [],
            activityLogs: [],
            threatLogs: []
        };

        // 3. Save to DB (Currently LocalStorage)
        existingUsers.push(newUser);
        this._saveLocalStorage('users', existingUsers);

        // 4. Do NOT Set Active Session (User is pending)
        // this._saveLocalStorage('currentUser', newUser);

        console.log("✅ [Backend] Parent Registered (Pending):", newUser.email);
        return newUser;
    },

    /**
     * Logs in a user
     */
    login: function (email, password) {
        const users = this._getLocalStorage('users') || [];
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) throw new Error("Invalid credentials");

        // CHECK STATUS
        if (user.role === 'parent' && user.status === 'pending') {
            throw new Error("Account pending approval. Please wait for verification.");
        }
        if (user.status === 'suspended' || user.status === 'banned') {
            throw new Error("Account suspended. Contact support.");
        }

        this._saveLocalStorage('currentUser', user);
        return user;
    },

    updateUserStatus: function (email, newStatus) {
        const users = this._getLocalStorage('users') || [];
        const index = users.findIndex(u => u.email === email);
        if (index !== -1) {
            users[index].status = newStatus;
            this._saveLocalStorage('users', users);
            return true;
        }
        return false;
    },

    // --- VIDEO CONTENT METHODS ---

    addVideo: function (videoData) {
        const videos = this._getLocalStorage('videos') || [];
        const newVideo = {
            id: 'vid_' + Date.now(),
            ...videoData,
            status: 'pending', // Default
            views: 0,
            uploadedAt: new Date().toISOString()
        };
        videos.push(newVideo);
        this._saveLocalStorage('videos', videos);
        return newVideo;
    },

    getVideos: function (statusFilter = null) {
        const videos = this._getLocalStorage('videos') || [];
        if (statusFilter) {
            return videos.filter(v => v.status === statusFilter);
        }
        return videos;
    },

    getCreatorVideos: function (creatorEmail) {
        const videos = this._getLocalStorage('videos') || [];
        return videos.filter(v => v.creatorEmail === creatorEmail);
    },

    updateVideoStatus: function (videoId, newStatus) {
        const videos = this._getLocalStorage('videos') || [];
        const index = videos.findIndex(v => v.id === videoId);
        if (index !== -1) {
            videos[index].status = newStatus;
            this._saveLocalStorage('videos', videos);
            return true;
        }
        return false;
    },

    /**
     * Get currently logged in user
     */
    getCurrentUser: function () {
        return this._getLocalStorage('currentUser');
    },

    logout: function () {
        localStorage.removeItem('currentUser');
    },

    // --- STAFF MANAGEMENT (Power User Only) ---

    initSuperAdmin: function () {
        const users = this._getLocalStorage('users') || [];
        const hasSuperAdmin = users.some(u => u.role === 'super_admin');

        if (!hasSuperAdmin) {
            const superAdmin = {
                id: 'super_admin_01',
                role: 'super_admin',
                status: 'active',
                firstName: 'Power',
                lastName: 'User',
                email: 'power_user@cubbycove.com',
                password: 'password123', // Hardcoded for initial access
                createdAt: new Date().toISOString()
            };
            users.push(superAdmin);
            this._saveLocalStorage('users', users);
            console.log("⚡ [Backend] Super Admin Initialized: power_user@cubbycove.com");
        }
    },

    createStaffAccount: function (creatorEmail, newStaffData) {
        // 1. Verify Requestor is Super Admin
        const users = this._getLocalStorage('users') || [];
        const requestor = users.find(u => u.email === creatorEmail);

        if (!requestor || requestor.role !== 'super_admin') {
            throw new Error("Unauthorized: Only Super Admin can create staff accounts.");
        }

        // 2. Validate Email
        if (users.some(u => u.email === newStaffData.email)) {
            throw new Error("Email already registered.");
        }

        // 3. Create Staff
        const newStaff = {
            id: 'staff_' + Date.now(),
            role: newStaffData.role, // 'admin', 'assistant', 'creator'
            status: 'active',
            firstName: newStaffData.firstName,
            lastName: newStaffData.lastName,
            email: newStaffData.email,
            password: newStaffData.password,
            createdAt: new Date().toISOString()
        };

        users.push(newStaff);
        this._saveLocalStorage('users', users);
        return newStaff;
    },

    getAllUsers: function () {
        return this._getLocalStorage('users') || [];
    },

    _getLocalStorage: function (key) {
        const data = localStorage.getItem('cubby_' + key);
        return data ? JSON.parse(data) : null;
    },

    _saveLocalStorage: function (key, data) {
        localStorage.setItem('cubby_' + key, JSON.stringify(data));
    }
};

// Initialize Super Admin on Load
DataService.initSuperAdmin();

// Expose to window for global access
window.DataService = DataService;