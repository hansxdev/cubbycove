// Logic for creator/creator.html

// ─── Cloudinary Configuration ────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dndf8zmqf';
const CLOUDINARY_UPLOAD_PRESET = 'cubbycove_videos';
const MAX_FILE_SIZE_MB = 250;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let creatorVideos = [];
let statsPeriod = 'day';

// ─── Chart instances ─────────────────────────────────────────────────────────
let chartSubscribers = null;
let chartViews = null;
let chartLikesDislikes = null;
let chartVideoSubscribers = null;

// ═════════════════════════════════════════════════════════════════════════════
//  INIT
// ═════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    initCreatorStudio();

    // Tab Switching
    window.showTab = function (tabName) {
        document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
        document.querySelectorAll('nav a').forEach(a => {
            a.classList.remove('bg-orange-50', 'text-orange-600', 'border-orange-500');
            a.classList.add('text-gray-500', 'border-transparent');
        });

        const tab = document.getElementById(`tab-${tabName}`);
        const nav = document.getElementById(`nav-${tabName}`);
        if (tab) tab.classList.remove('hidden');
        if (nav) {
            nav.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-500');
            nav.classList.remove('text-gray-500', 'border-transparent');
        }

        // Close mobile sidebar on tab switch
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && window.innerWidth < 1024) {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }

        // Load tab data
        if (tabName === 'uploads') loadMyUploads();
        if (tabName === 'statistics') loadStatistics();
    };

    // Upload Form
    const form = document.getElementById('uploadForm');
    if (form) form.addEventListener('submit', handleUpload);

    // Cloudinary Upload Button
    const cloudBtn = document.getElementById('cloudinaryUploadBtn');
    if (cloudBtn) cloudBtn.addEventListener('click', openCloudinaryWidget);

    // Sort dropdown
    const sortSelect = document.getElementById('video-sort');
    if (sortSelect) sortSelect.addEventListener('change', () => loadMyUploads());
});

async function initCreatorStudio() {
    try {
        const { account } = window.AppwriteService;
        currentUser = await account.get();
        // Update header with real name and avatar
        const nameEl = document.getElementById('creator-header-name');
        const avatarEl = document.getElementById('creator-header-avatar');
        const displayName = currentUser.name || currentUser.email;
        if (nameEl) nameEl.textContent = displayName;
        if (avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;
        loadMyUploads();
    } catch (e) {
        console.error('Creator init error:', e);
        window.location.href = '../login.html';
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  CLOUDINARY UPLOAD WIDGET
// ═════════════════════════════════════════════════════════════════════════════
function openCloudinaryWidget() {
    const errorBox = document.getElementById('upload-error');
    const successBox = document.getElementById('upload-success');
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');

    const widget = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'url', 'camera'],
        resourceType: 'video',
        maxFileSize: MAX_FILE_SIZE_BYTES,
        multiple: false,
        clientAllowedFormats: ['mp4', 'mov', 'avi', 'webm', 'mkv'],
        showAdvancedOptions: false,
        cropping: false,
        theme: 'minimal',
        styles: {
            palette: {
                window: '#FFFFFF',
                windowBorder: '#E5E7EB',
                tabIcon: '#F97316',
                menuIcons: '#6B7280',
                textDark: '#1F2937',
                textLight: '#9CA3AF',
                link: '#F97316',
                action: '#F97316',
                inactiveTabIcon: '#9CA3AF',
                error: '#EF4444',
                inProgress: '#F97316',
                complete: '#22C55E',
                sourceBg: '#F9FAFB'
            }
        }
    }, (error, result) => {
        if (error) {
            console.error('Cloudinary widget error:', error);
            if (error.statusText && error.statusText.includes('File size')) {
                showUploadError(`File is too large! Maximum allowed size is ${MAX_FILE_SIZE_MB}MB. Please choose a smaller file.`);
            } else {
                showUploadError('Upload failed. Please try again.');
            }
            return;
        }
        if (result.event === 'success') {
            const secureUrl = result.info.secure_url;
            const videoUrlInput = document.getElementById('videoUrl');
            if (videoUrlInput) videoUrlInput.value = secureUrl;
            successBox.innerHTML = '<i class="fa-solid fa-check-circle mr-1"></i> Video uploaded successfully to cloud!';
            successBox.classList.remove('hidden');
        }
    });

    widget.open();
}

function showUploadError(msg) {
    const errorBox = document.getElementById('upload-error');
    errorBox.innerHTML = `<i class="fa-solid fa-circle-exclamation mr-1"></i> ${msg}`;
    errorBox.classList.remove('hidden');
}

