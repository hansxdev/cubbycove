// Logic for creator/creator.html

// ─── Cloudinary Configuration ────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = 'dndf8zmqf';
const CLOUDINARY_UPLOAD_PRESET = 'cubbycove_videos';
const MAX_FILE_SIZE_MB = 250;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ─── State ───────────────────────────────────────────────────────────────────
let currentUser = null;
let creatorVideos = [];
let creatorPaths = [];
let statsPeriod = 'day';

// Path Creation State
let selectedPathVideos = []; // Array of video objects
let editingPathId = null; 

// ─── Chart instances ─────────────────────────────────────────────────────────
let chartSubscribers = null;
let chartViews = null;
let chartLikesDislikes = null;
let chartVideoSubscribers = null;

// Sparklines
let chartSparkSubs = null;
let chartSparkViews = null;
let chartSparkLikes = null;
let chartSparkDislikes = null;

// ═════════════════════════════════════════════════════════════════════════════
//  TAB SWITCHING & INIT
// ═════════════════════════════════════════════════════════════════════════════

window.showTab = function (tabName) {
    document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
    document.querySelectorAll('nav a').forEach(a => {
        a.classList.remove('bg-white/10', 'text-white', 'shadow-sm', 'border-white/5');
        a.classList.add('text-gray-400');
        const icon = a.querySelector('i');
        if (icon) {
            icon.classList.remove('text-white');
            icon.classList.add('group-hover:text-white', 'transition-colors');
        }
    });

    const tab = document.getElementById(`tab-${tabName}`);
    const nav = document.getElementById(`nav-${tabName}`);
    if (tab) tab.classList.remove('hidden');
    if (nav) {
        nav.classList.add('bg-white/10', 'text-white', 'shadow-sm', 'border-white/5');
        nav.classList.remove('text-gray-400');
        const icon = nav.querySelector('i');
        if (icon) {
            icon.classList.add('text-white');
            icon.classList.remove('group-hover:text-white', 'transition-colors');
        }
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
    if (tabName === 'paths') loadLearningPaths();
    if (tabName === 'overview') loadOverview();
};
document.addEventListener('DOMContentLoaded', () => {
    initCreatorStudio();

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
        showTab('overview');
    } catch (e) {
        console.error('Creator init error:', e);
        // Alert the error so the user and we can debug it instead of redirecting silently
        alert("Creator init error: " + e.message);
        // window.location.href = '../login.html';
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

// Thumbnail Preview
window.previewThumbnail = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('thumbnail-preview');
        const placeholder = document.getElementById('thumbnail-placeholder');
        if (placeholder) placeholder.classList.add('hidden');
        // Remove existing preview image if any
        const existing = preview.querySelector('img');
        if (existing) existing.remove();
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'w-full h-full object-cover';
        preview.appendChild(img);
        document.getElementById('clear-thumbnail-btn').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.clearThumbnailPreview = function () {
    const preview = document.getElementById('thumbnail-preview');
    const placeholder = document.getElementById('thumbnail-placeholder');
    const img = preview.querySelector('img');
    if (img) img.remove();
    if (placeholder) placeholder.classList.remove('hidden');
    document.getElementById('thumbnailFile').value = '';
    document.getElementById('clear-thumbnail-btn').classList.add('hidden');
};

let pendingUploadData = null;

async function handleUpload(e) {
    e.preventDefault();

    const url = document.getElementById('videoUrl').value.trim();
    const title = document.getElementById('videoTitle').value.trim();
    const category = document.getElementById('videoCategory').value;

    if (!url) return showUploadError('Please paste a YouTube URL or upload a video from your device first.');
    if (!title) return showUploadError('Please enter a title for your video.');

    const errorBox = document.getElementById('upload-error');
    errorBox.classList.add('hidden');

    // Store data temporarily and open rules modal
    pendingUploadData = { url, title, category };
    
    const agreeCheckbox = document.getElementById('rules-agree-checkbox');
    const confirmBtn = document.getElementById('confirm-upload-btn');
    if (agreeCheckbox && confirmBtn) {
        agreeCheckbox.checked = false;
        confirmBtn.disabled = true;
        agreeCheckbox.onchange = (ev) => {
            confirmBtn.disabled = !ev.target.checked;
        };
    }
    
    document.getElementById('creator-rules-modal').classList.remove('hidden');
}

window.closeCreatorRules = function() {
    document.getElementById('creator-rules-modal').classList.add('hidden');
    pendingUploadData = null;
};

window.confirmAndUpload = async function() {
    if (!pendingUploadData) return;
    
    const { url, title, category } = pendingUploadData;
    closeCreatorRules();
    
    const successBox = document.getElementById('upload-success');
    successBox.classList.add('hidden');

    try {
        let thumbnailUrl = '';

        // Upload custom thumbnail if provided
        const thumbInput = document.getElementById('thumbnailFile');
        if (thumbInput && thumbInput.files && thumbInput.files.length > 0) {
            try {
                const thumbFile = thumbInput.files[0];
                const formData = new FormData();
                formData.append('file', thumbFile);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
                formData.append('resource_type', 'image');

                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.secure_url) {
                    thumbnailUrl = data.secure_url;
                }
            } catch (thumbErr) {
                console.warn('Thumbnail upload failed, continuing without custom thumbnail:', thumbErr);
            }
        }

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
            uploadedAt: new Date().toISOString(),
            thumbnailUrl: thumbnailUrl
        });

        // Reset form
        document.getElementById('uploadForm').reset();
        clearThumbnailPreview();
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
        
        const elStatLive = document.getElementById('stat-live');
        const elStatPending = document.getElementById('stat-pending');
        const elStatTotalViews = document.getElementById('stat-total-views');
        if (elStatLive) elStatLive.textContent = liveCount;
        if (elStatPending) elStatPending.textContent = pendingCount;
        if (elStatTotalViews) elStatTotalViews.textContent = totalViews.toLocaleString();

        const ovLive = document.getElementById('overview-stat-live');
        const ovPending = document.getElementById('overview-stat-pending');
        const ovViews = document.getElementById('overview-stat-views');
        if (ovLive) ovLive.textContent = liveCount;
        if (ovPending) ovPending.textContent = pendingCount;
        if (ovViews) ovViews.textContent = totalViews.toLocaleString();

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

    // ═════════════════════════════════════════════════════════════════════════════
//  OVERVIEW TAB
// ═════════════════════════════════════════════════════════════════════════════

async function loadOverview() {
    if (!currentUser) return;
    try {
        const { databases, DB_ID } = DataService._getServices();
        const { Query } = Appwrite;

        const res = await databases.listDocuments(DB_ID, 'videos', [
            Query.equal('creatorEmail', currentUser.email),
            Query.orderDesc('$createdAt'),
            Query.limit(10)
        ]);

        creatorVideos = res.documents;
        loadMyUploads(); // Populates counters & 'My Uploads'
        renderOverviewCharts(creatorVideos);
        renderOverviewCarousel(creatorVideos);
    } catch(err) {
        console.error('Overview error:', err);
    }
}

let overviewChartSubs = null;
let overviewChartViews = null;

function renderOverviewCharts(videos) {
    const labels = generateTimeLabels('week');
    const len = labels.length;

    const totalSubs = videos.reduce((s, v) => s + (v.subscriberGains || 0), 0);
    const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);

    const subsData = distributeValue(totalSubs, len);
    const viewsData = distributeValue(totalViews, len);

    const chartOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 7, font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } },
            y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } }
        },
        elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 0 } }
    };

    if (overviewChartSubs) overviewChartSubs.destroy();
    overviewChartSubs = new Chart(document.getElementById('overviewChartSubs'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Subscribers', data: subsData,
                borderColor: '#F97316', pointBorderColor: '#F97316',
                backgroundColor: getGradient('overviewChartSubs', 180, '249,115,22'),
                fill: true
            }]
        },
        options: chartOpts
    });

    if (overviewChartViews) overviewChartViews.destroy();
    overviewChartViews = new Chart(document.getElementById('overviewChartViews'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Views', data: viewsData,
                borderColor: '#3B82F6', pointBorderColor: '#3B82F6',
                backgroundColor: getGradient('overviewChartViews', 180, '59,130,246'),
                fill: true
            }]
        },
        options: chartOpts
    });
}

