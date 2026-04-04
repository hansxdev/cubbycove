// Logic for kid/home_logged_in.html AND kid/games.html AND kid/chat.html
// AND kid/history.html AND kid/favorites.html
// Ensure we have DataService available.

// ── Screen Time Tracking ──────────────────────────────────────────────────────
let _screenTimeStart = Date.now();
let _screenTimeFlushed = false;

// ── All approved videos cache (used by modal recommendations) ─────────────────
let _allApprovedVideos = [];

// ── Reward Engine State ──────────────────────────────────────────────────────
let _rewardInterval = null;
let _heartbeatInterval = null;
let _currentVideoId = null;
let _currentPathId = null; // Path context for the current video
let _currentPointsValue = 10;
let _elapsedPlayTime = 0;
let _completionThreshold = 0.8; // 80%
let _isRewardClaimed = false;
let _rewardedVideoIds = new Set(); // Cache of completed videos for badges
let _likedVideoIds = new Set();   // Per-session like guard (one like per video per session)
let _dislikedVideoIds = new Set(); // Per-session dislike guard

function _getPageCategory() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('game')) return 'games';
    if (path.includes('chat')) return 'communication';
    return 'entertainment';
}

async function flushScreenTime() {
    if (_screenTimeFlushed) return;
    _screenTimeFlushed = true;
    const session = _getChildSession();
    if (!session || !session.$id) return;
    const elapsedMs = Date.now() - _screenTimeStart;
    const elapsedMinutes = elapsedMs / 60000;
    if (elapsedMinutes < 0.5) return;
    const category = _getPageCategory();
    try {
        await DataService.logScreenTime(session.$id, elapsedMinutes, category);
    } catch (e) {
        console.warn('[ScreenTime] flush error:', e.message);
    }
}