// ═════════════════════════════════════════════════════════════════════════════
//  UPLOAD HANDLER — Saves video metadata to Appwrite
// ═════════════════════════════════════════════════════════════════════════════
async function handleUpload(e) {
    e.preventDefault();

    const url = document.getElementById('videoUrl').value.trim();
    const title = document.getElementById('videoTitle').value.trim();
    const category = document.getElementById('videoCategory').value;

    if (!url) return showUploadError('Please paste a YouTube URL or upload a video from your device first.');
    if (!title) return showUploadError('Please enter a title for your video.');

    const errorBox = document.getElementById('upload-error');
    const successBox = document.getElementById('upload-success');
    errorBox.classList.add('hidden');
    successBox.classList.add('hidden');

    try {
        await DataService.addVideo({
            title: title,
            url: url,
            category: category,
            creatorEmail: currentUser.email,
            status: 'pending',
            views: 0,
            likes: 0,
            dislikes: 0,
            subscriberGains: 0,
            uploadedAt: new Date().toISOString()
        });

        // Reset form
        document.getElementById('uploadForm').reset();
        successBox.innerHTML = '<i class="fa-solid fa-check-circle mr-1"></i> Video submitted for review!';
        successBox.classList.remove('hidden');
    } catch (err) {
        console.error('Upload error:', err);
        showUploadError('Failed to submit video. Please try again.');
    }
}

// ═════════════════════════════════════════════════════════════════════════════
//  LOAD MY UPLOADS — Displays creator's videos with sort/filter
// ═════════════════════════════════════════════════════════════════════════════
async function loadMyUploads() {
    if (!currentUser) return;

    const listEl = document.getElementById('video-list');
    listEl.innerHTML = '<div class="text-center p-8 text-gray-400"><i class="fa-solid fa-spinner fa-spin text-2xl"></i></div>';

    try {
        const { databases, DB_ID } = DataService._getServices();
        const { Query } = Appwrite;

        const res = await databases.listDocuments(DB_ID, 'videos', [
            Query.equal('creatorEmail', currentUser.email),
            Query.orderDesc('$createdAt'),
            Query.limit(100)
        ]);

        creatorVideos = res.documents;

        // Sort
        const sortBy = document.getElementById('video-sort')?.value || 'recent';
        const sorted = [...creatorVideos];
        if (sortBy === 'views') sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
        else if (sortBy === 'likes') sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        else if (sortBy === 'dislikes') sorted.sort((a, b) => (b.dislikes || 0) - (a.dislikes || 0));
        else if (sortBy === 'subscribers') sorted.sort((a, b) => (b.subscriberGains || 0) - (a.subscriberGains || 0));

        // Update stat counters
        const liveCount = creatorVideos.filter(v => v.status === 'approved').length;
        const pendingCount = creatorVideos.filter(v => v.status === 'pending').length;
        const totalViews = creatorVideos.reduce((sum, v) => sum + (v.views || 0), 0);
        document.getElementById('stat-live').textContent = liveCount;
        document.getElementById('stat-pending').textContent = pendingCount;
        document.getElementById('stat-total-views').textContent = totalViews.toLocaleString();

        if (sorted.length === 0) {
            listEl.innerHTML = `
                <div class="text-center p-12 bg-white rounded-xl border border-gray-200">
                    <i class="fa-solid fa-video-slash text-gray-300 text-4xl mb-3"></i>
                    <p class="text-gray-400 font-bold">No videos uploaded yet</p>
                    <p class="text-gray-400 text-sm mt-1">Click "New Video" to upload your first video!</p>
                </div>`;
            return;
        }

        listEl.innerHTML = sorted.map(v => {
            const statusBadge = v.status === 'approved'
                ? '<span class="bg-green-100 text-green-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Live</span>'
                : v.status === 'rejected'
                    ? '<span class="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold">Rejected</span>'
                    : '<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded-full font-bold">Pending</span>';

            const thumbnail = getVideoThumbnail(v.url);

            return `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center hover:shadow-md transition-shadow cursor-pointer"
                     onclick="openVideoDetail('${v.$id}')">
                    <div class="w-full sm:w-32 h-24 sm:h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
                        ${thumbnail}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1 flex-wrap">
                            ${statusBadge}
                            <span class="text-[10px] text-gray-400 font-semibold">${v.category || 'General'}</span>
                        </div>
                        <h4 class="font-bold text-gray-800 truncate text-sm sm:text-base">${escapeHtml(v.title)}</h4>
                        <div class="flex items-center gap-4 mt-1 text-xs text-gray-400 font-semibold flex-wrap">
                            <span><i class="fa-solid fa-eye mr-1"></i>${(v.views || 0).toLocaleString()} views</span>
                            <span><i class="fa-solid fa-thumbs-up mr-1 text-green-400"></i>${(v.likes || 0)}</span>
                            <span><i class="fa-solid fa-thumbs-down mr-1 text-red-400"></i>${(v.dislikes || 0)}</span>
                            <span><i class="fa-solid fa-user-plus mr-1 text-orange-400"></i>${(v.subscriberGains || 0)} subs</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-gray-300 hidden sm:block"></i>
                </div>`;
        }).join('');

    } catch (err) {
        console.error('Load uploads error:', err);
        listEl.innerHTML = '<div class="text-center p-8 text-red-400 font-bold">Error loading videos</div>';
    }
}

