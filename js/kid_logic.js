// Logic for kid/home_logged_in.html AND kid/games.html AND kid/chat.html
// Ensure we have DataService available.

// ── Screen Time Tracking ──────────────────────────────────────────────────────
// We record when the kid session page loads and flush accumulated minutes
// to Appwrite on unload / visibility-change / logout.

let _screenTimeStart = Date.now(); // Reset each page navigation
let _screenTimeFlushed = false;    // Guard to avoid double-saving per page

/**
 * Detects the screen time category based on the current page URL.
 * - games.html / games folder → 'games'
 * - chat.html / chat folder   → 'communication'
 * - anything else             → 'entertainment'
 */
function _getPageCategory() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('game')) return 'games';
    if (path.includes('chat')) return 'communication';
    return 'entertainment';
}

/**
 * Saves elapsed minutes since _screenTimeStart to Appwrite.
 * Safe to call multiple times — silently returns if already flushed this page load.
 */
async function flushScreenTime() {
    if (_screenTimeFlushed) return;
    _screenTimeFlushed = true;

    const session = _getChildSession();
    if (!session || !session.$id) return;

    const elapsedMs = Date.now() - _screenTimeStart;
    const elapsedMinutes = elapsedMs / 60000; // convert ms → minutes

    if (elapsedMinutes < 0.5) return; // less than 30 seconds — skip

    const category = _getPageCategory();

    try {
        await DataService.logScreenTime(session.$id, elapsedMinutes, category);
    } catch (e) {
        // Non-fatal
        console.warn('[ScreenTime] flush error:', e.message);
    }
}

/** Reads the child session stored by kidLoginFromApproved() */
function _getChildSession() {
    try {
        const raw = sessionStorage.getItem('cubby_child_session');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

// Listen for page unload (tab closed, navigate away, refresh)
window.addEventListener('beforeunload', () => {
    // Use sendBeacon-style synchronous Fire & Forget.
    // We can't await here, but DataService.logScreenTime is a fetch operation
    // that will complete before the browser kills the page in most cases.
    flushScreenTime();
});

// Listen for tab becoming hidden (user switches tabs / minimises / goes to another app)
// This is more reliable than beforeunload on mobile.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushScreenTime();
    } else if (document.visibilityState === 'visible') {
        // Kid came back — restart the timer for this segment
        _screenTimeStart = Date.now();
        _screenTimeFlushed = false;
    }
});

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const user = await checkAuth();

    if (user) {
        // 2. Update Header
        updateHeader(user);
    }

    // 3. Record session start time (fresh for each page load/navigation)
    _screenTimeStart = Date.now();
    _screenTimeFlushed = false;
});

async function checkAuth() {
    try {
        if (typeof DataService === 'undefined') {
            console.error("DataService not loaded. Cannot check auth.");
            window.location.href = '../index.html';
            return null;
        }

        const user = await DataService.getCurrentUser();
        if (!user) {
            console.warn("No active session. Redirecting to guest home.");
            window.location.href = '../index.html';
            return null;
        }

        // Role guard: only kids/children may use these pages.
        const allowedRoles = ['kid', 'child'];
        if (!allowedRoles.includes(user.role)) {
            console.warn(`Role '${user.role}' is not allowed on Kid pages. Redirecting.`);
            if (user.role === 'parent') {
                window.location.href = '../parent/dashboard.html';
            } else {
                window.location.href = '../staff_access.html';
            }
            return null;
        }

        return user;
    } catch (error) {
        console.error("Auth Error:", error);
        window.location.href = '../index.html';
        return null;
    }
}

function updateHeader(user) {
    const headerProfile = document.querySelector('.group .font-bold.text-gray-700');
    const headerAvatars = document.querySelectorAll('.group img');

    let displayName = user.firstName || "Kid";
    if (user.role === 'parent') displayName = user.firstName;

    if (headerProfile) {
        headerProfile.textContent = `Hi, ${displayName}!`;
        headerProfile.classList.remove('hidden');
    }

    const avatarSeed = user.avatar || user.firstName || 'Felix';
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;

    headerAvatars.forEach(img => {
        img.src = avatarUrl;
    });
}

// Check if DataService is missing and warn dev (or user)
if (typeof DataService === 'undefined') {
    console.warn("CRITICAL: DataService.js is missing from this page!");
}

// Expose a proper logout that saves screen time THEN deletes the Appwrite session
window.handleKidLogout = async function () {
    // Flush time before leaving
    await flushScreenTime();

    try {
        await DataService.logout();
    } catch (e) {
        console.warn("Logout error:", e);
    }
    window.location.href = '../index.html';
};