function _getChildSession() {
    try {
        const raw = sessionStorage.getItem('cubby_child_session');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

window.addEventListener('beforeunload', () => { 
    flushScreenTime(); 
    const session = _getChildSession();
    if (session && session.$id) {
        // Fire and forget to indicate offline
        DataService.updateChildPrefs(session.$id, { isOnline: false }).catch(()=>{});
    }
});

document.addEventListener('visibilitychange', () => {
    const session = _getChildSession();
    if (document.visibilityState === 'hidden') {
        flushScreenTime();
        if (session && session.$id) {
            DataService.updateChildPrefs(session.$id, { isOnline: false }).catch(()=>{});
        }
    } else if (document.visibilityState === 'visible') {
        _screenTimeStart = Date.now();
        _screenTimeFlushed = false;
        if (session && session.$id) {
            DataService.updateChildPrefs(session.$id, { isOnline: true }).catch(()=>{});
        }
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (user) {
        updateHeader(user);
        // Mark as online on successful load
        DataService.updateChildPrefs(user.$id, { isOnline: true }).catch(() => console.warn('[Presence] Could not set online status'));
    }

    const path = window.location.pathname.toLowerCase();

    // Home page
    if (document.getElementById('kid-video-list')) {
        loadKidVideos();
        loadLearningPaths();
        loadContinueWatching();
    }

    // Games page — render the dynamic game card grid
    if (document.getElementById('games-grid-container')) {
        renderGamesGrid();
    }

    // History page
    if (path.includes('history.html')) {
        loadHistoryPage();
    }

    // Favorites page
    if (path.includes('favorites.html')) {
        loadFavoritesPage();
    }

    // Reward Initialization
    await _initRewardState();

    _screenTimeStart = Date.now();
    _screenTimeFlushed = false;
});

/**
 * playMemoryGame()
 * Alias wired to the featured "Play Now" hero banner button in games.html.
 * Opens the first game in the catalog (update GAMES_CATALOG[0] to the desired
 * featured game at any time).
 */
window.playMemoryGame = function () {
    const featured = GAMES_CATALOG[0];
    if (featured) openGameModal(featured.id);
};

async function _initRewardState() {
    const session = _getChildSession();
    if (!session || !session.$id) return;
    try {
        const { databases, DB_ID, COLLECTIONS } = window.AppwriteService;
        const rewards = await databases.listDocuments(
            DB_ID,
            COLLECTIONS.KID_REWARDS,
            [Appwrite.Query.equal('childId', session.$id), Appwrite.Query.equal('rewardType', 'video_completion')]
        );
        _rewardedVideoIds = new Set(rewards.documents.map(d => d.sourceId));
    } catch (e) {
        console.warn('Reward state init error:', e.message);
    }
}

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
        const allowedRoles = ['kid', 'child'];
        if (!allowedRoles.includes(user.role)) {
            if (user.role === 'parent') window.location.href = '../parent/dashboard.html';
            else window.location.href = '../staff_access.html';
            return null;
        }
        return user;
    } catch (error) {
        console.error("Auth Error:", error);
        window.location.href = '../index.html';
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// HEADER — Dynamic Profile Picture
// ─────────────────────────────────────────────────────────────────────────────
function updateHeader(user) {
    const headerProfile = document.querySelector('nav .group .font-bold.text-indigo-900');
    const headerAvatarImgs = document.querySelectorAll('nav .group img');

    if (headerProfile) {
        headerProfile.textContent = `Hi, ${user.username || user.firstName || 'Explorer'}!`;
        headerProfile.classList.remove('hidden');
    }

    // Show Points
    const pointsDisplay = document.getElementById('kid-points-display');
    const pointsVal = document.getElementById('header-total-points');
    if (pointsDisplay && pointsVal) {
        pointsVal.textContent = user.totalPoints || 0;
        pointsDisplay.classList.remove('hidden');
    }

    // Check for custom avatar from session prefs or child doc
    const session = _getChildSession();
    const prefs = session?.prefs || {};
    const avatarImage = user.avatarImage || prefs.avatarImage;
    const avatarBgColor = user.avatarBgColor || prefs.avatarBgColor;

    headerAvatarImgs.forEach(img => {
        if (avatarImage && avatarImage.startsWith('../')) {
            img.src = avatarImage;
            img.style.objectFit = 'contain';
            img.style.padding = '2px';
            if (avatarBgColor) img.style.backgroundColor = avatarBgColor;
        } else {
            const avatarSeed = user.avatar || user.firstName || 'Felix';
            img.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD KID VIDEOS — Featured for You (horizontal scroll, 4 visible)
// ─────────────────────────────────────────────────────────────────────────────
async function loadKidVideos() {
    const videoGrid = document.getElementById('kid-video-list');
    if (!videoGrid) return;

    try {
        const videos = await DataService.getVideos('approved');
        _allApprovedVideos = videos || [];
        videoGrid.innerHTML = '';

        if (!videos || videos.length === 0) {
            videoGrid.innerHTML = `
                <div class="py-12 text-center text-gray-500 font-bold w-full">
                    <p>No videos available right now. Check back later!</p>
                </div>`;
            return;
        }

        videos.forEach(video => {
            videoGrid.innerHTML += _buildVideoCard(video);
        });
    } catch (e) {
        console.error('Error loading kid videos:', e);
        videoGrid.innerHTML = `
            <div class="py-12 text-center text-gray-500 font-bold w-full">
                <p>Oops, could not load videos. Please try refreshing.</p>
            </div>`;
    }
}

/** Build a single video card HTML string */
function _buildVideoCard(video, extraClasses = '') {
    const ytMatch = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const isYouTube = !!ytMatch;
    const vidId = isYouTube ? ytMatch[1] : '';
    const safeUrl = (video.url || '').replace(/"/g, '&quot;');
    const videoDocId = video.$id || '';

    // Use custom thumbnail if available
    let thumbHtml;
    if (video.thumbnailUrl) {
        thumbHtml = `<img src="${video.thumbnailUrl}" alt="${video.title}" class="absolute inset-0 w-full h-full object-cover">`;
    } else if (isYouTube) {
        thumbHtml = `<img src="https://img.youtube.com/vi/${vidId}/mqdefault.jpg" alt="${video.title}" class="absolute inset-0 w-full h-full object-cover">`;
    } else {
        thumbHtml = `<video src="${safeUrl}" class="absolute inset-0 w-full h-full object-cover" muted preload="metadata"></video>`;
    }

    return `
        <div class="video-card group cursor-pointer bg-white rounded-2xl p-3 shadow-md border-b-4 border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all flex-shrink-0 min-w-[260px] max-w-[300px] snap-start ${extraClasses}"
             onclick="openKidVideoModal('${videoDocId}')">
            <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200">
                ${thumbHtml}
                <span class="absolute top-2 left-2 bg-cubby-blue text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">${video.category || 'Video'}</span>
                
                <!-- Rewarded/Completed Badge -->
                ${_rewardedVideoIds.has(videoDocId) ? `
                    <div class="absolute top-2 right-2 bg-cubby-yellow text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md animate-bounce">
                        <i class="fa-solid fa-star text-xs"></i>
                    </div>
                ` : ''}

                <div class="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center transition-all">
                    <div class="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center pl-1 shadow-lg">
                        <i class="fa-solid fa-play text-cubby-blue text-xl"></i>
                    </div>
                </div>
            </div>
            <div class="flex gap-3 mt-3 px-1">
                <div class="min-w-[40px]"><img src="https://api.dicebear.com/7.x/identicon/svg?seed=${video.category || 'video'}" class="w-9 h-9 rounded-full bg-gray-100"></div>
                <div class="min-w-0">
                    <h3 class="font-extrabold text-gray-800 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-cubby-blue transition-colors">
                        ${video.title}
                    </h3>
                    <p class="text-xs text-gray-500 font-bold">${video.creatorEmail ? video.creatorEmail.split('@')[0] : 'Creator'}</p>
                </div>
            </div>
        </div>`;
}

// ── Learning Paths Logic ─────────────────────────────────────────────────────
async function loadLearningPaths() {
    const container = document.getElementById('learning-paths-list');
    if (!container) return;

    try {
        const paths = await DataService.getPaths();
        container.innerHTML = '';

        if (!paths || paths.length === 0) {
            container.closest('section')?.classList.add('hidden');
            return;
        }

        // Fetch progress for all paths for this child
        const session = _getChildSession();
        let pathStatuses = [];
        if (session?.$id) {
            pathStatuses = await DataService.getPathStatusesByChild(session.$id);
        }

        paths.forEach(path => {
            const status = pathStatuses.find(s => s.pathId === path.$id);
            container.innerHTML += _buildPathCard(path, status);
        });
    } catch (e) {
        console.warn('Error loading learning paths:', e.message);
    }
}

function _buildPathCard(path, status) {
    const completedCount = (status?.completedVideoIds || []).length;
    const totalCount = (path.videoIds || []).length;
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isCompleted = status?.currentStatus === 'completed' || percent >= 100;

    return `
        <div class="video-card group cursor-pointer bg-white rounded-2xl p-4 shadow-md border-b-4 border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all flex-shrink-0 min-w-[300px] max-w-[320px] snap-start border-l-4 ${isCompleted ? 'border-l-green-400' : 'border-l-cubby-purple'}"
             onclick="openPathQuickView('${path.$id}')">
            <div class="flex justify-between items-start mb-3">
                <div class="bg-purple-50 text-cubby-purple p-2 rounded-xl">
                    <i class="fa-solid fa-route text-lg"></i>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-black ${isCompleted ? 'text-green-500' : 'text-cubby-purple'} uppercase bg-gray-50 px-2 py-1 rounded-lg">
                        ${isCompleted ? 'Finished!' : (percent > 0 ? percent + '%' : 'New Path')}
                    </span>
                </div>
            </div>
            
            <h3 class="font-extrabold text-gray-800 text-sm leading-tight mb-2 line-clamp-1 group-hover:text-cubby-purple transition-colors">
                ${path.title}
            </h3>
            <p class="text-[11px] text-gray-500 line-clamp-2 mb-4 h-8 leading-relaxed">
                ${path.description || 'No description available.'}
            </p>
            
            <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                <div class="flex items-center gap-1.5">
                    <div class="flex -space-x-2">
                        <div class="w-5 h-5 rounded-full bg-gray-200 border border-white flex items-center justify-center text-[8px] font-bold">1</div>
                        <div class="w-5 h-5 rounded-full bg-gray-100 border border-white flex items-center justify-center text-[8px] font-bold">2</div>
                        <div class="w-5 h-5 rounded-full bg-gray-50 border border-white flex items-center justify-center text-[8px] font-bold">...</div>
                    </div>
                    <span class="text-[10px] font-bold text-gray-400 ml-1">${totalCount} Videos</span>
                </div>
                <div class="text-[10px] font-black text-orange-500 flex items-center gap-1">
                    <i class="fa-solid fa-star"></i> +${path.bonusStars || 0}
                </div>
            </div>
        </div>`;
}

async function openPathQuickView(pathId) {
    try {
        const path = await DataService.getPathById(pathId);
        if (!path || !path.videoIds || path.videoIds.length === 0) return;

        // Find the first uncompleted video or the first video
        const session = _getChildSession();
        let status = null;
        if (session?.$id) {
            status = await DataService.getPathProgress(session.$id, pathId);
        }

        const completedSet = new Set(status?.completedVideoIds || []);
        let startVideoId = path.videoIds[0];
        
        for (const vidId of path.videoIds) {
            if (!completedSet.has(vidId)) {
                startVideoId = vidId;
                break;
            }
        }

        // Open the video with path context
        openKidVideoModal(startVideoId, pathId);

    } catch (e) {
        console.error('Error opening path quick view:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTINUE WATCHING — Today only
// ─────────────────────────────────────────────────────────────────────────────
async function loadContinueWatching() {
    const container = document.getElementById('continue-watching-list');
    if (!container) return;

    const session = _getChildSession();
    if (!session || !session.$id) {
        container.innerHTML = '<p class="text-gray-400 font-semibold text-sm px-2">Log in to see your history.</p>';
        return;
    }

    try {
        const history = await DataService.getWatchHistory(session.$id, 'today');
        if (!history || history.length === 0) {
            container.innerHTML = '<p class="text-gray-400 font-semibold text-sm px-2">Nothing watched today yet! Start exploring 🎬</p>';
            return;
        }

        // Deduplicate by videoId (keep most recent watch)
        const seen = new Set();
        const unique = history.filter(h => {
            if (seen.has(h.videoId)) return false;
            seen.add(h.videoId);
            return true;
        });

        container.innerHTML = unique.map(h => {
            const fakeVideo = {
                $id: h.videoId,
                title: h.videoTitle,
                url: h.videoUrl,
                category: h.videoCategory,
                thumbnailUrl: h.thumbnailUrl,
                creatorEmail: ''
            };
            return _buildVideoCard(fakeVideo);
        }).join('');
    } catch (e) {
        console.warn('Continue watching error:', e.message);
        container.innerHTML = '<p class="text-gray-400 font-semibold text-sm px-2">Could not load watch history.</p>';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO PLAYER MODAL — YouTube-style (70/30 Layout)
// ─────────────────────────────────────────────────────────────────────────────
window.openKidVideoModal = async function (videoDocId, pathId = null) {
    // FIX: Always close any existing modal first to prevent black screen stacking
    const existingModal = document.getElementById('kid-video-modal');
    if (existingModal) {
        _stopRewardTracking();
        existingModal.remove();
        document.body.style.overflow = '';
    }

    // Find video from cache or fetch it
    let video = _allApprovedVideos.find(v => v.$id === videoDocId);
    if (!video) {
        try { video = await DataService.getVideoById(videoDocId); } catch (e) { }
    }
    if (!video) return;

    const ytMatch = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const isYouTube = !!ytMatch;
    const vidId = isYouTube ? ytMatch[1] : '';
    const safeUrl = (video.url || '').replace(/"/g, '&quot;');

    // FIX: For YouTube, we use a plain div target and initialize via YT.Player API
    // so we can accurately track play/pause state. For native video, use <video>.
    let playerHtml;
    if (isYouTube) {
        // The div will be replaced by the YT.Player constructor after the modal is in DOM
        playerHtml = `<div id="kid-yt-player-target" style="width:100%;height:100%;"></div>`;
    } else {
        playerHtml = `<video id="kid-modal-player" src="${safeUrl}" class="w-full h-full" controls autoplay preload="metadata"></video>`;
    }

    // Log watch history (fire before modal build so it doesn't block UI)
    const session = _getChildSession();
    const thumbUrl = video.thumbnailUrl || (isYouTube ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : '');
    if (session?.$id) {
        DataService.logWatchHistory(session.$id, video.$id, video.title, video.category, video.url, thumbUrl);
        DataService.incrementVideoView(video.$id, '').catch(() => { });
        DataService.logActivity(session.$id, 'watch', `Started watching: ${video.title}`, { videoId: video.$id, category: video.category });
        DataService.logScreenTime(session.$id, 1, video.category?.toLowerCase() || 'entertainment', video.title);
    }

    // Check favorite status
    let isFav = false;
    if (session?.$id) {
        isFav = await DataService.isFavorited(session.$id, video.$id);
    }

    // Build recommendations
    const recsHtml = _buildRecommendations(video);

    const modal = document.createElement('div');
    modal.id = 'kid-video-modal';
    modal.className = 'fixed inset-0 z-[100] flex flex-col lg:flex-row overflow-auto bg-gradient-to-br from-[#2b1055] via-[#4c2273] to-[#12072b]';

    modal.innerHTML = `
        <!-- Floating Stars Background -->
        <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
            <div class="absolute top-[10%] left-[20%] w-2 h-2 bg-yellow-200 rounded-full shadow-[0_0_10px_#fef08a] animate-pulse"></div>
            <div class="absolute top-[30%] right-[15%] w-3 h-3 bg-blue-200 rounded-full shadow-[0_0_15px_#bfdbfe] animate-[pulse_3s_infinite]"></div>
            <div class="absolute bottom-[20%] left-[10%] w-2.5 h-2.5 bg-pink-200 rounded-full shadow-[0_0_12px_#fbcfe8] animate-[pulse_2.5s_infinite]"></div>
            <div class="absolute top-[50%] right-[40%] w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_8px_white] animate-[pulse_4s_infinite]"></div>
            <div class="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
            <div class="absolute bottom-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        <!-- Close Button -->
        <button id="kid-modal-close-btn" class="absolute top-4 right-4 z-50 text-white/80 hover:text-white text-2xl hover:scale-110 transition-all bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full w-12 h-12 flex items-center justify-center shadow-[0_4px_0_rgba(255,255,255,0.1)] active:translate-y-1 active:shadow-none">
            <i class="fa-solid fa-times"></i>
        </button>

        <!-- LEFT: Video Player (70%) -->
        <div class="w-full lg:w-[70%] flex flex-col p-4 lg:p-8 relative z-10 pt-20 lg:pt-8 min-h-[min-content]">
            <div class="w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border-[4px] border-white/10 relative z-10">
                ${playerHtml}
            </div>

            <!-- Video Info Glassmorphism Container -->
            <div class="mt-6 p-6 rounded-3xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] w-full">
                <h2 class="text-white text-2xl lg:text-3xl font-black leading-tight mb-3 drop-shadow-md tracking-wide">${video.title}</h2>
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-400 to-blue-400 p-[2px] shadow-lg">
                        <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${video.category || 'creator'}" class="w-full h-full rounded-full bg-gray-900 border-2 border-transparent">
                    </div>
                    <div>
                        <p class="text-blue-100 font-extrabold text-base drop-shadow-sm">${video.creatorEmail ? video.creatorEmail.split('@')[0] : 'Creator'}</p>
                        <p class="text-white/60 text-sm font-bold">${video.category || 'Video'} • ${(video.views || 0).toLocaleString()} views</p>
                    </div>
                </div>

                <!-- Action Buttons (3D Pills) -->
                <div class="flex flex-wrap gap-4">
                    <button onclick="window._kidLikeVideo('${video.$id}')" class="flex items-center gap-2 bg-[#86efac] text-green-950 px-6 py-2.5 rounded-full text-base font-black shadow-[0_4px_0_#22c55e] hover:translate-y-[2px] hover:shadow-[0_2px_0_#22c55e] active:translate-y-1 active:shadow-none transition-all group border-[3px] border-green-200">
                        <i class="fa-solid fa-thumbs-up group-hover:scale-110 transition-transform"></i> <span id="kid-like-count">${video.likes || 0}</span>
                    </button>
                    <button onclick="window._kidDislikeVideo('${video.$id}')" class="flex items-center gap-2 bg-[#fca5a5] text-red-950 px-6 py-2.5 rounded-full text-base font-black shadow-[0_4px_0_#ef4444] hover:translate-y-[2px] hover:shadow-[0_2px_0_#ef4444] active:translate-y-1 active:shadow-none transition-all group border-[3px] border-red-200">
                        <i class="fa-solid fa-thumbs-down group-hover:scale-110 transition-transform"></i> <span id="kid-dislike-count">${video.dislikes || 0}</span>
                    </button>
                    <button id="kid-fav-btn" onclick="window._kidToggleFavorite('${video.$id}', '${video.title.replace(/'/g, "\\'")}'  , '${video.category}', '${safeUrl}', '${thumbUrl}')"
                        class="flex items-center gap-2 ${isFav ? 'bg-[#fbcfe8] text-pink-950 border-[3px] border-pink-300 shadow-[0_4px_0_#f472b6] hover:shadow-[0_2px_0_#f472b6]' : 'bg-white/10 text-white backdrop-blur-sm border-[3px] border-white/20 shadow-[0_4px_0_rgba(255,255,255,0.1)] hover:shadow-[0_2px_0_rgba(255,255,255,0.1)]'} px-6 py-2.5 rounded-full text-base font-black hover:translate-y-[2px] active:translate-y-1 active:shadow-none transition-all group">
                        <i class="fa-solid fa-heart ${isFav ? 'animate-pulse text-pink-500' : ''} group-hover:scale-110 transition-transform"></i> ${isFav ? 'Favorited' : 'Favorite'}
                    </button>
                    <button onclick="window._kidShareVideo('${video.url}')" class="flex items-center gap-2 bg-[#93c5fd] text-blue-950 px-6 py-2.5 rounded-full text-base font-black shadow-[0_4px_0_#3b82f6] hover:translate-y-[2px] hover:shadow-[0_2px_0_#3b82f6] active:translate-y-1 active:shadow-none transition-all border-[3px] border-blue-200 group">
                        <i class="fa-solid fa-share group-hover:scale-110 transition-transform"></i> Share
                    </button>
                </div>
            </div>
        </div>

        <!-- RIGHT: Recommendations (30%) -->
        <div class="w-full lg:w-[30%] p-4 lg:p-8 lg:pl-0 relative z-10 pt-4 lg:pt-8 min-h-[min-content]">
            <div class="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] h-full overflow-y-auto no-scrollbar">
                <h3 class="text-white font-black text-xl mb-5 flex items-center gap-2 drop-shadow-md"><i class="fa-solid fa-wand-magic-sparkles text-yellow-300 animate-pulse"></i> Up Next</h3>
                <div id="kid-modal-recs" class="space-y-4">
                    ${recsHtml}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Initialize the YouTube IFrame Player API for accurate play-state tracking.
    // For native video, wait for loadedmetadata to get the real duration.
    if (isYouTube) {
        _initYouTubePlayer(vidId, video, pathId);
    } else {
        // Bug 2 Fix (Native): Wait for real duration from the browser via loadedmetadata
        // instead of relying on an often-missing DB field.
        const finalPoints = [video.pointsValue, 10].find(p => p !== undefined && p !== null);
        const player = document.getElementById('kid-modal-player');
        if (player) {
            player.addEventListener('loadedmetadata', () => {
                // Use the real duration reported by the browser. No fallback.
                _startRewardTracking(videoDocId, player.duration, finalPoints, pathId, 'native');
            }, { once: true });
        }
    }

    // Close listeners
    document.getElementById('kid-modal-close-btn').addEventListener('click', _closeKidVideoModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) _closeKidVideoModal();
    });
};

// ── YouTube IFrame Player API Integration ─────────────────────────────────────
// Reference: https://developers.google.com/youtube/iframe_api_reference
// We track _ytPlayer globally so _stopRewardTracking can destroy it on close.
let _ytPlayer = null;

function _initYouTubePlayer(vidId, video, pathId) {
    const finalPoints = [video.pointsValue, 10].find(p => p !== undefined && p !== null);

    const _doInit = () => {
        // Destroy previous player if still alive
        if (_ytPlayer) {
            try { _ytPlayer.destroy(); } catch (e) {}
            _ytPlayer = null;
        }

        _ytPlayer = new YT.Player('kid-yt-player-target', {
            videoId: vidId,
            playerVars: { autoplay: 1, rel: 0, modestbranding: 1 },
            events: {
                onReady: (event) => {
                    // Bug 2 Fix (YouTube): Get the actual video duration from the YouTube player
                    // via getDuration() instead of relying on the DB field which is often undefined.
                    // This eliminates the 30-second fallback exploit entirely.
                    const realDuration = event.target.getDuration();
                    console.log(`[YT] Real video duration from API: ${realDuration}s`);
                    _startRewardTracking(video.$id, realDuration, finalPoints, pathId, 'youtube');
                },
                onStateChange: (event) => {
                    // YT.PlayerState.PLAYING === 1
                    window._ytIsPlaying = (event.data === YT.PlayerState.PLAYING);
                }
            }
        });
    };

    // The YT API may not be loaded yet the first time.
    if (window.YT && window.YT.Player) {
        _doInit();
    } else {
        // Load the API once and wait for the onYouTubeIframeAPIReady callback
        if (!document.getElementById('yt-iframe-api-script')) {
            const script = document.createElement('script');
            script.id = 'yt-iframe-api-script';
            script.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(script);
        }
        // Queue initialisation — the API calls window.onYouTubeIframeAPIReady when ready
        const _prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            if (typeof _prev === 'function') _prev();
            // Only proceed if the target element still exists (modal not closed early)
            if (document.getElementById('kid-yt-player-target')) {
                _doInit();
            }
        };
    }
}

function _closeKidVideoModal() {
    _stopRewardTracking();
    const modal = document.getElementById('kid-video-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// ── Reward Logic Implementation ──────────────────────────────────────────────
// FIX: Accept an optional playerType argument ('youtube' | 'native') to choose
// the correct play-state check without hardcoding isPlaying = true.
async function _startRewardTracking(videoId, duration, points, pathId = null, playerType = 'native') {
    _currentVideoId = videoId;
    _currentPathId = pathId;
    _currentPointsValue = points;
    _elapsedPlayTime = 0;
    _isRewardClaimed = _rewardedVideoIds.has(videoId);

    if (_isRewardClaimed) {
        console.log('Video already rewarded. No tracking needed.');
        return;
    }

    // Bug 2 Fix: The 30-second fallback has been removed. If duration is unavailable
    // or zero, we cannot reliably enforce the 80% threshold, so we skip reward tracking
    // for this video to prevent exploitation.
    if (!duration || duration <= 0) {
        console.warn('[Rewards] Video duration unavailable. Reward tracking skipped for this video to prevent exploitation.');
        return;
    }

    const thresholdSeconds = duration * _completionThreshold;
    console.log(`🎯 Tracking reward for ${videoId} (${playerType}). Need ${Math.round(thresholdSeconds)}s of watch time.`);

    // Reset the global YouTube play-state flag
    window._ytIsPlaying = false;

    _rewardInterval = setInterval(() => {
        // FIX: Choose the correct play-state detection based on player type.
        let isPlaying = false;

        if (playerType === 'youtube') {
            // Driven by YT.PlayerState events set on window._ytIsPlaying
            isPlaying = !!window._ytIsPlaying;
        } else {
            // Native <video> element
            const player = document.getElementById('kid-modal-player');
            if (!player) return;
            isPlaying = !player.paused && !player.ended;
        }

        if (isPlaying) {
            _elapsedPlayTime++;
            if (_elapsedPlayTime >= thresholdSeconds && !_isRewardClaimed) {
                _isRewardClaimed = true;
                _claimReward();
            }
        }
    }, 1000);

    // Heartbeat every 10s to ensure active session
    _heartbeatInterval = setInterval(_heartbeat, 10000);
}

function _stopRewardTracking() {
    if (_rewardInterval) clearInterval(_rewardInterval);
    if (_heartbeatInterval) clearInterval(_heartbeatInterval);
    _rewardInterval = null;
    _heartbeatInterval = null;
    _currentVideoId = null;
    // FIX: Reset YouTube play-state flag and destroy the YT player instance cleanly
    window._ytIsPlaying = false;
    if (_ytPlayer) {
        try { _ytPlayer.destroy(); } catch (e) {}
        _ytPlayer = null;
    }
}

function _heartbeat() {
    const session = _getChildSession();
    if (!session || !session.$id) return;
    console.log('💓 Heartbeat... Kid is still here.');
}

async function _claimReward() {
    const session = _getChildSession();
    if (!session || !session.$id || !_currentVideoId) return;

    try {
        const reward = await DataService.recordVideoReward(session.$id, _currentVideoId, _currentPointsValue);
        _rewardedVideoIds.add(_currentVideoId);
        
        // Bug 1 Fix: After a successful DB update, sync the new totalPoints value back into
        // sessionStorage so that on page refresh, DataService.getCurrentUser() reads the
        // correct (updated) value from sessionStorage instead of the stale one.
        const freshSession = _getChildSession();
        if (freshSession) {
            freshSession.totalPoints = (freshSession.totalPoints || 0) + _currentPointsValue;
            sessionStorage.setItem('cubby_child_session', JSON.stringify(freshSession));
            console.log(`✅ [Rewards] sessionStorage totalPoints synced to: ${freshSession.totalPoints}`);
        }

        // If within a Learning Path, update progress
        if (_currentPathId) {
            console.log(`🛣️ Updating progress for path: ${_currentPathId}`);
            try {
                await DataService.updatePathProgress(session.$id, _currentPathId, _currentVideoId);
            } catch (pathErr) {
                console.warn('Path progress update failed:', pathErr.message);
            }
        }

        // Update header UI
        const pointsVal = document.getElementById('header-total-points');
        if (pointsVal) {
            const current = parseInt(pointsVal.textContent) || 0;
            pointsVal.textContent = current + _currentPointsValue;
        }

        showRewardCelebration(_currentPointsValue);
        
        // Refresh video card badges
        loadKidVideos(); 

    } catch (e) {
        console.error('Reward claim failed:', e.message);
    }
}

function showRewardCelebration(points) {
    // FIX: The static DOM modal doesn't exist, so we dynamically build and inject
    // a self-contained celebration popup with CSS confetti animation.
    // It auto-removes after 4 seconds.

    // Remove any lingering celebration from a previous trigger
    const existing = document.getElementById('cubby-reward-celebration');
    if (existing) existing.remove();

    // Build confetti particles (Chunky playful colors)
    const confettiColors = ['#f43f5e', '#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];
    const confettiPieces = Array.from({ length: 40 }, (_, i) => {
        const color = confettiColors[i % confettiColors.length];
        const left = Math.random() * 100;
        const delay = (Math.random() * 0.6).toFixed(2);
        const size = (Math.random() * 12 + 10).toFixed(0);
        const rotation = Math.round(Math.random() * 360);
        const isCircle = Math.random() > 0.5;
        return `<div style="
            position:absolute;
            left:${left}%;
            top:-20px;
            width:${size}px;
            height:${size}px;
            background:${color};
            border: 3px solid #0f172a;
            border-radius:${isCircle ? '50%' : '4px'};
            animation: cubby-fall 1.5s ${delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            transform: rotate(${rotation}deg);
            opacity:0;
        "></div>`;
    }).join('');

    // Build the popup HTML with inline styles (no Tailwind dependency inside the popup)
    const popup = document.createElement('div');
    popup.id = 'cubby-reward-celebration';
    popup.innerHTML = `
        <style>
            @keyframes cubby-fall {
                0%   { transform: translateY(0px) rotate(0deg);   opacity: 1; }
                100% { transform: translateY(500px) rotate(1080deg); opacity: 0; }
            }
            @keyframes cubby-toy-pop {
                0%   { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
                100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
            }
            @keyframes cubby-star-bounce {
                0%, 100% { transform: translateY(0) scale(1) rotate(-10deg); }
                50%      { transform: translateY(-16px) scale(1.15) rotate(10deg); }
            }
            @keyframes cubby-fade-out {
                0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
            /* Google Fonts for playful look if available, else falls back to system display font */
            @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&display=swap');
        </style>

        <!-- Overlay backdrop -->
        <div style="
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
        ">
            <!-- Confetti layer -->
            <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:100000;">
                ${confettiPieces}
            </div>

            <!-- Neo-brutalist Toybox Card -->
            <div style="
                position: absolute;
                top: 50%; left: 50%;
                z-index: 100001;
                transform: translate(-50%, -50%) scale(1);
                animation: cubby-toy-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
                background: #ffffff;
                border: 8px solid #0f172a;
                border-radius: 48px;
                padding: 48px 40px;
                text-align: center;
                box-shadow: 0 16px 0 #0f172a, 0 32px 64px rgba(0,0,0,0.4);
                min-width: 320px;
                max-width: 90vw;
            ">
                <!-- Bouncing star sticker -->
                <div style="
                    font-size: 72px;
                    animation: cubby-star-bounce 1.5s ease-in-out infinite;
                    display: inline-block;
                    margin-bottom: 16px;
                    filter: drop-shadow(0 8px 0 rgba(0,0,0,0.15));
                ">🌟</div>

                <!-- Playful text -->
                <div style="
                    color: #ec4899;
                    font-size: 16px;
                    font-weight: 900;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                    font-family: 'Fredoka One', system-ui, -apple-system, sans-serif;
                ">You did it!</div>

                <!-- Giant comic-style points -->
                <div style="
                    color: #fde047;
                    font-size: 52px;
                    font-weight: 900;
                    font-family: 'Fredoka One', system-ui, -apple-system, sans-serif;
                    line-height: 1.1;
                    letter-spacing: -2px;
                    -webkit-text-stroke: 4px #0f172a;
                    text-shadow: 6px 6px 0 #0f172a;
                    margin-bottom: 16px;
                ">+${points} STARS</div>

                <!-- Subtitle pill -->
                <div style="
                    display: inline-block;
                    background: #f1f5f9;
                    border: 3px solid #0f172a;
                    border-radius: 99px;
                    padding: 8px 24px;
                    color: #334155;
                    font-size: 15px;
                    font-weight: 800;
                    font-family: system-ui, -apple-system, sans-serif;
                    box-shadow: 0 4px 0 #0f172a;
                ">Video Complete! 🚀</div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Auto-remove after 4.5 seconds with a fade-out
    setTimeout(() => {
        if (popup && popup.parentNode) {
             const card = popup.querySelector('div:nth-child(2)');
             if (card) {
                 card.style.animation = 'cubby-fade-out 0.4s ease-in forwards';
             }
             popup.style.transition = 'opacity 0.4s ease';
             popup.style.opacity = '0';
             setTimeout(() => { if (popup.parentNode) popup.remove(); }, 400);
        }
    }, 4000);
}

// ═════════════════════════════════════════════════════════════════════════════
// GAMES SYSTEM — Famobi Embed Grid + Full-Screen Modal + Anti-Cheat Timer
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GAME CATALOG
 * Each object represents one embeddable Famobi HTML5 game.
 *
 * Fields:
 *   id        – unique key used as the element ID suffix
 *   title     – display name
 *   category  – genre tag shown on the card
 *   embedUrl  – the Famobi embed URL loaded inside the iframe
 *   thumb     – thumbnail shown on the card (Famobi CDN preview or placeholder)
 *   color     – card accent color (Tailwind value used inside the inline-style)
 *   border    – border-color hex for the 3-D card shadow
 *   shadow    – box-shadow bottom hex
 */
const GAMES_CATALOG = [
    {
        id: 'jewel-burst',
        title: 'Jewel Burst',
        category: 'Puzzle',
        embedUrl: 'https://play.famobi.com/jewel-burst',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/JewelBurstTeaser.jpg',
        color: '#c084fc', border: '#a855f7', shadow: '#7e22ce'
    },
    {
        id: 'bubble-woods',
        title: 'Bubble Woods',
        category: 'Casual',
        embedUrl: 'https://play.famobi.com/bubble-woods',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/BubbleWoodsTeaser.jpg',
        color: '#86efac', border: '#4ade80', shadow: '#16a34a'
    },
    {
        id: 'knife-smash',
        title: 'Knife Smash',
        category: 'Skill',
        embedUrl: 'https://play.famobi.com/knife-smash',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/KnifeSmashTeaser.jpg',
        color: '#fca5a5', border: '#f87171', shadow: '#dc2626'
    },
    {
        id: 'subway-surfers',
        title: 'Subway Surfers',
        category: 'Runner',
        embedUrl: 'https://play.famobi.com/subway-surfers',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/SubwaySurfersTeaser.jpg',
        color: '#93c5fd', border: '#60a5fa', shadow: '#2563eb'
    },
    {
        id: 'solitaire',
        title: 'Classic Solitaire',
        category: 'Cards',
        embedUrl: 'https://play.famobi.com/solitaire',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/SolitaireTeaser.jpg',
        color: '#6ee7b7', border: '#34d399', shadow: '#059669'
    },
    {
        id: 'snake-and-ladders',
        title: 'Snake & Ladders',
        category: 'Board',
        embedUrl: 'https://play.famobi.com/snake-and-ladders',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/SnakeLaddersTeaser.jpg',
        color: '#fde68a', border: '#fbbf24', shadow: '#b45309'
    },
    {
        id: 'candy-bubble',
        title: 'Candy Bubble',
        category: 'Puzzle',
        embedUrl: 'https://play.famobi.com/candy-bubble',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/CandyBubbleTeaser.jpg',
        color: '#fbcfe8', border: '#f472b6', shadow: '#be185d'
    },
    {
        id: 'mahjong-alchemy',
        title: 'Mahjong Alchemy',
        category: 'Strategy',
        embedUrl: 'https://play.famobi.com/mahjong-alchemy',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/MahjongAlchemyTeaser.jpg',
        color: '#fed7aa', border: '#fb923c', shadow: '#c2410c'
    },
    {
        id: 'magic-tower',
        title: 'Magic Tower',
        category: 'Adventure',
        embedUrl: 'https://play.famobi.com/magic-tower',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/MagicTowerTeaser.jpg',
        color: '#bfdbfe', border: '#60a5fa', shadow: '#1d4ed8'
    },
    {
        id: 'galaxy-attack',
        title: 'Galaxy Attack',
        category: 'Shooter',
        embedUrl: 'https://play.famobi.com/galaxy-attack',
        thumb: 'https://img.famobi.com/portal/html5games/images/tmp/GalaxyAttackTeaser.jpg',
        color: '#a5b4fc', border: '#818cf8', shadow: '#4338ca'
    },
];

/**
 * renderGamesGrid()
 * Loops over GAMES_CATALOG and injects game cards into the element
 * with id="games-grid-container". Compatible with both games.html and
 * the Quick Games section on home_logged_in.html.
 */
function renderGamesGrid() {
    const container = document.getElementById('games-grid-container');
    if (!container) return;

    container.innerHTML = GAMES_CATALOG.map(game => _buildGameCard(game)).join('');
}

/**
 * Build a single game card HTML string matching the site's neo-brutalist style.
 * @param {Object} game - An entry from GAMES_CATALOG
 * @returns {string} HTML string
 */
function _buildGameCard(game) {
    // Fallback thumbnail using DiceBear identicon if Famobi image fails to load
    const fallbackThumb = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(game.id)}`;

    return `
        <div id="game-card-${game.id}"
             class="game-card group cursor-pointer rounded-3xl p-[5px] transition-all hover:translate-y-1 active:translate-y-2 active:shadow-none flex flex-col"
             style="background:${game.color}; border: 5px solid ${game.border}; box-shadow: 0 6px 0 ${game.shadow};"
             onclick="openGameModal('${game.id}')"
             role="button"
             aria-label="Play ${game.title}">
            <div class="bg-white rounded-[20px] overflow-hidden flex flex-col h-full">
                <!-- Thumbnail -->
                <div class="relative w-full aspect-video overflow-hidden bg-gray-100">
                    <img
                        src="${game.thumb}"
                        alt="${game.title}"
                        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onerror="this.src='${fallbackThumb}'; this.style.padding='12px';"
                    >
                    <!-- Category pill -->
                    <span class="absolute bottom-2 left-2 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm"
                          style="background:${game.shadow};">
                        ${game.category}
                    </span>
                    <!-- Play overlay on hover -->
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div class="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center shadow-xl">
                            <i class="fa-solid fa-play text-2xl ml-1" style="color:${game.shadow};"></i>
                        </div>
                    </div>
                </div>
                <!-- Info -->
                <div class="flex-1 flex flex-col items-center justify-center p-3 text-center"
                     style="background:${game.color}18;">
                    <h3 class="font-extrabold text-gray-800 text-sm leading-tight drop-shadow-sm">
                        ${game.title}
                    </h3>
                    <!-- Timer hint -->
                    <p class="text-[10px] font-bold mt-1 opacity-60" style="color:${game.shadow};">
                        <i class="fa-solid fa-star text-[8px]"></i> Play 3 min → +10 Stars
                    </p>
                </div>
            </div>
        </div>`;
}

// ─── Game Player Modal ────────────────────────────────────────────────────────

/**
 * openGameModal(gameId)
 * Creates a full-screen game-player modal containing a sandboxed iframe.
 * Also starts the anti-cheat playtime reward timer.
 *
 * @param {string} gameId - Must match a game's `id` field in GAMES_CATALOG
 */
window.openGameModal = function (gameId) {
    // Find the game definition
    const game = GAMES_CATALOG.find(g => g.id === gameId);
    if (!game) { console.warn('[Games] Unknown game id:', gameId); return; }

    // Destroy any existing game modal first (prevents stacking)
    const existing = document.getElementById('kid-game-modal');
    if (existing) {
        _stopGameRewardTracking();
        existing.remove();
        document.body.style.overflow = '';
    }

    const modal = document.createElement('div');
    modal.id = 'kid-game-modal';
    // Full-screen overlay — z-index above the nav/sidebar but below the celebration popup
    modal.style.cssText = `
        position: fixed; inset: 0; z-index: 200;
        display: flex; flex-direction: column;
        background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
    `;

    modal.innerHTML = `
        <!-- ══ Header Bar ══════════════════════════════════════════════════ -->
        <div id="game-modal-header" style="
            display: flex; align-items: center; justify-content: space-between;
            padding: 12px 20px;
            background: rgba(255,255,255,0.08);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(255,255,255,0.12);
            flex-shrink: 0;
        ">
            <!-- Left: Title + category -->
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="
                    width:40px; height:40px; border-radius:50%;
                    background:${game.color}30;
                    border: 2px solid ${game.color};
                    display:flex; align-items:center; justify-content:center;
                ">
                    <i class="fa-solid fa-gamepad" style="color:${game.color}; font-size:16px;"></i>
                </div>
                <div>
                    <p style="color:white; font-weight:900; font-size:16px; margin:0; line-height:1.2;">${game.title}</p>
                    <p style="color:rgba(255,255,255,0.5); font-size:11px; font-weight:700; margin:0;">${game.category}</p>
                </div>
            </div>

            <!-- Center: Play-time progress bar + countdown -->
            <div id="game-timer-ui" style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; max-width:320px; margin: 0 24px;">
                <div style="display:flex; align-items:center; gap:8px; width:100%;">
                    <i class="fa-solid fa-star" style="color:#fde047; font-size:13px;"></i>
                    <div style="flex:1; height:8px; background:rgba(255,255,255,0.15); border-radius:99px; overflow:hidden;">
                        <div id="game-progress-bar" style="
                            height:100%; width:0%;
                            background: linear-gradient(90deg, #fde047, #f59e0b);
                            border-radius:99px;
                            transition: width 1s linear;
                        "></div>
                    </div>
                    <span id="game-timer-label" style="color:rgba(255,255,255,0.7); font-size:11px; font-weight:800; white-space:nowrap;">0:00 / 3:00</span>
                </div>
                <div id="game-idle-badge" style="
                    display:none; background:#f97316; color:white;
                    font-size:10px; font-weight:900; padding:2px 10px;
                    border-radius:99px; letter-spacing:0.5px;
                ">
                    <i class="fa-solid fa-pause"></i> Paused — Move to resume!
                </div>
            </div>

            <!-- Right: Close button -->
            <button id="game-close-btn"
                onclick="closeGameModal()"
                style="
                    background: rgba(239,68,68,0.2);
                    border: 2px solid rgba(239,68,68,0.5);
                    color: #fca5a5;
                    font-weight: 900;
                    font-size: 13px;
                    padding: 8px 18px;
                    border-radius: 99px;
                    cursor: pointer;
                    display: flex; align-items: center; gap: 6px;
                    transition: background 0.2s;
                    font-family: inherit;
                "
                onmouseover="this.style.background='rgba(239,68,68,0.4)'"
                onmouseout="this.style.background='rgba(239,68,68,0.2)'"
                aria-label="Close Game">
                <i class="fa-solid fa-times"></i> Close Game
            </button>
        </div>

        <!-- ══ Game IFrame ═════════════════════════════════════════════════ -->
        <div style="flex:1; position:relative; overflow:hidden;">
            <iframe
                id="game-iframe"
                src="${game.embedUrl}"
                style="width:100%; height:100%; border:none; display:block;"
                allow="autoplay; fullscreen; accelerometer; gyroscope; payment"
                allowfullscreen
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-pointer-lock"
                title="${game.title}"
                loading="eager"
            ></iframe>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Start the anti-cheat playtime tracker
    _startGameRewardTracking(game);
};

/**
 * closeGameModal()
 * Destroys the game iframe (to stop audio/music) and clears all timers.
 * If the reward was already claimed, progress is kept — no double-awarding.
 */
window.closeGameModal = function () {
    _stopGameRewardTracking();

    const modal = document.getElementById('kid-game-modal');
    if (modal) {
        // Src-nulling destroys the iframe's browsing context → stops audio immediately
        const iframe = document.getElementById('game-iframe');
        if (iframe) iframe.src = 'about:blank';

        modal.remove();
        document.body.style.overflow = '';
    }
};

// ─── Anti-Cheat Time-Based Reward Engine ─────────────────────────────────────
//
// Design:
//   • _gamePlayInterval  – ticks every 1 s; accumulates "active" seconds.
//   • _gameIdleTimeout   – resets on every activity event; fires after 30 s of
//                          silence to pause the accumulator (sets _gameIsIdle).
//   • Activity events: mousemove, touchstart, touchmove, keydown, click.
//
// Earning flow:
//   1. Kid opens a game  → _gamePlayInterval starts, _gameIsIdle = false.
//   2. Kid goes quiet    → _gameIdleTimeout fires after 30 s → _gameIsIdle = true.
//   3. Kid acts again    → activity handler resets timeout, _gameIsIdle = false.
//   4. _gamePlayInterval only counts seconds when _gameIsIdle === false.
//   5. When active seconds reach GAME_REWARD_THRESHOLD_S → _claimGameReward().

const GAME_REWARD_THRESHOLD_S = 180; // 3 minutes of active, non-idle playtime
const GAME_IDLE_TIMEOUT_MS    = 30000; // 30 s idle window before pausing timer

let _gamePlayInterval  = null; // setInterval handle — 1-second tick
let _gameIdleTimeout   = null; // setTimeout handle — 30-second idle sentinel
let _gameActiveSeconds = 0;    // accumulated active (non-idle) seconds
let _gameIsIdle        = false; // true when the idle sentinel has fired
let _gameRewardClaimed = false; // guard against double-awarding in one session
let _currentGameId     = null;  // id of the currently tracked game

/**
 * _startGameRewardTracking(game)
 * Initialise all state for a fresh game session and wire up activity listeners.
 *
 * @param {Object} game - Entry from GAMES_CATALOG
 */
function _startGameRewardTracking(game) {
    // Clean slate for this session
    _gameActiveSeconds = 0;
    _gameIsIdle        = false;
    _gameRewardClaimed = false;
    _currentGameId     = game.id;

    console.log(`[Games] 🎮 Tracking started for "${game.title}". Need ${GAME_REWARD_THRESHOLD_S}s of active play.`);

    // ── Activity listener ──────────────────────────────────────────────────
    // Attached to `document` so it fires even when the cursor leave the iframe
    // (cross-origin iframes do NOT forward pointer events, so activity inside
    //  the game itself does not count — the kid must interact with the page
    //  wrapper or move the mouse in the host document).
    //
    // IMPORTANT: We also listen for `blur`/`focus` on the window so that if
    // the kid alt-tabs away the idle timer fires normally.
    const _onActivity = () => {
        if (_gameIsIdle) {
            _gameIsIdle = false;
            // Hide the "Paused" badge
            const badge = document.getElementById('game-idle-badge');
            if (badge) badge.style.display = 'none';
            console.log('[Games] ▶ Timer resumed (activity detected).');
        }
        // Reset the idle sentinel on every interaction
        clearTimeout(_gameIdleTimeout);
        _gameIdleTimeout = setTimeout(_onIdle, GAME_IDLE_TIMEOUT_MS);
    };

    const _onIdle = () => {
        _gameIsIdle = true;
        // Show the "Paused" badge in the modal header
        const badge = document.getElementById('game-idle-badge');
        if (badge) badge.style.display = 'block';
        console.log('[Games] ⏸ Timer paused — no activity for 30 s.');
    };

    // Store refs on window so _stopGameRewardTracking can remove them
    window._gameActivityHandler = _onActivity;

    ['mousemove', 'touchstart', 'touchmove', 'keydown', 'click', 'pointerdown'].forEach(evt => {
        document.addEventListener(evt, _onActivity, { passive: true });
    });

    // Arm initial idle sentinel (kid has 30 s to interact before the timer pauses)
    _gameIdleTimeout = setTimeout(_onIdle, GAME_IDLE_TIMEOUT_MS);

    // ── 1-second accumulator tick ──────────────────────────────────────────
    _gamePlayInterval = setInterval(() => {
        // Only count while the modal still exists and the kid is not idle
        if (!document.getElementById('kid-game-modal')) {
            _stopGameRewardTracking();
            return;
        }

        if (!_gameIsIdle) {
            _gameActiveSeconds++;
        }

        // Update UI: progress bar and label
        const pct   = Math.min((_gameActiveSeconds / GAME_REWARD_THRESHOLD_S) * 100, 100);
        const bar   = document.getElementById('game-progress-bar');
        const label = document.getElementById('game-timer-label');
        if (bar)   bar.style.width = `${pct}%`;
        if (label) {
            const mins = Math.floor(_gameActiveSeconds / 60);
            const secs = _gameActiveSeconds % 60;
            label.textContent = `${mins}:${String(secs).padStart(2, '0')} / 3:00`;
        }

        // Check reward threshold
        if (_gameActiveSeconds >= GAME_REWARD_THRESHOLD_S && !_gameRewardClaimed) {
            _gameRewardClaimed = true;
            _claimGameReward();
        }
    }, 1000);
}

/**
 * _stopGameRewardTracking()
 * Clears all timers and activity listeners. Safe to call multiple times.
 */
function _stopGameRewardTracking() {
    if (_gamePlayInterval) { clearInterval(_gamePlayInterval); _gamePlayInterval = null; }
    if (_gameIdleTimeout)  { clearTimeout(_gameIdleTimeout);  _gameIdleTimeout  = null; }

    // Remove activity listeners
    if (window._gameActivityHandler) {
        ['mousemove', 'touchstart', 'touchmove', 'keydown', 'click', 'pointerdown'].forEach(evt => {
            document.removeEventListener(evt, window._gameActivityHandler);
        });
        window._gameActivityHandler = null;
    }

    _gameActiveSeconds = 0;
    _gameIsIdle        = false;
    _currentGameId     = null;

    console.log('[Games] ⏹ Reward tracking stopped.');
}

/**
 * _claimGameReward()
 * Awards 10 stars via the same DataService path used by video rewards.
 * Shows the celebration modal layered over the game session so the kid
 * sees the reward immediately, then they can choose to keep playing.
 */
async function _claimGameReward() {
    const session = _getChildSession();
    if (!session || !session.$id) return;

    const GAME_POINTS = 10;

    console.log('[Games] 🌟 3-minute threshold reached! Awarding', GAME_POINTS, 'stars.');

    try {
        // Re-use the same DataService reward recorder as video completions.
        // We use `rewardType: 'game_play'` and source the current game id.
        await DataService.recordVideoReward(session.$id, `game_${_currentGameId}`, GAME_POINTS);

        // Sync points into sessionStorage immediately (same fix as video rewards)
        const freshSession = _getChildSession();
        if (freshSession) {
            freshSession.totalPoints = (freshSession.totalPoints || 0) + GAME_POINTS;
            sessionStorage.setItem('cubby_child_session', JSON.stringify(freshSession));
        }

        // Update the header star counter
        const pointsVal = document.getElementById('header-total-points');
        if (pointsVal) {
            pointsVal.textContent = (parseInt(pointsVal.textContent) || 0) + GAME_POINTS;
        }

        // Show the existing neo-brutalist celebration popup (from showRewardCelebration)
        // It renders over the game modal because z-index 99999 > game modal's 200.
        showRewardCelebration(GAME_POINTS);

        // Stop the interval — reward has been claimed, no more ticking needed
        _stopGameRewardTracking();

    } catch (e) {
        console.error('[Games] Reward claim failed:', e.message);
        // On failure, reset the guard so the kid can earn it again if they replay
        _gameRewardClaimed = false;
    }
}

// ─── Recommendation Logic ────────────────────────────────────────────────────
function _buildRecommendations(currentVideo) {
    if (!_allApprovedVideos || _allApprovedVideos.length === 0) return '<p class="text-gray-500 text-sm">No recommendations yet.</p>';

    // Prioritize same category, then fallback to others
    const sameCategory = _allApprovedVideos.filter(v => v.$id !== currentVideo.$id && v.category === currentVideo.category);
    const otherCategory = _allApprovedVideos.filter(v => v.$id !== currentVideo.$id && v.category !== currentVideo.category);

    // Shuffle the "other" to add variety
    for (let i = otherCategory.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [otherCategory[i], otherCategory[j]] = [otherCategory[j], otherCategory[i]];
    }

    const recommended = [...sameCategory, ...otherCategory].slice(0, 15);

    if (recommended.length === 0) return '<p class="text-gray-500 text-sm">No more videos available.</p>';

    return recommended.map(v => {
        const yt = v.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        let thumbSrc;
        if (v.thumbnailUrl) thumbSrc = v.thumbnailUrl;
        else if (yt) thumbSrc = `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
        else thumbSrc = '';

        const thumbEl = thumbSrc
            ? `<img src="${thumbSrc}" class="w-full h-full object-cover" alt="${v.title}">`
            : `<div class="w-full h-full bg-gray-700 flex items-center justify-center"><i class="fa-solid fa-film text-gray-500 text-xl"></i></div>`;

        return `
            <div class="flex gap-3 cursor-pointer group hover:bg-white/5 rounded-xl p-2 transition-colors"
                 onclick="document.getElementById('kid-video-modal').remove(); document.body.style.overflow=''; openKidVideoModal('${v.$id}', _currentPathId)">
                <div class="w-40 min-w-[160px] aspect-video rounded-lg overflow-hidden bg-gray-800 relative flex-shrink-0">
                    ${thumbEl}
                    <span class="absolute bottom-1 right-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">${v.category || 'Video'}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="text-white text-xs font-bold line-clamp-2 group-hover:text-cubby-blue transition-colors leading-tight">${v.title}</h4>
                    <p class="text-gray-500 text-[10px] font-semibold mt-1">${v.creatorEmail ? v.creatorEmail.split('@')[0] : 'Creator'}</p>
                    <p class="text-gray-600 text-[10px] mt-0.5">${(v.views || 0).toLocaleString()} views</p>
                </div>
            </div>`;
    }).join('');
}

// ─── Action Button Handlers ──────────────────────────────────────────────────
window._kidLikeVideo = async function (videoId) {
    // Guard: one like per video per session
    if (_likedVideoIds.has(videoId)) return;
    _likedVideoIds.add(videoId);

    // Visually disable the like button immediately so double-tap has no effect
    const likeBtn = document.querySelector(`button[onclick="window._kidLikeVideo('${videoId}')"]`);
    if (likeBtn) {
        likeBtn.disabled = true;
        likeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const updated = await DataService.likeVideo(videoId);
        const el = document.getElementById('kid-like-count');
        if (el && updated) el.textContent = updated.likes;
    } catch (e) {
        // Roll back guard on failure so the user can retry
        _likedVideoIds.delete(videoId);
        if (likeBtn) {
            likeBtn.disabled = false;
            likeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        console.warn(e);
    }
};

window._kidDislikeVideo = async function (videoId) {
    // Guard: one dislike per video per session
    if (_dislikedVideoIds.has(videoId)) return;
    _dislikedVideoIds.add(videoId);

    // Visually disable the dislike button immediately
    const dislikeBtn = document.querySelector(`button[onclick="window._kidDislikeVideo('${videoId}')"]`);
    if (dislikeBtn) {
        dislikeBtn.disabled = true;
        dislikeBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const updated = await DataService.dislikeVideo(videoId);
        const el = document.getElementById('kid-dislike-count');
        if (el && updated) el.textContent = updated.dislikes;
    } catch (e) {
        // Roll back guard on failure so the user can retry
        _dislikedVideoIds.delete(videoId);
        if (dislikeBtn) {
            dislikeBtn.disabled = false;
            dislikeBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        console.warn(e);
    }
};

window._kidToggleFavorite = async function (videoId, title, category, url, thumbUrl) {
    const session = _getChildSession();
    if (!session?.$id) return;

    const btn = document.getElementById('kid-fav-btn');
    const isFav = await DataService.isFavorited(session.$id, videoId);

    if (isFav) {
        await DataService.removeFavorite(session.$id, videoId);
        if (btn) {
            btn.classList.remove('bg-cubby-pink');
            btn.classList.add('bg-gray-800');
            btn.innerHTML = '<i class="fa-solid fa-heart"></i> Favorite';
        }
    } else {
        await DataService.addFavorite(session.$id, videoId, title, category, url, thumbUrl);
        if (btn) {
            btn.classList.add('bg-cubby-pink');
            btn.classList.remove('bg-gray-800');
            btn.innerHTML = '<i class="fa-solid fa-heart"></i> Favorited';
        }
    }
};

window._kidShareVideo = function (url) {
    if (navigator.share) {
        navigator.share({ title: 'Check out this video on CubbyCove!', url: url }).catch(() => { });
    } else {
        navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => { });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY PAGE
// ─────────────────────────────────────────────────────────────────────────────
async function loadHistoryPage() {
    const container = document.getElementById('history-video-list');
    const filterEl = document.getElementById('history-filter');
    if (!container) return;

    const session = _getChildSession();
    if (!session?.$id) {
        container.innerHTML = '<p class="text-gray-400 font-semibold text-center py-12">Please log in to see your history.</p>';
        return;
    }

    const filter = filterEl ? filterEl.value : 'today';

    container.innerHTML = '<div class="text-center py-12"><i class="fa-solid fa-spinner fa-spin text-3xl text-cubby-blue"></i></div>';

    try {
        // Also fetch approved videos to populate the cache for modal recommendations
        if (_allApprovedVideos.length === 0) {
            try { _allApprovedVideos = await DataService.getVideos('approved') || []; } catch (e) { }
        }

        const history = await DataService.getWatchHistory(session.$id, filter);

        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-clock-rotate-left text-gray-300 text-3xl"></i>
                    </div>
                    <p class="text-gray-500 font-bold text-lg">No videos watched yet</p>
                    <p class="text-gray-400 text-sm mt-1">Your watch history will appear here!</p>
                </div>`;
            return;
        }

        // Group by date
        const groups = {};
        history.forEach(h => {
            const dateKey = new Date(h.watchedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(h);
        });

        let html = '';
        for (const [date, items] of Object.entries(groups)) {
            html += `<div class="mb-6">
                <h3 class="text-lg font-extrabold text-gray-700 mb-3 flex items-center gap-2">
                    <i class="fa-regular fa-calendar text-cubby-blue"></i> ${date}
                </h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">`;

            // Deduplicate within same day
            const seen = new Set();
            items.forEach(h => {
                if (seen.has(h.videoId)) return;
                seen.add(h.videoId);
                const fakeVideo = { $id: h.videoId, title: h.videoTitle, url: h.videoUrl, category: h.videoCategory, thumbnailUrl: h.thumbnailUrl, creatorEmail: '' };
                html += _buildVideoCard(fakeVideo, 'min-w-0 max-w-none');
            });

            html += `</div></div>`;
        }

        container.innerHTML = html;
    } catch (e) {
        console.error('History page error:', e);
        container.innerHTML = '<p class="text-red-400 font-bold text-center py-12">Error loading history.</p>';
    }
}

// Filter change handler
window.changeHistoryFilter = function () {
    loadHistoryPage();
};

// ─────────────────────────────────────────────────────────────────────────────
// FAVORITES PAGE
// ─────────────────────────────────────────────────────────────────────────────
async function loadFavoritesPage() {
    const container = document.getElementById('favorites-video-list');
    if (!container) return;

    const session = _getChildSession();
    if (!session?.$id) {
        container.innerHTML = '<p class="text-gray-400 font-semibold text-center py-12">Please log in to see your favorites.</p>';
        return;
    }

    container.innerHTML = '<div class="text-center py-12"><i class="fa-solid fa-spinner fa-spin text-3xl text-cubby-pink"></i></div>';

    try {
        // Also fetch approved videos to populate the cache for modal recommendations
        if (_allApprovedVideos.length === 0) {
            try { _allApprovedVideos = await DataService.getVideos('approved') || []; } catch (e) { }
        }

        const favorites = await DataService.getFavorites(session.$id);

        if (!favorites || favorites.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <div class="w-20 h-20 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-heart text-cubby-pink text-3xl"></i>
                    </div>
                    <p class="text-gray-500 font-bold text-lg">No favorites yet</p>
                    <p class="text-gray-400 text-sm mt-1">Tap the ❤️ button on any video to add it here!</p>
                </div>`;
            return;
        }

        container.innerHTML = favorites.map(f => {
            const fakeVideo = { $id: f.videoId, title: f.videoTitle, url: f.videoUrl, category: f.videoCategory, thumbnailUrl: f.thumbnailUrl, creatorEmail: '' };
            return _buildVideoCard(fakeVideo, 'min-w-0 max-w-none');
        }).join('');
    } catch (e) {
        console.error('Favorites page error:', e);
        container.innerHTML = '<p class="text-red-400 font-bold text-center py-12">Error loading favorites.</p>';
    }
}

// Check if DataService is missing
if (typeof DataService === 'undefined') {
    console.warn("CRITICAL: DataService.js is missing from this page!");
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
window.handleKidLogout = async function () {
    await flushScreenTime();
    const session = _getChildSession();
    if (session && session.$id) {
        try { await DataService.updateChildPrefs(session.$id, { isOnline: false }); } catch (e) {}
    }
    try { await DataService.logout(); } catch (e) { console.warn("Logout error:", e); }
    window.location.href = '../index.html';
};

// ─────────────────────────────────────────────────────────────────────────────
// CUBBY SHOP — Item Catalog
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Defines which items are free (cost: 0) and which are premium (cost: stars).
 * category: 'color' | 'icon' | 'theme'
 * value: the actual value passed to pickAvatarColor / pickAvatarIcon / pickTheme
 */
const SHOP_CONFIG = {
    // ── Avatar Colors (first 4 are FREE) ───────────────────────────────────────
    'color_ef4444': { cost: 0,   category: 'color', value: '#ef4444', label: 'Cherry Red' },
    'color_f97316': { cost: 0,   category: 'color', value: '#f97316', label: 'Sunset Orange' },
    'color_eab308': { cost: 0,   category: 'color', value: '#eab308', label: 'Lemon Yellow' },
    'color_22c55e': { cost: 0,   category: 'color', value: '#22c55e', label: 'Grass Green' },
    // Premium colors (50 stars each)
    'color_3b82f6': { cost: 50,  category: 'color', value: '#3b82f6', label: 'Ocean Blue' },
    'color_8b5cf6': { cost: 50,  category: 'color', value: '#8b5cf6', label: 'Royal Violet' },
    'color_ec4899': { cost: 50,  category: 'color', value: '#ec4899', label: 'Bubblegum Pink' },
    'color_14b8a6': { cost: 50,  category: 'color', value: '#14b8a6', label: 'Aqua Teal' },
    // ── Avatar Icons (first 4 are FREE) ────────────────────────────────────────
    'icon_1':  { cost: 0,   category: 'icon', value: '../images/avatars/icon (1).png' },
    'icon_2':  { cost: 0,   category: 'icon', value: '../images/avatars/icon (2).png' },
    'icon_3':  { cost: 0,   category: 'icon', value: '../images/avatars/icon (3).png' },
    'icon_4':  { cost: 0,   category: 'icon', value: '../images/avatars/icon (4).png' },
    // Premium icons (75 stars each)
    'icon_5':  { cost: 75,  category: 'icon', value: '../images/avatars/icon (5).png' },
    'icon_6':  { cost: 75,  category: 'icon', value: '../images/avatars/icon (6).png' },
    'icon_7':  { cost: 75,  category: 'icon', value: '../images/avatars/icon (7).png' },
    'icon_8':  { cost: 75,  category: 'icon', value: '../images/avatars/icon (8).png' },
    'icon_9':  { cost: 75,  category: 'icon', value: '../images/avatars/icon (9).png' },
    'icon_10': { cost: 100, category: 'icon', value: '../images/avatars/icon (10).png' },
    'icon_11': { cost: 100, category: 'icon', value: '../images/avatars/icon (11).png' },
    'icon_12': { cost: 100, category: 'icon', value: '../images/avatars/icon (12).png' },
    'icon_13': { cost: 100, category: 'icon', value: '../images/avatars/icon (13).png' },
    'icon_14': { cost: 100, category: 'icon', value: '../images/avatars/icon (14).png' },
    // ── Themes (Default is FREE) ────────────────────────────────────────────────
    'theme_default':    { cost: 0,   category: 'theme', value: 'default',    label: 'Default' },
    'theme_cherry':     { cost: 0,   category: 'theme', value: 'cherry',     label: 'Cherry' },
    'theme_blueberry':  { cost: 0,   category: 'theme', value: 'blueberry',  label: 'Blueberry' },
    'theme_sunflower':  { cost: 150, category: 'theme', value: 'sunflower',  label: 'Sunflower ✨' },
};

/**
 * Returns the set of unlocked item IDs for the current session.
 * Always includes all free items (cost === 0).
 */
function _getUnlockedItems() {
    const session = _getChildSession();
    const purchased = session?.prefs?.unlockedItems || [];
    // Free items are always unlocked
    const freeItems = Object.keys(SHOP_CONFIG).filter(id => SHOP_CONFIG[id].cost === 0);
    return new Set([...freeItems, ...purchased]);
}

/**
 * Handles a purchase attempt for a locked shop item.
 * Deducts stars from sessionStorage and the database, then unlocks the item.
 */
async function _purchaseShopItem(itemId) {
    const item = SHOP_CONFIG[itemId];
    if (!item || item.cost === 0) return; // Item is free or unknown

    const session = _getChildSession();
    if (!session || !session.$id) return;

    const currentPoints = session.totalPoints || 0;
    if (currentPoints < item.cost) {
        const needed = item.cost - currentPoints;
        alert(`⭐ You need ${needed} more stars to unlock this!\n\nKeep watching videos to earn more stars! 🚀`);
        return;
    }

    // Show confirmation
    showConfirm(
        `Spend ${item.cost} ⭐ Stars to unlock this?`,
        async () => {
            try {
                // 1. Deduct from sessionStorage immediately for snappy UI
                const freshSession = _getChildSession();
                freshSession.totalPoints = (freshSession.totalPoints || 0) - item.cost;
                const currentUnlocked = freshSession.prefs?.unlockedItems || [];
                if (!freshSession.prefs) freshSession.prefs = {};
                freshSession.prefs.unlockedItems = [...new Set([...currentUnlocked, itemId])];
                sessionStorage.setItem('cubby_child_session', JSON.stringify(freshSession));

                // 2. Update points counter in the header UI
                const pointsVal = document.getElementById('header-total-points');
                if (pointsVal) pointsVal.textContent = freshSession.totalPoints;

                // 3. Persist point deduction and unlocked items list to the database
                await Promise.all([
                    DataService.updateChild(freshSession.$id, { totalPoints: freshSession.totalPoints }),
                    DataService.updateChildPrefs(freshSession.$id, { unlockedItems: freshSession.prefs.unlockedItems })
                ]);

                // 4. Apply the item immediately
                const cat = item.category;
                if (cat === 'color')  window._applyColorPick(item.value);
                if (cat === 'icon')   window._applyIconPick(item.value);
                if (cat === 'theme')  window._applyThemePick(item.value);

                // 5. Re-render the shop modal to reflect the new unlocked state
                _renderShopOverlays();

                alert(`🎉 Unlocked! You now have ${freshSession.totalPoints} ⭐ stars remaining.`);

            } catch (e) {
                // Roll back sessionStorage on DB failure
                console.error('[Shop] Purchase failed:', e.message);
                alert(`❌ Purchase failed: ${e.message}\n\nYour stars have been refunded.`);
                // Re-read from DB to undo the optimistic update
                try {
                    const doc = await DataService.getChildWithPrefs(session.$id);
                    if (doc) {
                        const rollbackSession = _getChildSession();
                        rollbackSession.totalPoints = doc.totalPoints;
                        if (doc.unlockedItems) {
                            if (!rollbackSession.prefs) rollbackSession.prefs = {};
                            rollbackSession.prefs.unlockedItems = doc.unlockedItems;
                        }
                        sessionStorage.setItem('cubby_child_session', JSON.stringify(rollbackSession));
                        if (pointsVal) pointsVal.textContent = rollbackSession.totalPoints;
                    }
                } catch (_) { /* silent */ }
            }
        }
    );
}

/**
 * Adds lock-icon overlays and star-cost badges to each shop item button.
 * Called when the settings modal opens and after each purchase.
 */
function _renderShopOverlays() {
    const unlocked = _getUnlockedItems();

    Object.entries(SHOP_CONFIG).forEach(([itemId, item]) => {
        const btn = document.querySelector(`[data-shop-id="${itemId}"]`);
        if (!btn) return;

        const isUnlocked = unlocked.has(itemId);
        const lockEl = btn.querySelector('.shop-lock-badge');
        if (!lockEl) return;

        if (isUnlocked) {
            lockEl.classList.add('hidden');
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            lockEl.classList.remove('hidden');
            lockEl.innerHTML = `<i class="fa-solid fa-lock text-[8px]"></i><span class="text-[8px] font-black">${item.cost}⭐</span>`;
            btn.classList.add('opacity-70');
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// KID PROFILE SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────────
let _kidAvatarColor = '#60a5fa';
let _kidAvatarIcon = '🐻';
let _kidCoverColor = '#3b82f6';
let _kidTheme = 'default';

// Internal: Apply values directly (used by purchases and free picks alike)
window._applyColorPick = function(color) {
    _kidAvatarColor = color;
    const preview = document.getElementById('kid-avatar-preview');
    if (preview) preview.style.background = color;
};
window._applyIconPick = function(icon) {
    _kidAvatarIcon = icon;
    const preview = document.getElementById('kid-avatar-preview');
    if (preview) {
        if (icon.startsWith('../')) preview.innerHTML = `<img src="${icon}" class="w-full h-full object-contain p-1">`;
        else preview.textContent = icon;
    }
};
window._applyThemePick = function(theme) {
    _kidTheme = theme;
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
    if (theme !== 'default') document.body.classList.add('theme-' + theme);
};

window.openKidSettingsModal = async function () {
    const modal = document.getElementById('kid-settings-modal');
    if (!modal) return;

    const session = _getChildSession();
    if (!session) return;

    // Always fetch latest prefs from DB so we don't show stale cached data.
    // Falls back to sessionStorage prefs if the DB fetch fails.
    let freshDoc = null;
    try {
        freshDoc = await DataService.getChildWithPrefs(session.$id);
    } catch (e) {
        console.warn('[openKidSettingsModal] Could not fetch fresh child doc:', e.message);
    }

    // Merge: DB doc first (freshest), then session prefs as fallback
    const sessionPrefs = session.prefs || {};
    _kidAvatarColor  = freshDoc?.avatarBgColor  || sessionPrefs.avatarBgColor  || '#60a5fa';
    _kidAvatarIcon   = freshDoc?.avatarIcon     || freshDoc?.avatarImage     || sessionPrefs.avatarIcon || '🐻';
    _kidCoverColor   = freshDoc?.coverColor     || sessionPrefs.coverColor   || '#3b82f6';
    _kidTheme        = freshDoc?.theme          || sessionPrefs.theme        || 'default';

    const displayName = freshDoc?.displayName || freshDoc?.name || sessionPrefs.displayName || session.name || '';
    const bio         = freshDoc?.bio          || sessionPrefs.bio          || '';

    const nameEl = document.getElementById('kid-display-name');
    const bioEl  = document.getElementById('kid-bio');
    if (nameEl) nameEl.value = displayName;
    if (bioEl)  bioEl.value  = bio;

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

    if (bioEl) {
        const countEl = document.getElementById('kid-bio-count');
        if (countEl) countEl.textContent = bioEl.value.length;
        bioEl.oninput = () => {
            const c = document.getElementById('kid-bio-count');
            if (c) c.textContent = bioEl.value.length;
        };
    }

    // Sync unlockedItems from DB doc into the session so _getUnlockedItems() is fresh
    if (freshDoc?.unlockedItems) {
        const refreshedSession = _getChildSession();
        if (refreshedSession) {
            if (!refreshedSession.prefs) refreshedSession.prefs = {};
            refreshedSession.prefs.unlockedItems = freshDoc.unlockedItems;
            sessionStorage.setItem('cubby_child_session', JSON.stringify(refreshedSession));
        }
    }

    // Populate the shop star counter
    const shopStarEl = document.getElementById('shop-star-count');
    if (shopStarEl) {
        const freshSession = _getChildSession();
        shopStarEl.textContent = freshSession?.totalPoints ?? freshDoc?.totalPoints ?? 0;
    }

    modal.classList.remove('hidden');

    // Render shop lock overlays AFTER modal is visible so DOM is ready
    requestAnimationFrame(() => _renderShopOverlays());
};

window.closeKidSettingsModal = function () {
    document.getElementById('kid-settings-modal')?.classList.add('hidden');
};

/**
 * Public pick functions now check the Shop catalog before applying.
 * Free items apply instantly; locked items trigger the purchase flow.
 */
window.pickAvatarColor = function (itemId) {
    const item = SHOP_CONFIG[itemId];
    if (!item) return; // unknown item
    const unlocked = _getUnlockedItems();
    if (!unlocked.has(itemId)) {
        _purchaseShopItem(itemId);
        return;
    }
    window._applyColorPick(item.value);
};

window.pickAvatarIcon = function (itemId) {
    const item = SHOP_CONFIG[itemId];
    if (!item) return;
    const unlocked = _getUnlockedItems();
    if (!unlocked.has(itemId)) {
        _purchaseShopItem(itemId);
        return;
    }
    window._applyIconPick(item.value);
};

window.pickCoverColor = function (color) {
    // Cover colors are all free — no shop gating needed
    _kidCoverColor = color;
    const coverPreview = document.getElementById('cover-color-preview');
    if (coverPreview) coverPreview.style.background = color;
};

window.pickTheme = function (itemId) {
    const item = SHOP_CONFIG[itemId];
    if (!item) return;
    const unlocked = _getUnlockedItems();
    if (!unlocked.has(itemId)) {
        _purchaseShopItem(itemId);
        return;
    }
    window._applyThemePick(item.value);
};

window.saveKidSettings = async function () {
    const session = _getChildSession();
    if (!session) { alert('Session not found. Please log in again.'); return; }

    const displayName = document.getElementById('kid-display-name').value.trim();
    const bio         = document.getElementById('kid-bio').value.trim();

    // Content filter (non-blocking if unavailable)
    if (bio && typeof DataService.filterBioGemini === 'function') {
        try {
            const filtered = await DataService.filterBioGemini(bio);
            if (filtered && filtered.blocked) {
                alert('Your bio contains inappropriate content. Please try again with different words! 😊');
                return;
            }
        } catch (e) { console.warn('Gemini filter unavailable:', e.message); }
    }

    // --- Show saving state ---
    const saveBtn = document.getElementById('kid-save-btn');
    const originalBtnHtml = saveBtn ? saveBtn.innerHTML : null;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
    }

    const prefs = {
        avatarBgColor: _kidAvatarColor,
        avatarImage:   _kidAvatarIcon.startsWith('../') ? _kidAvatarIcon : null,
        avatarIcon:    _kidAvatarIcon.startsWith('../') ? '🐻' : _kidAvatarIcon,
        coverColor:    _kidCoverColor,
        theme:         _kidTheme,
        displayName:   displayName,
        bio:           bio
    };

    // ─── STEP 1: Persist to server FIRST — throw on error so user sees failure ───
    try {
        await DataService.updateChildPrefs(session.$id, prefs);
    } catch (e) {
        // Restore button on failure
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalBtnHtml;
        }
        // Show visible error to the user (not just a console.warn)
        const errMsg = e.message || 'Unknown error';
        console.error('[saveKidSettings] DB save failed:', errMsg);
        alert(`❌ Couldn't save profile: ${errMsg}\n\nYour changes were NOT saved. Please try again.`);
        return; // <-- stop here; don't update local state with data that didn't persist
    }

    // ─── STEP 2: Server confirmed success — now update local session ───────────
    session.name        = displayName || session.name;
    session.firstName   = displayName || session.firstName;
    session.avatarImage = prefs.avatarImage;
    session.avatarBgColor = prefs.avatarBgColor;
    session.prefs = { ...session.prefs, ...prefs };
    sessionStorage.setItem('cubby_child_session', JSON.stringify(session));
    console.log('✅ [saveKidSettings] Session updated after confirmed server save.');

    // ─── STEP 3: Apply theme immediately ─────────────────────────────────────
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
    if (_kidTheme !== 'default') document.body.classList.add('theme-' + _kidTheme);

    // ─── STEP 4: Refresh header avatar if function available ──────────────────
    if (typeof updateHeader === 'function') { try { updateHeader(session); } catch (e) {} }
    else if (typeof renderKidHeader === 'function') { try { renderKidHeader(session); } catch (e) {} }

    // Restore button and close modal
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnHtml;
    }
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