function getVideoThumbnail(url) {
    if (!url) return '<div class="absolute inset-0 flex items-center justify-center"><i class="fa-solid fa-film text-gray-400 text-2xl"></i></div>';

    // YouTube thumbnail
    const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        return `<img src="https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg" class="absolute inset-0 w-full h-full object-cover" alt="Thumbnail">`;
    }

    // Cloudinary video — use video poster
    return `<video src="${escapeHtml(url)}" class="absolute inset-0 w-full h-full object-cover" muted preload="metadata"></video>`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

// ═════════════════════════════════════════════════════════════════════════════
//  VIDEO DETAIL MODAL
// ═════════════════════════════════════════════════════════════════════════════
function openVideoDetail(videoId) {
    const video = creatorVideos.find(v => v.$id === videoId);
    if (!video) return;

    const modal = document.getElementById('video-detail-modal');
    const playerContainer = document.getElementById('video-player-container');
    const titleEl = document.getElementById('detail-video-title');
    const metaEl = document.getElementById('detail-video-meta');
    const viewsEl = document.getElementById('detail-views');
    const likesEl = document.getElementById('detail-likes');
    const dislikesEl = document.getElementById('detail-dislikes');

    // Set metadata
    titleEl.textContent = video.title;
    metaEl.textContent = `${video.category || 'General'} • Uploaded ${new Date(video.uploadedAt || video.$createdAt).toLocaleDateString()}`;
    viewsEl.textContent = (video.views || 0).toLocaleString();
    likesEl.textContent = (video.likes || 0).toLocaleString();
    dislikesEl.textContent = (video.dislikes || 0).toLocaleString();

    // Render player — DOES NOT increment views (creator viewing own video)
    const ytMatch = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
        playerContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0" class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
        playerContainer.innerHTML = `<video src="${escapeHtml(video.url)}" class="w-full h-full" controls preload="metadata"></video>`;
    }

    // Init per-video subscriber chart
    initVideoSubscribersChart(video);

    modal.classList.remove('hidden');
}

window.closeVideoDetail = function () {
    const modal = document.getElementById('video-detail-modal');
    modal.classList.add('hidden');
    // Stop any playing video
    const playerContainer = document.getElementById('video-player-container');
    playerContainer.innerHTML = '';
};

// ═════════════════════════════════════════════════════════════════════════════
//  STATISTICS TAB
// ═════════════════════════════════════════════════════════════════════════════
async function loadStatistics() {
    if (!currentUser) return;

    try {
        const { databases, DB_ID } = DataService._getServices();
        const { Query } = Appwrite;

        const res = await databases.listDocuments(DB_ID, 'videos', [
            Query.equal('creatorEmail', currentUser.email),
            Query.limit(100)
        ]);

        const videos = res.documents;

        // Aggregate counters
        const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
        const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
        const totalDislikes = videos.reduce((s, v) => s + (v.dislikes || 0), 0);
        const totalSubscribers = videos.reduce((s, v) => s + (v.subscriberGains || 0), 0);

        document.getElementById('stats-subscribers').textContent = totalSubscribers.toLocaleString();
        document.getElementById('stats-total-views').textContent = totalViews.toLocaleString();
        document.getElementById('stats-total-likes').textContent = totalLikes.toLocaleString();
        document.getElementById('stats-total-dislikes').textContent = totalDislikes.toLocaleString();

        // Generate chart data based on period
        updateStatsCharts(videos);
    } catch (err) {
        console.error('Statistics error:', err);
    }
}

function generateTimeLabels(period) {
    const labels = [];
    const now = new Date();
    if (period === 'day') {
        for (let i = 23; i >= 0; i--) {
            const h = new Date(now);
            h.setHours(now.getHours() - i);
            labels.push(h.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
    } else if (period === 'week') {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString([], { weekday: 'short' }));
        }
    } else {
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            labels.push(d.toLocaleDateString([], { month: 'short', day: 'numeric' }));
        }
    }
    return labels;
}

function generateRandomData(length, max) {
    // Placeholder data with realistic distribution centered around the actual total
    return Array.from({ length }, () => Math.floor(Math.random() * max));
}

