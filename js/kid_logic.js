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

    // 3. Load dynamic kid videos if we are on the home page
    if (document.getElementById('kid-video-list')) {
        loadKidVideos();
    }

    // 4. Record session start time (fresh for each page load/navigation)
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

// Loads approved videos into the kid dashboard
async function loadKidVideos() {
    const videoGrid = document.getElementById('kid-video-list');
    if (!videoGrid) return;

    try {
        const videos = await DataService.getVideos('approved');
        videoGrid.innerHTML = '';

        if (!videos || videos.length === 0) {
            videoGrid.innerHTML = `
                <div class="col-span-full py-12 text-center text-gray-500 font-bold">
                    <p>No videos available right now. Check back later!</p>
                </div>`;
            return;
        }

        videos.forEach(video => {
            const ytMatch = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            const isYouTube = !!ytMatch;
            const vidId = isYouTube ? ytMatch[1] : '';
            const safeUrl = (video.url || '').replace(/"/g, '&quot;');

            const thumbHtml = isYouTube
                ? `<img src="https://img.youtube.com/vi/${vidId}/mqdefault.jpg" alt="${video.title}" class="absolute inset-0 w-full h-full object-cover">`
                : `<video src="${safeUrl}" class="absolute inset-0 w-full h-full object-cover" muted preload="metadata"></video>`;

            // Since this is the Kid dashboard, we can reuse playVideo or playDirectVideo from guest_logic 
            // OR define them here. Since guest_logic isn't loaded here usually, we'll define a simple modal opener here.

            const clickAttr = isYouTube
                ? `onclick="openKidVideoModal('yt', '${vidId}')"`
                : `onclick="openKidVideoModal('direct', '${safeUrl}')"`;

            videoGrid.innerHTML += `
                <div class="video-card group cursor-pointer bg-white rounded-2xl p-3 shadow-md border-b-4 border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all" ${clickAttr}>
                    <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200">
                        ${thumbHtml}
                        <span class="absolute top-2 left-2 bg-cubby-blue text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">${video.category || 'Video'}</span>
                        <div class="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center transition-all">
                            <div class="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center pl-1 shadow-lg">
                                <i class="fa-solid fa-play text-cubby-blue text-xl"></i>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-3 mt-3 px-1">
                        <div class="min-w-[40px]"><img src="https://api.dicebear.com/7.x/identicon/svg?seed=${video.category || 'video'}" class="w-9 h-9 rounded-full bg-gray-100"></div>
                        <div>
                            <h3 class="font-extrabold text-gray-800 text-lg leading-tight mb-1 line-clamp-2 group-hover:text-cubby-blue transition-colors">
                                ${video.title}
                            </h3>
                            <p class="text-sm text-gray-500 font-bold">${video.creatorEmail ? video.creatorEmail.split('@')[0] : 'Creator'}</p>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error('Error loading kid videos:', e);
        videoGrid.innerHTML = `
            <div class="col-span-full py-12 text-center text-gray-500 font-bold">
                <p>Oops, could not load videos. Please try refreshing.</p>
            </div>`;
    }
}

window.openKidVideoModal = function (type, urlOrId) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 backdrop-blur-sm";

    let contentHtml = '';
    if (type === 'yt') {
        contentHtml = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${urlOrId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        contentHtml = `<video src="${urlOrId}" class="w-full h-full" controls autoplay preload="metadata"></video>`;
    }

    modal.innerHTML = `
        <div class="w-full max-w-4xl aspect-video bg-black relative rounded-xl overflow-hidden shadow-2xl border-4 border-gray-800">
            <button onclick="this.parentElement.parentElement.remove()" class="absolute -top-12 right-0 text-white text-3xl hover:text-red-500 transition-colors bg-gray-800/50 rounded-full w-10 h-10 flex items-center justify-center pb-1 shadow-lg">
                <i class="fa-solid fa-times"></i>
            </button>
            ${contentHtml}
        </div>
    `;
    document.body.appendChild(modal);
};

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

// ─────────────────────────────────────────────────────────────────────────
// KID PROFILE SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────

let _kidAvatarColor = '#60a5fa';
let _kidAvatarIcon = '🐻';
let _kidCoverColor = '#3b82f6';
let _kidTheme = 'default';

window.openKidSettingsModal = function () {
    const modal = document.getElementById('kid-settings-modal');
    if (!modal) return;

    const session = _getChildSession();
    if (session) {
        // Load saved prefs from session/child doc
        const prefs = session.prefs || {};
        _kidAvatarColor = prefs.avatarBgColor || '#60a5fa';
        _kidAvatarIcon = prefs.avatarImage || prefs.avatarIcon || '🐻';
        _kidCoverColor = prefs.coverColor || '#3b82f6';
        _kidTheme = prefs.theme || 'default';

        document.getElementById('kid-display-name').value = prefs.displayName || session.name || '';
        document.getElementById('kid-bio').value = prefs.bio || '';

        // Update previews
        const preview = document.getElementById('kid-avatar-preview');
        if (preview) {
            preview.style.background = _kidAvatarColor;
            if (_kidAvatarIcon.startsWith('../')) {
                preview.innerHTML = `<img src="${_kidAvatarIcon}" class="w-full h-full object-contain p-1">`;
            } else {
                preview.textContent = _kidAvatarIcon;
            }
        }
        const coverPreview = document.getElementById('cover-color-preview');
        if (coverPreview) coverPreview.style.background = _kidCoverColor;
    }

    // Bio counter
    const bioEl = document.getElementById('kid-bio');
    if (bioEl) {
        document.getElementById('kid-bio-count').textContent = bioEl.value.length;
        bioEl.oninput = () => { document.getElementById('kid-bio-count').textContent = bioEl.value.length; };
    }

    modal.classList.remove('hidden');
};

window.closeKidSettingsModal = function () {
    document.getElementById('kid-settings-modal')?.classList.add('hidden');
};

window.pickAvatarColor = function (color) {
    _kidAvatarColor = color;
    const preview = document.getElementById('kid-avatar-preview');
    if (preview) preview.style.background = color;
};

window.pickAvatarIcon = function (icon) {
    _kidAvatarIcon = icon;
    const preview = document.getElementById('kid-avatar-preview');
    if (preview) {
        if (icon.startsWith('../')) {
            preview.innerHTML = `<img src="${icon}" class="w-full h-full object-contain p-1">`;
        } else {
            preview.textContent = icon;
        }
    }
};

window.pickCoverColor = function (color) {
    _kidCoverColor = color;
    const coverPreview = document.getElementById('cover-color-preview');
    if (coverPreview) coverPreview.style.background = color;
};

window.pickTheme = function (theme) {
    _kidTheme = theme;
    // Visual feedback — highlight selected
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
    if (theme !== 'default') document.body.classList.add('theme-' + theme);
};

window.saveKidSettings = async function () {
    const session = _getChildSession();
    if (!session) { alert('Session not found. Please log in again.'); return; }

    const displayName = document.getElementById('kid-display-name').value.trim();
    const bio = document.getElementById('kid-bio').value.trim();

    // Gemini API bio filter (stub — call DataService.filterBioGemini if available)
    if (bio && typeof DataService.filterBioGemini === 'function') {
        try {
            const filtered = await DataService.filterBioGemini(bio);
            if (filtered && filtered.blocked) {
                alert('Your bio contains inappropriate content. Please try again with different words! 😊');
                return;
            }
        } catch (e) {
            console.warn('Gemini filter unavailable:', e.message);
        }
    }

    const prefs = {
        avatarBgColor: _kidAvatarColor,
        avatarImage: _kidAvatarIcon.startsWith('../') ? _kidAvatarIcon : null,
        avatarIcon: _kidAvatarIcon.startsWith('../') ? '🐻' : _kidAvatarIcon,
        coverColor: _kidCoverColor,
        theme: _kidTheme,
        displayName: displayName,
        bio: bio
    };

    // Save to child session + try updating child doc
    session.prefs = { ...session.prefs, ...prefs };
    sessionStorage.setItem('cubby_child_session', JSON.stringify(session));

    try {
        if (typeof DataService.updateChildPrefs === 'function') {
            await DataService.updateChildPrefs(session.$id, prefs);
        }
        if (typeof DataService.updateChild === 'function') {
            // Also store these visually-important attributes directly on the document
            // so they are readable without auth
            await DataService.updateChild(session.$id, {
                avatarImage: prefs.avatarImage,
                avatarBgColor: prefs.avatarBgColor
            });
        }
    } catch (e) {
        console.warn('Could not save prefs to server:', e.message);
    }

    // Apply theme immediately
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
    if (_kidTheme !== 'default') document.body.classList.add('theme-' + _kidTheme);

    closeKidSettingsModal();
    alert('Profile saved! ✨');
};

// Apply saved theme on load
document.addEventListener('DOMContentLoaded', () => {
    const session = _getChildSession();
    if (session && session.prefs && session.prefs.theme && session.prefs.theme !== 'default') {
        document.body.classList.add('theme-' + session.prefs.theme);
    }
});
