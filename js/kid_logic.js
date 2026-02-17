// Logic for kid/home_logged_in.html AND kid/games.html AND kid/chat.html
// Ensure we have DataService available
// If not included in HTML, this will fail, so we must add it to HTML files.

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check
    const user = await checkAuth();

    if (user) {
        // 2. Update Header
        updateHeader(user);
    }
});

async function checkAuth() {
    try {
        if (typeof DataService === 'undefined') {
            console.error("DataService not loaded. Cannot check auth.");
            // Determine if we are in a subfolder or root to know where to redirect
            // Assuming we are in /kid/ folder
            window.location.href = '../index.html';
            return null;
        }

        const user = await DataService.getCurrentUser();
        if (!user) {
            console.warn("No active session. Redirecting to guest home.");
            window.location.href = '../index.html';
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
    // Update Header Profile
    const headerProfile = document.querySelector('.group .font-bold.text-gray-700');
    const headerAvatars = document.querySelectorAll('.group img'); // Select all avatars in the group container

    // Default Name extraction
    let displayName = user.firstName || "Kid";
    if (user.role === 'parent') displayName = user.firstName; // Parent viewing kid view?
    // If we had a child object concept separate from user, we'd use that.
    // For now, assuming user is the 'kid' (or parent logged in as kid)

    // In our schema, Children are not yet full 'Users' with sessions in the strict sense 
    // unless we logged in as them.
    // If we are logged in as Parent, we might be seeing this view?
    // Let's assume the session user is the one to display.

    if (headerProfile) {
        headerProfile.textContent = `Hi, ${displayName}!`;
        headerProfile.classList.remove('hidden'); // Ensure visible
    }

    // Update Avatar
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