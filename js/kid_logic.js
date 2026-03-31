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
    const headerProfile = document.querySelector('nav .group .font-bold.text-gray-700');
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

    // FIX: Initialize the YouTube IFrame Player API for accurate play-state tracking.
    // For native video, fall back to <video> element events.
    if (isYouTube) {
        _initYouTubePlayer(vidId, video, pathId);
    } else {
        // For native <video> elements, start tracking immediately
        const pointsArr = [video.pointsValue, 10];
        const finalPoints = pointsArr.find(p => p !== undefined && p !== null);
        _startRewardTracking(videoDocId, video.duration || 0, finalPoints, pathId);
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
    const pointsArr = [video.pointsValue, 10];
    const finalPoints = pointsArr.find(p => p !== undefined && p !== null);

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
                onReady: () => {
                    // FIX: Start reward tracking AFTER player is ready so we know aspect ratio
                    // is rendered and no DOM issues exist. Pass the actual duration if available.
                    const dur = video.duration || 0;
                    _startRewardTracking(video.$id, dur, finalPoints, pathId, 'youtube');
                },
                onStateChange: (event) => {
                    // Expose current play state to the reward interval via a global flag.
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

    // FIX: Unknown duration falls back to 30 seconds (not 5 minutes).
    // A short, achievable threshold ensures kids always feel rewarded.
    if (!duration || duration <= 0) {
        console.warn('Video duration unknown. Using 30s fallback reward threshold.');
        duration = 30 / _completionThreshold; // equals 37.5s so threshold = 30s
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
        
        // Update Video Card if visible (optional)
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

    // Build confetti particles
    const confettiColors = ['#f97316','#a855f7','#3b82f6','#22c55e','#eab308','#ec4899','#14b8a6'];
    const confettiPieces = Array.from({ length: 28 }, (_, i) => {
        const color = confettiColors[i % confettiColors.length];
        const left = Math.random() * 100;
        const delay = (Math.random() * 0.8).toFixed(2);
        const size = (Math.random() * 8 + 6).toFixed(0);
        const rotation = Math.round(Math.random() * 360);
        return `<div style="
            position:absolute;
            left:${left}%;
            top:-10px;
            width:${size}px;
            height:${size}px;
            background:${color};
            border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
            animation: cubby-fall 1.8s ${delay}s ease-in forwards;
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
                0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
                100% { transform: translateY(320px) rotate(720deg); opacity: 0; }
            }
            @keyframes cubby-pop-in {
                0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0; }
                65%  { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
            }
            @keyframes cubby-star-spin {
                0%   { transform: rotate(0deg) scale(1); }
                50%  { transform: rotate(180deg) scale(1.3); }
                100% { transform: rotate(360deg) scale(1); }
            }
            @keyframes cubby-fade-out {
                0%   { opacity: 1; }
                100% { opacity: 0; }
            }
        </style>

        <!-- Overlay backdrop -->
        <div style="
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
        ">
            <!-- Confetti layer -->
            <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none;">
                ${confettiPieces}
            </div>

            <!-- Celebration card -->
            <div style="
                position: absolute;
                top: 50%; left: 50%;
                transform: translate(-50%, -50%) scale(1);
                animation: cubby-pop-in 0.55s cubic-bezier(.34,1.56,.64,1) both;
                background: linear-gradient(135deg, #a855f7 0%, #6366f1 50%, #3b82f6 100%);
                border-radius: 32px;
                padding: 40px 48px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(80,0,180,0.45), 0 0 0 6px rgba(255,255,255,0.15);
                min-width: 280px;
                max-width: 92vw;
            ">
                <!-- Spinning star -->
                <div style="
                    font-size: 56px;
                    animation: cubby-star-spin 1.5s linear infinite;
                    display: inline-block;
                    margin-bottom: 12px;
                    filter: drop-shadow(0 0 12px #fbbf24);
                ">⭐</div>

                <div style="
                    color: #fef08a;
                    font-size: 15px;
                    font-weight: 800;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    margin-bottom: 6px;
                    font-family: system-ui, sans-serif;
                ">Great Job!</div>

                <div style="
                    color: white;
                    font-size: 38px;
                    font-weight: 900;
                    font-family: system-ui, sans-serif;
                    line-height: 1.15;
                    text-shadow: 0 4px 12px rgba(0,0,0,0.25);
                ">+${points} Stars!</div>

                <div style="
                    color: rgba(255,255,255,0.75);
                    font-size: 13px;
                    font-weight: 700;
                    margin-top: 8px;
                    font-family: system-ui, sans-serif;
                ">You finished the video! 🎉</div>

                <!-- Bouncing emojis -->
                <div style="margin-top: 16px; font-size: 22px; letter-spacing: 6px;">🌟 🦄 🎈</div>
            </div>
        </div>
    `;

    document.body.appendChild(popup);

    // Auto-remove after 4 seconds with a fade-out
    setTimeout(() => {
        if (popup && popup.parentNode) {
            popup.style.animation = 'cubby-fade-out 0.5s ease forwards';
            setTimeout(() => { if (popup.parentNode) popup.remove(); }, 500);
        }
    }, 3500);
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
// KID PROFILE SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────────
let _kidAvatarColor = '#60a5fa';
let _kidAvatarIcon = '🐻';
let _kidCoverColor = '#3b82f6';
let _kidTheme = 'default';

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
        if (icon.startsWith('../')) preview.innerHTML = `<img src="${icon}" class="w-full h-full object-contain p-1">`;
        else preview.textContent = icon;
    }
};

window.pickCoverColor = function (color) {
    _kidCoverColor = color;
    const coverPreview = document.getElementById('cover-color-preview');
    if (coverPreview) coverPreview.style.background = color;
};

window.pickTheme = function (theme) {
    _kidTheme = theme;
    document.body.className = document.body.className.replace(/\btheme-\S+/g, '');
    if (theme !== 'default') document.body.classList.add('theme-' + theme);
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
