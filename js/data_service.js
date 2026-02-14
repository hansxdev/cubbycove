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
            firstName: parentData.firstName,
            middleName: parentData.middleName,
            lastName: parentData.lastName,
            email: parentData.email,
            password: parentData.password, // In Appwrite, this is handled securely automatically
            faceId: parentData.faceId || null, // Placeholder for biometric string
            children: [], // Array of child IDs
            createdAt: new Date().toISOString()
        };

        // 3. Save to DB (Currently LocalStorage)
        existingUsers.push(newUser);
        this._saveLocalStorage('users', existingUsers);

        // 4. Set Active Session
        this._saveLocalStorage('currentUser', newUser);

        console.log("✅ [Backend] Parent Registered:", newUser.email);
        return newUser;
    },

    /**
     * Logs in a user
     */
    login: function (email, password) {
        const users = this._getLocalStorage('users') || [];
        const user = users.find(u => u.email === email && u.password === password);

        if (!user) throw new Error("Invalid credentials");

        this._saveLocalStorage('currentUser', user);
        return user;
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

    // --- HELPER FUNCTIONS (Internal Use Only) ---

    _getLocalStorage: function (key) {
        const data = localStorage.getItem('cubby_' + key);
        return data ? JSON.parse(data) : null;
    },

    _saveLocalStorage: function (key, data) {
        localStorage.setItem('cubby_' + key, JSON.stringify(data));
    }
};

// Expose to window for global access
window.DataService = DataService;