function renderOverviewCarousel(videos) {
    const listEl = document.getElementById('overview-carousel');
    if (!listEl) return;
    
    if (videos.length === 0) {
        listEl.innerHTML = '<div class="text-xs font-bold text-gray-400 py-4 px-2 tracking-wide uppercase">No videos yet...</div>';
        return;
    }
    
    listEl.innerHTML = videos.map(v => {
        const thumbnail = getVideoThumbnail(v.url);
        return `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 min-w-[200px] flex-shrink-0 hover:shadow-md transition-all cursor-pointer" onclick="openVideoDetail('${v.$id}')">
                <div class="w-full h-28 bg-gray-100 rounded-xl overflow-hidden relative mb-3">
                    ${thumbnail}
                </div>
                <h4 class="font-bold text-gray-800 text-sm truncate mb-2">${escapeHtml(v.title)}</h4>
                <div class="flex items-center gap-3 text-[10px] font-black font-semibold text-gray-500">
                    <span class="flex items-center text-blue-600"><i class="fa-solid fa-thumbs-up mr-1 text-blue-500"></i>${(v.likes || 0)}</span>
                    <span class="flex items-center text-orange-400"><i class="fa-solid fa-thumbs-down mr-1"></i>${(v.dislikes || 0)}</span>
                    <span class="flex items-center text-gray-500"><i class="fa-solid fa-eye mr-1 text-indigo-400"></i>${(v.views || 0)}</span>
                </div>
            </div>
        `;
    }).join('');
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

function getGradient(ctxId, height, rgb) {
    const canvas = document.getElementById(ctxId);
    if (!canvas) return `rgba(${rgb}, 0.1)`;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgba(${rgb}, 0.25)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0.0)`);
    return gradient;
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
        elements: { line: { tension: 0.4, borderWidth: 3 }, point: { radius: 3, hoverRadius: 6, backgroundColor: '#ffffff', borderWidth: 2 } }
    };

    // Main Charts
    if (chartSubscribers) chartSubscribers.destroy();
    chartSubscribers = new Chart(document.getElementById('chartSubscribers'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Subscribers', data: subsData,
                borderColor: '#3B82F6', pointBorderColor: '#3B82F6',
                backgroundColor: getGradient('chartSubscribers', 220, '59,130,246'),
                fill: true
            }]
        },
        options: chartOpts
    });

    if (chartViews) chartViews.destroy();
    chartViews = new Chart(document.getElementById('chartViews'), {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Views', data: viewsData,
                borderColor: '#10B981', pointBorderColor: '#10B981',
                backgroundColor: getGradient('chartViews', 220, '16,185,129'),
                fill: true
            }]
        },
        options: chartOpts
    });

    if (chartLikesDislikes) chartLikesDislikes.destroy();
    chartLikesDislikes = new Chart(document.getElementById('chartLikesDislikes'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Likes', data: likesData, backgroundColor: '#10B981', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 },
                { label: 'Dislikes', data: dislikesData, backgroundColor: '#EF4444', borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12, font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } },
                y: { beginAtZero: true, grid: { color: '#F3F4F6', drawBorder: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9CA3AF' } }
            }
        }
    });

    // Sparklines
    const sparklineOpts = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        elements: { line: { tension: 0.4, borderWidth: 2 }, point: { radius: 0 } },
        layout: { padding: 0 }
    };

    if (chartSparkSubs) chartSparkSubs.destroy();
    chartSparkSubs = new Chart(document.getElementById('sparkSubs'), {
        type: 'line',
        data: { labels, datasets: [{ data: subsData, borderColor: '#3B82F6', backgroundColor: getGradient('sparkSubs', 40, '59,130,246'), fill: true }] },
        options: sparklineOpts
    });

    if (chartSparkViews) chartSparkViews.destroy();
    chartSparkViews = new Chart(document.getElementById('sparkViews'), {
        type: 'line',
        data: { labels, datasets: [{ data: viewsData, borderColor: '#A855F7', backgroundColor: getGradient('sparkViews', 40, '168,85,247'), fill: true }] },
        options: sparklineOpts
    });

    if (chartSparkLikes) chartSparkLikes.destroy();
    chartSparkLikes = new Chart(document.getElementById('sparkLikes'), {
        type: 'line',
        data: { labels, datasets: [{ data: likesData, borderColor: '#10B981', backgroundColor: getGradient('sparkLikes', 40, '16,185,129'), fill: true }] },
        options: sparklineOpts
    });

    if (chartSparkDislikes) chartSparkDislikes.destroy();
    chartSparkDislikes = new Chart(document.getElementById('sparkDislikes'), {
        type: 'line',
        data: { labels, datasets: [{ data: dislikesData, borderColor: '#EF4444', backgroundColor: getGradient('sparkDislikes', 40, '239,68,68'), fill: true }] },
        options: sparklineOpts
    });
}

window.setStatsPeriod = function (period) {
    statsPeriod = period;
    document.querySelectorAll('.stats-period-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'text-gray-800', 'shadow-sm', 'border-gray-100');
        btn.classList.add('text-gray-500', 'border-transparent');
    });
    const activeBtn = document.getElementById(`stats-period-${period}`);
    if (activeBtn) {
        activeBtn.classList.add('bg-white', 'text-gray-800', 'shadow-sm', 'border-gray-100');
        activeBtn.classList.remove('text-gray-500', 'border-transparent');
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

// ═════════════════════════════════════════════════════════════════════════════
//  LEARNING PATHS LOGIC
// ═════════════════════════════════════════════════════════════════════════════

async function loadLearningPaths() {
    const listEl = document.getElementById('paths-list');
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="col-span-full text-center p-12"><i class="fa-solid fa-spinner fa-spin text-2xl text-cubby-purple"></i></div>';

    try {
        const paths = await DataService.getPaths();
        // Filter by current creator (optional, but good practice if API returns all)
        creatorPaths = paths.filter(p => p.creatorId === currentUser.$id || p.creatorEmail === currentUser.email);

        if (creatorPaths.length === 0) {
            listEl.innerHTML = `
                <div class="col-span-full py-20 text-center text-gray-400 font-bold bg-white rounded-2xl border-2 border-dashed border-gray-100">
                    <i class="fa-solid fa-route text-4xl mb-3 opacity-20"></i>
                    <p>No learning paths yet. Start building one!</p>
                </div>`;
            return;
        }

        listEl.innerHTML = creatorPaths.map(path => {
            const videoCount = (path.videoIds || []).length;
            return `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group">
                    <div class="h-32 bg-gradient-to-br from-purple-500 to-indigo-600 p-6 flex items-end">
                        <div class="text-white">
                            <h4 class="font-black text-lg line-clamp-1">${escapeHtml(path.title)}</h4>
                            <p class="text-white/70 text-xs font-bold uppercase tracking-wider">${path.type || 'Sequential'}</p>
                        </div>
                    </div>
                    <div class="p-5">
                        <p class="text-sm text-gray-500 line-clamp-2 mb-4 h-10">${escapeHtml(path.description || 'No description provided.')}</p>
                        <div class="flex items-center justify-between mt-auto">
                            <div class="flex items-center gap-3">
                                <div class="bg-gray-50 px-3 py-1.5 rounded-lg text-center">
                                    <span class="block text-sm font-black text-gray-700">${videoCount}</span>
                                    <span class="block text-[8px] font-bold text-gray-400 uppercase">Videos</span>
                                </div>
                                <div class="bg-gray-50 px-3 py-1.5 rounded-lg text-center">
                                    <span class="block text-sm font-black text-cubby-blue">${path.bonusPoints || 0}</span>
                                    <span class="block text-[8px] font-bold text-gray-400 uppercase">Bonus</span>
                                </div>
                            </div>
                            <button onclick="editLearningPath('${path.$id}')" class="text-gray-400 hover:text-cubby-purple transition-colors p-2">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                        </div>
                    </div>
                </div>`;
        }).join('');

    } catch (e) {
        console.error('Load paths error:', e);
        listEl.innerHTML = '<div class="col-span-full text-center p-12 text-red-400 font-bold">Error loading learning paths</div>';
    }
}

window.openCreatePathModal = function() {
    try {
        editingPathId = null;
        selectedPathVideos = [];
        document.getElementById('path-title').value = '';
        document.getElementById('path-description').value = '';
        document.getElementById('path-type').value = 'sequential';
        document.getElementById('path-bonus').value = 50;

        // Update Modal Title & Button (guard against missing elements)
        const modalTitle = document.querySelector('#path-create-modal h3');
        if (modalTitle) modalTitle.textContent = 'Create Learning Path';
        const saveBtn = document.getElementById('save-path-btn');
        if (saveBtn) saveBtn.textContent = 'Create Learning Path';

        // Remove delete button if exists
        const existingDel = document.getElementById('delete-path-btn');
        if (existingDel) existingDel.remove();

        renderSelectedVideos();
        renderAvailableVideos();

        document.getElementById('path-create-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        console.error('openCreatePathModal error:', e);
        // Make sure we never leave the page locked
        document.body.style.overflow = '';
    }
};

window.editLearningPath = function(pathId) {
    try {
        const path = creatorPaths.find(p => p.$id === pathId);
        if (!path) return;

        editingPathId = pathId;
        document.getElementById('path-title').value = path.title;
        document.getElementById('path-description').value = path.description || '';
        document.getElementById('path-type').value = path.type || 'sequential';
        document.getElementById('path-bonus').value = path.bonusPoints || 50;

        // Load selected videos from ID list
        selectedPathVideos = (path.videoIds || []).map(id => {
            return creatorVideos.find(v => v.$id === id) || { $id: id, title: 'Unknown Video', url: '' };
        });

        // Update Modal Title & Button (guard against missing elements)
        const modalTitle = document.querySelector('#path-create-modal h3');
        if (modalTitle) modalTitle.textContent = 'Edit Learning Path';
        const saveBtn = document.getElementById('save-path-btn');
        if (saveBtn) saveBtn.textContent = 'Save Changes';

        // Add Delete Button if not exists
        let delBtn = document.getElementById('delete-path-btn');
        if (!delBtn) {
            delBtn = document.createElement('button');
            delBtn.id = 'delete-path-btn';
            delBtn.className = 'text-red-500 hover:text-red-700 font-bold text-xs mr-auto ml-6';
            delBtn.innerHTML = '<i class="fa-solid fa-trash mr-1"></i> Delete Path';
            delBtn.onclick = () => deleteLearningPath(pathId);
            const footer = document.querySelector('#path-create-modal .p-6.border-t');
            if (footer) footer.prepend(delBtn);
        }

        renderSelectedVideos();
        renderAvailableVideos();

        document.getElementById('path-create-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        console.error('editLearningPath error:', e);
        // Make sure we never leave the page locked
        document.body.style.overflow = '';
    }
};

async function deleteLearningPath(pathId) {
    if (!confirm('Are you sure you want to delete this learning path? This cannot be undone.')) return;

    try {
        await DataService.deletePath(pathId);
        closeCreatePathModal();
        loadLearningPaths();
    } catch (e) {
        console.error('Delete path error:', e);
        alert('Failed to delete path.');
    }
}

window.closeCreatePathModal = function() {
    document.getElementById('path-create-modal').classList.add('hidden');
    document.body.style.overflow = '';
};

async function renderAvailableVideos() {
    const container = document.getElementById('available-videos-list');
    if (!container) return;

    // Use creatorVideos if loaded, otherwise fetch
    let videos = creatorVideos.filter(v => v.status === 'approved');
    if (videos.length === 0) {
         // Try loading again
         await loadMyUploads();
         videos = creatorVideos.filter(v => v.status === 'approved');
    }

    if (videos.length === 0) {
        container.innerHTML = '<p class="col-span-full text-center text-xs text-gray-400 py-4">No approved videos found to add.</p>';
        return;
    }

    container.innerHTML = videos.map(v => {
        const isAdded = selectedPathVideos.find(sv => sv.$id === v.$id);
        return `
            <div class="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100 hover:border-purple-200 transition-colors cursor-pointer"
                 onclick="toggleVideoInPath('${v.$id}')">
                <div class="w-16 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                    ${getVideoThumbnail(v.url)}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[10px] font-bold text-gray-800 truncate">${escapeHtml(v.title)}</p>
                    <p class="text-[8px] text-gray-400">${v.category || 'General'}</p>
                </div>
                <div class="w-6 h-6 rounded-full flex items-center justify-center ${isAdded ? 'bg-cubby-purple text-white' : 'bg-gray-100 text-gray-300'}">
                    <i class="fa-solid ${isAdded ? 'fa-check' : 'fa-plus'} text-[10px]"></i>
                </div>
            </div>`;
    }).join('');
}

window.toggleVideoInPath = function(videoId) {
    const video = creatorVideos.find(v => v.$id === videoId);
    if (!video) return;

    const index = selectedPathVideos.findIndex(v => v.$id === videoId);
    if (index > -1) {
        selectedPathVideos.splice(index, 1);
    } else {
        selectedPathVideos.push(video);
    }

    renderSelectedVideos();
    renderAvailableVideos();
};

function renderSelectedVideos() {
    const container = document.getElementById('path-video-selection');
    const countEl = document.getElementById('path-video-count');
    const saveBtn = document.getElementById('save-path-btn');
    
    if (selectedPathVideos.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 text-xs font-bold">No videos added yet. Select from your approved videos below.</div>';
        countEl.textContent = '0 Videos Selected';
        saveBtn.disabled = true;
        return;
    }

    saveBtn.disabled = false;
    countEl.textContent = `${selectedPathVideos.length} Videos Selected`;

    container.innerHTML = selectedPathVideos.map((v, idx) => `
        <div class="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-gray-100 group">
            <span class="text-xs font-black text-gray-300 w-4">${idx + 1}</span>
            <div class="w-20 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                ${getVideoThumbnail(v.url)}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-xs font-bold text-gray-800 truncate">${escapeHtml(v.title)}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="moveVideoInPath(${idx}, -1)" class="p-1.5 text-gray-400 hover:text-cubby-purple" ${idx === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-up text-xs"></i>
                </button>
                <button onclick="moveVideoInPath(${idx}, 1)" class="p-1.5 text-gray-400 hover:text-cubby-purple" ${idx === selectedPathVideos.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-chevron-down text-xs"></i>
                </button>
                <button onclick="toggleVideoInPath('${v.$id}')" class="p-1.5 text-gray-400 hover:text-red-500">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

window.moveVideoInPath = function(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= selectedPathVideos.length) return;
    
    const temp = selectedPathVideos[index];
    selectedPathVideos[index] = selectedPathVideos[newIndex];
    selectedPathVideos[newIndex] = temp;
    
    renderSelectedVideos();
};

window.saveLearningPath = async function() {
    const title = document.getElementById('path-title').value.trim();
    const description = document.getElementById('path-description').value.trim();
    const type = document.getElementById('path-type').value;
    const bonus = parseInt(document.getElementById('path-bonus').value) || 0;

    if (!title) { alert('Please enter a title for the path.'); return; }
    if (selectedPathVideos.length === 0) { alert('Please add at least one video to the path.'); return; }

    const saveBtn = document.getElementById('save-path-btn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Saving...';

    try {
        const pathData = {
            title,
            description,
            type,
            bonusPoints: bonus,
            videoIds: selectedPathVideos.map(v => v.$id),
            creatorId: currentUser.$id,
            creatorEmail: currentUser.email
        };

        // FIX: Branch on editingPathId — use update for edits, add for new paths.
        if (editingPathId) {
            await DataService.updatePath(editingPathId, pathData);
            closeCreatePathModal();
            loadLearningPaths();
            alert('Learning Path updated successfully! ✅');
        } else {
            await DataService.addPath(pathData);
            closeCreatePathModal();
            loadLearningPaths();
            alert('Learning Path created successfully! 🚀');
        }

    } catch (e) {
        console.error('Save path error:', e);
        alert('Failed to save learning path. Please try again.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = editingPathId ? 'Save Changes' : 'Create Learning Path';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATOR PROFILE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Saves creator profile (bio, tags) to Appwrite Account Preferences.
 * Tags are stored as a comma-separated string.
 *
 * Call from a "Save Profile" button: onclick="saveCreatorProfile()"
 * Reads values from: #creator-bio, #creator-tags
 */
window.saveCreatorProfile = async function () {
    // Creator uses a real Appwrite Auth session via DataService.account
    let session = null;
    try {
        const { account } = DataService._getServices();
        session = await account.get();
    } catch (e) {
        alert('Session not found. Please log in again.');
        return;
    }

    const bioEl  = document.getElementById('creator-bio');
    const tagsEl = document.getElementById('creator-tags');

    const bio  = bioEl  ? bioEl.value.trim()  : '';
    const tags = tagsEl ? tagsEl.value.trim() : '';

    const saveBtn = document.getElementById('creator-save-profile-btn');
    const originalHtml = saveBtn ? saveBtn.innerHTML : null;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
    }

    try {
        await DataService.updateUserProfile(session.$id, {
            prefs: { bio, tags }
        });

        // Refresh in-page state
        if (currentUser) {
            if (!currentUser.prefs) currentUser.prefs = {};
            currentUser.prefs.bio  = bio;
            currentUser.prefs.tags = tags;
        }

        console.log('✅ [saveCreatorProfile] Bio and tags saved.');
        alert('Profile saved! ✅');
    } catch (e) {
        console.error('[saveCreatorProfile] Error:', e);
        alert('❌ Could not save profile: ' + e.message + '\n\nYour changes were NOT saved.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    }
};