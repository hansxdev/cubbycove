// Logic for staff/assistant_panel.html

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initAssistantPanel();

    // Tab Switching
    window.showTab = function (tabName) {
        document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
        document.querySelectorAll('nav a').forEach(a => {
            a.classList.remove('bg-cubby-blue/20', 'text-cubby-blue', 'border-cubby-blue');
            a.classList.add('text-gray-400', 'border-transparent');
        });

        const targetDiv = document.getElementById(`tab-${tabName}`);
        const targetNav = document.getElementById(`nav-${tabName}`);

        if (targetDiv) targetDiv.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('bg-cubby-blue/20', 'text-cubby-blue', 'border-cubby-blue');
            targetNav.classList.remove('text-gray-400', 'border-transparent');
        }

        if (tabName === 'overview') loadOverviewStats();
        if (tabName === 'verification') loadPendingParents();
        if (tabName === 'content') loadPendingVideos();
        // Chat reports todo
    };
});

async function initAssistantPanel() {
    // BACK BUTTON GUARD
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function () {
        window.history.pushState(null, "", window.location.href);
    };

    try {
        currentUser = await DataService.getCurrentUser();
    } catch (e) {
        console.error("Auth Check Failed:", e);
        window.location.href = '../staff_access.html';
        return;
    }

    // Auth Check
    if (!currentUser || !['assistant', 'admin', 'super_admin'].includes(currentUser.role)) {
        window.location.href = '../staff_access.html';
        return;
    }

    // Update Header
    const nameEl = document.getElementById('header-name');
    const roleEl = document.getElementById('header-role');
    const avatarEl = document.getElementById('header-avatar');

    if (nameEl) nameEl.innerText = `${currentUser.firstName} ${currentUser.lastName}`;
    if (roleEl) roleEl.innerText = currentUser.role;
    if (avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.firstName}`;

    // Initial Load
    loadOverviewStats();
}

function handleLogout() {
    DataService.logout();
    window.location.href = '../staff_access.html';
}
window.handleLogout = handleLogout;

// --- OVERVIEW STATS ---
async function loadOverviewStats() {
    try {
        // Parallel fetch for verify and content stats
        // We fetch the full lists because we don't have a specific "count" API easily accessible without listing
        // For production, use limit=1 to save bandwidth if just counting, but getAllUsers gets 100 max anyway.

        const allUsers = await DataService.getAllUsers();
        const pendingParentsCount = allUsers.filter(u => u.role === 'parent' && u.status === 'pending').length;

        const pendingVideos = await DataService.getVideos('pending');
        const pendingVideosCount = pendingVideos.length;

        // Update Dashboard Cards
        updateOverviewCard('Pending Parents', pendingParentsCount);
        updateOverviewCard('Video Review', pendingVideosCount);

        // Chat reports not linked yet
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

function updateOverviewCard(title, count) {
    // Helper to find card by text content (fragile but works for now without IDs on cards)
    const cardTitles = document.querySelectorAll('.text-xs.font-bold.text-gray-400.uppercase.tracking-widest');
    cardTitles.forEach(el => {
        if (el.textContent.includes(title)) {
            const countEl = el.nextElementSibling; // The h3
            if (countEl) countEl.innerText = count;
        }
    });
}


// --- PARENT VERIFICATION ---

async function loadPendingParents() {
    const container = document.getElementById('tab-verification');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';

    try {
        const allUsers = await DataService.getAllUsers();
        const pendingParents = allUsers.filter(u => u.role === 'parent' && u.status === 'pending');

        container.innerHTML = '';

        if (pendingParents.length === 0) {
            container.innerHTML = `
                <div class="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500 text-2xl">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800">All Cleared!</h3>
                    <p class="text-gray-500">No pending parent registrations.</p>
                </div>
            `;
            updateBadge('verification', 0);
            return;
        }

        updateBadge('verification', pendingParents.length);

        pendingParents.forEach(parent => {
            const html = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dashboard-card mb-4" id="user-${parent.$id}">
                    <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                        <span class="font-bold text-gray-700 text-sm">${parent.firstName} ${parent.lastName}</span>
                        <span class="text-xs text-gray-400"><i class="fa-regular fa-envelope"></i> ${parent.email}</span>
                    </div>
                    <div class="p-6">
                        <div class="flex flex-col md:flex-row gap-8 items-center justify-center">
                            <div class="text-center w-full md:w-1/2">
                                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Details provided</p>
                                <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100 text-left">
                                    <p class="mb-1"><strong><i class="fa-solid fa-user mr-2"></i>Name:</strong> ${parent.firstName} ${parent.middleName || ''} ${parent.lastName}</p>
                                    <p class="mb-1"><strong><i class="fa-solid fa-envelope mr-2"></i>Email:</strong> ${parent.email}</p>
                                    <p class="mb-1"><strong><i class="fa-solid fa-calendar mr-2"></i>Joined:</strong> ${new Date(parent.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                        <div class="mt-8 flex gap-4">
                            <button onclick="updateParentStatus('${parent.$id}', 'rejected')" class="flex-1 py-3 border-2 border-red-100 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors">
                                <i class="fa-solid fa-xmark mr-1"></i> Reject
                            </button>
                            <button onclick="updateParentStatus('${parent.$id}', 'active')" class="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors">
                                <i class="fa-solid fa-check mr-1"></i> Approve Parent
                            </button>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error("Error loading parents:", error);
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error loading data: ${error.message}</div>`;
    }
}

