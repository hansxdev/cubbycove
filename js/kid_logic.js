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

window.addEventListener('beforeunload', () => { flushScreenTime(); });
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        flushScreenTime();
    } else if (document.visibilityState === 'visible') {
        _screenTimeStart = Date.now();
        _screenTimeFlushed = false;
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (user) updateHeader(user);

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
        const rewards = await DataService.databases.listDocuments(
            DataService.DB_ID, 
            DataService.COLLECTIONS.KID_REWARDS, 
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
    const headerProfile = document.querySelector('.group .font-bold.text-gray-700');
    const headerAvatarImgs = document.querySelectorAll('.group img');

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

    let playerHtml;
    if (isYouTube) {
        playerHtml = `<iframe id="kid-modal-player" width="100%" height="100%" src="https://www.youtube.com/embed/${vidId}?autoplay=1&enablejsapi=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        playerHtml = `<video id="kid-modal-player" src="${safeUrl}" class="w-full h-full" controls autoplay preload="metadata"></video>`;
    }

    // Start Reward Tracking
    const pointsArr = [video.pointsValue, 10]; // Fallback if pointsValue is missing
    const finalPoints = pointsArr.find(p => p !== undefined && p !== null);
    _startRewardTracking(videoDocId, video.duration || 0, finalPoints, pathId);

    // Log watch history
    const session = _getChildSession();
    const thumbUrl = video.thumbnailUrl || (isYouTube ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg` : '');
    if (session?.$id) {
        DataService.logWatchHistory(session.$id, video.$id, video.title, video.category, video.url, thumbUrl);
        DataService.incrementVideoView(video.$id, '').catch(() => { });
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
    modal.className = 'fixed inset-0 bg-black/95 z-[100] flex flex-col lg:flex-row overflow-auto';

    modal.innerHTML = `
        <!-- Close Button -->
        <button id="kid-modal-close-btn" class="absolute top-4 right-4 z-50 text-white text-2xl hover:text-red-400 transition-colors bg-black/50 rounded-full w-10 h-10 flex items-center justify-center shadow-lg">
            <i class="fa-solid fa-times"></i>
        </button>

        <!-- LEFT: Video Player (70%) -->
        <div class="w-full lg:w-[70%] flex flex-col p-4 lg:p-6">
            <div class="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
                ${playerHtml}
            </div>

            <!-- Video Info -->
            <div class="mt-4 px-1">
                <h2 class="text-white text-xl font-extrabold leading-tight mb-2">${video.title}</h2>
                <div class="flex items-center gap-3 mb-4">
                    <img src="https://api.dicebear.com/7.x/identicon/svg?seed=${video.category || 'creator'}" class="w-10 h-10 rounded-full bg-gray-700">
                    <div>
                        <p class="text-white font-bold text-sm">${video.creatorEmail ? video.creatorEmail.split('@')[0] : 'Creator'}</p>
                        <p class="text-gray-400 text-xs font-semibold">${video.category || 'Video'} • ${(video.views || 0).toLocaleString()} views</p>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex flex-wrap gap-3">
                    <button onclick="window._kidLikeVideo('${video.$id}')" class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors">
                        <i class="fa-solid fa-thumbs-up"></i> <span id="kid-like-count">${video.likes || 0}</span>
                    </button>
                    <button onclick="window._kidDislikeVideo('${video.$id}')" class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors">
                        <i class="fa-solid fa-thumbs-down"></i> <span id="kid-dislike-count">${video.dislikes || 0}</span>
                    </button>
                    <button id="kid-fav-btn" onclick="window._kidToggleFavorite('${video.$id}', '${video.title.replace(/'/g, "\\'")}', '${video.category}', '${safeUrl}', '${thumbUrl}')"
                        class="flex items-center gap-2 ${isFav ? 'bg-cubby-pink text-white' : 'bg-gray-800 text-white'} hover:bg-cubby-pink/80 px-4 py-2 rounded-full text-sm font-bold transition-colors">
                        <i class="fa-solid fa-heart"></i> ${isFav ? 'Favorited' : 'Favorite'}
                    </button>
                    <button onclick="window._kidShareVideo('${video.url}')" class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors">
                        <i class="fa-solid fa-share"></i> Share
                    </button>
                </div>
            </div>
        </div>

        <!-- RIGHT: Recommendations (30%) -->
        <div class="w-full lg:w-[30%] p-4 lg:p-6 lg:pl-0 overflow-y-auto">
            <h3 class="text-white font-extrabold text-lg mb-4"><i class="fa-solid fa-wand-magic-sparkles text-cubby-yellow mr-2"></i>Up Next</h3>
            <div id="kid-modal-recs" class="space-y-3">
                ${recsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Close listeners
    document.getElementById('kid-modal-close-btn').addEventListener('click', _closeKidVideoModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) _closeKidVideoModal();
    });
};

function _closeKidVideoModal() {
    _stopRewardTracking();
    const modal = document.getElementById('kid-video-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

// ── Reward Logic Implementation ──────────────────────────────────────────────
async function _startRewardTracking(videoId, duration, points, pathId = null) {
    _currentVideoId = videoId;
    _currentPathId = pathId;
    _currentPointsValue = points;
    _elapsedPlayTime = 0;
    _isRewardClaimed = _rewardedVideoIds.has(videoId);

    if (_isRewardClaimed) {
        console.log('Video already rewarded. No tracking needed.');
        return;
    }

    if (!duration || duration <= 0) {
        console.warn('Video duration unknown. Using 5 min fallback for reward threshold.');
        duration = 300; 
    }

    const thresholdSeconds = duration * _completionThreshold;
    console.log(`🎯 Tracking reward for ${videoId}. Need ${Math.round(thresholdSeconds)}s of watch time.`);

    _rewardInterval = setInterval(() => {
        const player = document.getElementById('kid-modal-player');
        if (!player) return;

        // Check if playing
        let isPlaying = false;
        if (player.tagName === 'VIDEO') {
            isPlaying = !player.paused;
        } else {
            // Limited check for YouTube iframe (requires PostMessage or API, but for MVP we assume presence)
            isPlaying = true; 
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
    const modal = document.getElementById('reward-celebration-modal');
    const msg = document.getElementById('reward-message');
    const container = document.getElementById('celebration-container');
    
    if (!modal || !msg || !container) return;

    msg.textContent = `+${points} Stars Earned!`;
    modal.classList.remove('hidden');
    
    // Animate scale
    setTimeout(() => {
        container.classList.remove('scale-0');
        container.classList.add('scale-100');
    }, 10);

    // Auto-hide after 5s or wait for button
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
    try {
        const updated = await DataService.likeVideo(videoId);
        const el = document.getElementById('kid-like-count');
        if (el && updated) el.textContent = updated.likes;
    } catch (e) { console.warn(e); }
};

window._kidDislikeVideo = async function (videoId) {
    try {
        const updated = await DataService.dislikeVideo(videoId);
        const el = document.getElementById('kid-dislike-count');
        if (el && updated) el.textContent = updated.dislikes;
    } catch (e) { console.warn(e); }
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

window.openKidSettingsModal = function () {
    const modal = document.getElementById('kid-settings-modal');
    if (!modal) return;

    const session = _getChildSession();
    if (session) {
        const prefs = session.prefs || {};
        _kidAvatarColor = prefs.avatarBgColor || '#60a5fa';
        _kidAvatarIcon = prefs.avatarImage || prefs.avatarIcon || '🐻';
        _kidCoverColor = prefs.coverColor || '#3b82f6';
        _kidTheme = prefs.theme || 'default';

        document.getElementById('kid-display-name').value = prefs.displayName || session.name || '';
        document.getElementById('kid-bio').value = prefs.bio || '';

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
    const bio = document.getElementById('kid-bio').value.trim();

    if (bio && typeof DataService.filterBioGemini === 'function') {
        try {
            const filtered = await DataService.filterBioGemini(bio);
            if (filtered && filtered.blocked) {
                alert('Your bio contains inappropriate content. Please try again with different words! 😊');
                return;
            }
        } catch (e) { console.warn('Gemini filter unavailable:', e.message); }
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

    session.prefs = { ...session.prefs, ...prefs };
    sessionStorage.setItem('cubby_child_session', JSON.stringify(session));

    try {
        if (typeof DataService.updateChildPrefs === 'function') {
            await DataService.updateChildPrefs(session.$id, prefs);
        }
        if (typeof DataService.updateChild === 'function') {
            await DataService.updateChild(session.$id, {
                avatarImage: prefs.avatarImage,
                avatarBgColor: prefs.avatarBgColor
            });
        }
    } catch (e) { console.warn('Could not save prefs to server:', e.message); }

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