function distributeValue(total, length) {
    // Distribute a total value across time periods with some randomness
    if (total === 0) return Array(length).fill(0);
    const data = [];
    let remaining = total;
    for (let i = 0; i < length - 1; i++) {
        const maxSlice = Math.ceil(remaining / (length - i) * 2);
        const val = Math.min(remaining, Math.floor(Math.random() * maxSlice));
        data.push(val);
        remaining -= val;
    }
    data.push(Math.max(0, remaining));
    return data;
}

function updateStatsCharts(videos) {
    const labels = generateTimeLabels(statsPeriod);
    const len = labels.length;

    const totalSubs = videos.reduce((s, v) => s + (v.subscriberGains || 0), 0);
    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
    const totalLikes = videos.reduce((s, v) => s + (v.likes || 0), 0);
    const totalDislikes = videos.reduce((s, v) => s + (v.dislikes || 0), 0);

    const subsData = distributeValue(totalSubs, len);
    const viewsData = distributeValue(totalViews, len);
    const likesData = distributeValue(totalLikes, len);
    const dislikesData = distributeValue(totalDislikes, len);

    const chartOpts = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } },
            y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } }
        },
        elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 2, hoverRadius: 5 } }
    };

    // Subscribers Gained
    if (chartSubscribers) chartSubscribers.destroy();
    chartSubscribers = new Chart(document.getElementById('chartSubscribers'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Subscribers',
                data: subsData,
                borderColor: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.1)',
                fill: true
            }]
        },
        options: chartOpts
    });

    // Total Views
    if (chartViews) chartViews.destroy();
    chartViews = new Chart(document.getElementById('chartViews'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Views',
                data: viewsData,
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59,130,246,0.1)',
                fill: true
            }]
        },
        options: chartOpts
    });

    // Likes vs Dislikes
    if (chartLikesDislikes) chartLikesDislikes.destroy();
    chartLikesDislikes = new Chart(document.getElementById('chartLikesDislikes'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Likes',
                    data: likesData,
                    borderColor: '#22C55E',
                    backgroundColor: 'rgba(34,197,94,0.1)',
                    fill: true
                },
                {
                    label: 'Dislikes',
                    data: dislikesData,
                    borderColor: '#EF4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    fill: true
                }
            ]
        },
        options: {
            ...chartOpts,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: { font: { size: 11, weight: 'bold' }, usePointStyle: true, pointStyle: 'circle' }
                }
            }
        }
    });
}

window.setStatsPeriod = function (period) {
    statsPeriod = period;
    document.querySelectorAll('.stats-period-btn').forEach(btn => {
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-500');
    });
    const activeBtn = document.getElementById(`stats-period-${period}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-orange-500', 'text-white');
        activeBtn.classList.remove('text-gray-500');
    }
    loadStatistics();
};

// ═════════════════════════════════════════════════════════════════════════════
//  PER-VIDEO SUBSCRIBER CHART
// ═════════════════════════════════════════════════════════════════════════════
let currentVideoStatsPeriod = 'day';
let currentDetailVideo = null;

function initVideoSubscribersChart(video) {
    currentDetailVideo = video;
    currentVideoStatsPeriod = 'day';
    // Reset period buttons
    document.querySelectorAll('.video-stats-period-btn').forEach(btn => {
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-500');
    });
    document.querySelector('.video-stats-period-btn')?.classList.add('bg-orange-500', 'text-white');
    document.querySelector('.video-stats-period-btn')?.classList.remove('text-gray-500');

    renderVideoSubscribersChart(video, 'day');
}

function renderVideoSubscribersChart(video, period) {
    const labels = generateTimeLabels(period);
    const data = distributeValue(video.subscriberGains || 0, labels.length);

    if (chartVideoSubscribers) chartVideoSubscribers.destroy();
    chartVideoSubscribers = new Chart(document.getElementById('chartVideoSubscribers'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Subscribers from this video',
                data: data,
                borderColor: '#F97316',
                backgroundColor: 'rgba(249,115,22,0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 9, weight: 'bold' }, color: '#9CA3AF' } },
                y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 9, weight: 'bold' }, color: '#9CA3AF' } }
            },
            elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 1, hoverRadius: 4 } }
        }
    });
}

window.setVideoStatsPeriod = function (period) {
    currentVideoStatsPeriod = period;
    document.querySelectorAll('.video-stats-period-btn').forEach(btn => {
        btn.classList.remove('bg-orange-500', 'text-white');
        btn.classList.add('text-gray-500');
    });
    // Find the clicked button
    const buttons = document.querySelectorAll('.video-stats-period-btn');
    buttons.forEach(btn => {
        if (btn.textContent.trim().toLowerCase() === period) {
            btn.classList.add('bg-orange-500', 'text-white');
            btn.classList.remove('text-gray-500');
        }
    });

    if (currentDetailVideo) renderVideoSubscribersChart(currentDetailVideo, period);
};