/**
 * Security Utilities for CubbyCove
 * Handles password validation, throttling, and input sanitization.
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
    }
};

// Expose to global scope
window.SecurityUtils = SecurityUtils;
