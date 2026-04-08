/**
 * Security Utilities for CubbyCove
 * Handles password validation, throttling, input sanitization, and hashing.
 */

const SecurityUtils = {

    /**
     * Validates a password against strict security policies.
     * Policy:
     * - Min length: 8
     * - Max length: 20
     * - At least 1 Uppercase
     * - At least 1 Lowercase
     * - At least 1 Number
     * - At least 1 Special Character (!@#$%^&*(),.?":{}|<>)
     *
     * @param {string} password
     * @returns {Object} { isValid: boolean, error: string }
     */
    validatePassword: function (password) {
        if (!password) return { isValid: false, error: "Password is required." };

        if (password.length < 8) return { isValid: false, error: "Password must be at least 8 characters long." };
        if (password.length > 20) return { isValid: false, error: "Password must be no more than 20 characters long." };

        if (!/[A-Z]/.test(password)) return { isValid: false, error: "Password must contain at least one uppercase letter." };
        if (!/[a-z]/.test(password)) return { isValid: false, error: "Password must contain at least one lowercase letter." };
        if (!/\d/.test(password)) return { isValid: false, error: "Password must contain at least one number." };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { isValid: false, error: "Password must contain at least one special character." };

        return { isValid: true, error: null };
    },

    /**
     * Checks if an action is allowed based on a rate limit.
     * Uses localStorage to persist last action time.
     *
     * @param {string} actionKey - Unique identifier for the action (e.g., 'create_staff')
     * @param {number} cooldownSeconds - Time in seconds to wait between actions
     * @returns {Object} { allowed: boolean, waitTime: number }
     */
    checkRateLimit: function (actionKey, cooldownSeconds) {
        const lastTime = localStorage.getItem(`rate_limit_${actionKey}`);
        const now = Date.now();

        if (lastTime) {
            const parsedTime = parseInt(lastTime, 10);
            const elapsed = (now - parsedTime) / 1000; // seconds

            if (elapsed < cooldownSeconds) {
                const waitTime = Math.ceil(cooldownSeconds - elapsed);
                return { allowed: false, waitTime: waitTime };
            }
        }

        // Allowed - Caller should call recordAction separately if they proceed
        return { allowed: true, waitTime: 0 };
    },

    /**
     * Records the current time for a rate-limited action.
     * @param {string} actionKey
     */
    recordAction: function (actionKey) {
        localStorage.setItem(`rate_limit_${actionKey}`, Date.now().toString());
    },

    /**
     * Hashes a password using SHA-256 via the Web Crypto API.
     * Returns a consistent lowercase hex string.
     *
     * ⚠️  SHA-256 alone is NOT a true password-hashing algorithm (no salt /
     *      work factor). For a production system you would use bcrypt server-side.
     *      For a fully client-side PWA this is the strongest option available in
     *      the browser without a backend endpoint — infinitely safer than cleartext.
     *
     * @param {string} password — the raw password string
     * @returns {Promise<string>} — 64-char lowercase hex digest
     */
    hashPassword: async function (password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Compares a raw password string against a stored hash.
     * Returns true when they match.
     *
     * Backward-compatible: if the stored value is NOT a 64-char hex digest it
     * is treated as a legacy plaintext password and compared directly, so
     * existing child accounts keep working until their password is next updated.
     *
     * @param {string} rawPassword
     * @param {string} storedHash — hex digest produced by hashPassword(), or legacy plaintext
     * @returns {Promise<boolean>}
     */
    verifyPassword: async function (rawPassword, storedHash) {
        if (!storedHash) return false;

        // A 64-char hex string is a SHA-256 hash; anything shorter is legacy plaintext.
        if (storedHash.length !== 64) {
            return rawPassword === storedHash; // legacy fallback
        }

        const hashed = await this.hashPassword(rawPassword);
        return hashed === storedHash;
    }

};

// Expose to global scope
window.SecurityUtils = SecurityUtils;