async function updateParentStatus(userId, status) {
    if (confirm(`Set status to ${status}?`)) {
        try {
            await DataService.updateUserStatus(userId, status);
            // Reload to refresh list
            loadPendingParents();
            loadOverviewStats(); // Update counters
        } catch (error) {
            alert("Error updating status: " + error.message);
        }
    }
}

// --- VIDEO REVIEW ---

async function loadPendingVideos() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';

    try {
        const pendingVideos = await DataService.getVideos('pending');

        container.innerHTML = '';

        if (pendingVideos.length === 0) {
            container.innerHTML = `
                 <div class="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 text-2xl">
                        <i class="fa-solid fa-film"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800">All caught up!</h3>
                    <p class="text-gray-500">No videos pending review.</p>
                </div>
            `;
            updateBadge('content', 0);
            return;
        }

        updateBadge('content', pendingVideos.length);

        pendingVideos.forEach(video => {
            // Extract ID if URL is full (Helper)
            let videoThumbnailId = video.url;
            if (video.url.includes('v=')) videoThumbnailId = video.url.split('v=')[1].split('&')[0];
            else if (video.url.includes('youtu.be/')) videoThumbnailId = video.url.split('youtu.be/')[1];

            const html = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dashboard-card mb-4" id="video-${video.$id}">
                    <div class="flex flex-col md:flex-row">
                        <!-- Thumbnail/Embed -->
                        <div class="w-full md:w-1/3 bg-black relative group h-48 md:h-auto">
                            <iframe class="w-full h-full" src="https://www.youtube.com/embed/${videoThumbnailId}" frameborder="0" allowfullscreen></iframe>
                        </div>
                        
                        <!-- Details -->
                        <div class="p-6 flex-1 flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="font-bold text-lg text-gray-800">${video.title}</h3>
                                    <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Category: ${video.category}</span>
                                </div>
                                <p class="text-sm text-gray-600 mb-4">Uploaded by: <span class="text-cubby-purple font-bold">${video.creatorEmail || 'Unknown'}</span></p>
                                <p class="text-xs text-gray-500">Submitted: ${new Date(video.uploadedAt).toLocaleString()}</p>
                            </div>

                            <div class="mt-6 flex gap-3">
                                <button onclick="updateVideoStatus('${video.$id}', 'rejected')" class="px-4 py-2 border border-red-200 text-red-500 font-bold rounded-lg hover:bg-red-50 text-sm transition-colors">
                                    <i class="fa-solid fa-ban mr-1"></i> Reject
                                </button>
                                <button onclick="updateVideoStatus('${video.$id}', 'approved')" class="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 text-sm shadow-md transition-colors">
                                    <i class="fa-solid fa-check mr-1"></i> Approve & Publish
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });
    } catch (error) {
        console.error("Error loading videos:", error);
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error loading data: ${error.message}</div>`;
    }
}

async function updateVideoStatus(videoId, status) {
    if (confirm(`Check this video as ${status}?`)) {
        try {
            await DataService.updateVideoStatus(videoId, status);
            loadPendingVideos();
            loadOverviewStats();
        } catch (error) {
            alert("Error updating status: " + error.message);
        }
    }
}

function updateBadge(tab, count) {
    const badge = document.querySelector(`#nav-${tab} span`);
    if (badge) {
        badge.innerText = count;
        if (count === 0) badge.classList.add('hidden');
        else badge.classList.remove('hidden');
    }
}

// Expose globally
window.updateParentStatus = updateParentStatus;
window.updateVideoStatus = updateVideoStatus;