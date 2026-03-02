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
        if (tabName === 'moderation') loadChatReports();
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
        const allUsers = await DataService.getAllUsers();
        const pendingParentsCount = allUsers.filter(u => u.role === 'parent' && u.status === 'pending').length;

        const pendingVideos = await DataService.getVideos('pending');
        const pendingVideosCount = pendingVideos.length;

        const flaggedLogs = await DataService.getThreatLogs('pending');
        const flaggedCount = flaggedLogs.length;

        // Update stat cards by ID (reliable)
        const pendingParentsEl = document.getElementById('stat-pending-parents');
        const chatReportsEl = document.getElementById('stat-chat-reports');
        const videoReviewEl = document.getElementById('stat-video-review');
        const totalTasksEl = document.getElementById('overview-total-tasks');

        if (pendingParentsEl) pendingParentsEl.innerText = pendingParentsCount;
        if (chatReportsEl) chatReportsEl.innerText = flaggedCount;
        if (videoReviewEl) videoReviewEl.innerText = pendingVideosCount;

        // Update welcome banner total
        const total = pendingParentsCount + pendingVideosCount + flaggedCount;
        if (totalTasksEl) {
            totalTasksEl.innerText = total === 0
                ? 'no tasks'
                : `${total} new task${total !== 1 ? 's' : ''}`;
        }

        // Also refresh sidebar badges
        updateBadge('verification', pendingParentsCount);
        updateBadge('moderation', flaggedCount);
        updateBadge('content', pendingVideosCount);

    } catch (error) {
        console.error("Error loading stats:", error);
    }
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

        for (const parent of pendingParents) {
            // Render the card first with loading spinners for images
            const html = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dashboard-card mb-4" id="user-${parent.$id}">
                    <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                        <span class="font-bold text-gray-700 text-sm">${parent.firstName} ${parent.lastName}</span>
                        <span class="text-xs text-gray-400"><i class="fa-regular fa-envelope"></i> ${parent.email}</span>
                    </div>
                    <div class="p-6">
                        <div class="flex flex-col md:flex-row gap-8 items-center justify-center mb-6">
                             <div class="text-center w-full md:w-1/2">
                                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Uploaded ID</p>
                                <div class="rounded-lg shadow-inner bg-gray-100 border border-gray-200 w-full h-48 flex items-center justify-center overflow-hidden" id="id-container-${parent.$id}">
                                    ${parent.idDocumentId
                    ? `<i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i>`
                    : `<div class="text-gray-400 flex flex-col items-center"><i class="fa-solid fa-id-card text-3xl mb-2"></i><span>No ID Uploaded</span></div>`
                }
                                </div>
                            </div>
                            <div class="text-center w-full md:w-1/2">
                                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Live Photo / Avatar</p>
                                <div class="rounded-lg shadow-inner bg-gray-100 border border-gray-200 w-full h-48 flex items-center justify-center overflow-hidden" id="face-container-${parent.$id}">
                                    <i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i>
                                </div>
                            </div>
                        </div>

                        <div class="text-center w-full mb-6">
                            <p class="text-xs font-bold text-gray-400 uppercase mb-2">Details provided</p>
                            <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100 text-left">
                                <p class="mb-1"><strong><i class="fa-solid fa-user mr-2"></i>Name:</strong> ${parent.firstName} ${parent.middleName || ''} ${parent.lastName}</p>
                                <p class="mb-1"><strong><i class="fa-solid fa-envelope mr-2"></i>Email:</strong> ${parent.email}</p>
                                <p class="mb-1"><strong><i class="fa-solid fa-calendar mr-2"></i>Joined:</strong> ${new Date(parent.createdAt).toLocaleDateString()}</p>
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

            // Now async-load the actual images using SDK auth (handles private buckets)
            _loadVerificationImages(parent);
        }

    } catch (error) {
        console.error("Error loading parents:", error);
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error loading data: ${error.message}</div>`;
    }
}

async function updateParentStatus(userId, status) {
    const action = status === 'active' ? 'Approve' : 'Reject';
    if (confirm(`${action} this parent? Their verification photos will be deleted after.`)) {
        try {
            // 1. Update the status (approve or reject)
            await DataService.updateUserStatus(userId, status);

            // 2. Delete their ID photo & face selfie from Storage (frees up space + protects privacy)
            await DataService.cleanupParentVerificationFiles(userId);

            // 3. Reload UI
            loadPendingParents();
            loadOverviewStats();
        } catch (error) {
            alert("Error updating status: " + error.message);
        }
    }
}

// --- VIDEO REVIEW ---

/**
 * Fetches parent verification images from Appwrite Storage using authenticated fetch
 * (with credentials: 'include') and sets blob URLs as img src.
 * This is necessary because <img> tags cannot send cross-origin session cookies,
 * which private Appwrite buckets require.
 */
async function _loadVerificationImages(parent) {
    const svc = window.AppwriteService;
    if (!svc) return;

    const endpoint = (svc.client?.config?.endpoint || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
    const projectId = svc.client?.config?.project || '69904f4900396667cf4c';
    const bucketId = svc.BUCKET_PARENT_DOCS || 'parent_docs';

    const fetchImage = async (fileId, jwtToken) => {
        const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
        const res = await fetch(url, {
            headers: {
                'X-Appwrite-Project': projectId,
                'X-Appwrite-JWT': jwtToken
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    };

    // Create a short-lived JWT to authenticate storage reads for this session
    // (needed because <img> tags / cross-origin fetch can't send Appwrite session cookies)
    let jwt = '';
    try {
        const jwtResult = await svc.account.createJWT();
        jwt = jwtResult.jwt;
    } catch (e) {
        console.warn('Could not create JWT for image fetch:', e.message);
    }

    // Load face / selfie
    const faceContainer = document.getElementById(`face-container-${parent.$id}`);
    if (faceContainer) {
        if (parent.faceId && !parent.faceId.startsWith('mock_') && parent.faceId !== 'deleted') {
            try {
                const blobUrl = await fetchImage(parent.faceId, jwt);
                faceContainer.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover">`;
            } catch (e) {
                console.warn(`Could not load face image for ${parent.$id}:`, e.message);
                // Fallback to avatar
                const seed = encodeURIComponent(parent.firstName);
                faceContainer.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}" class="w-full h-full object-cover">`;
            }
        } else {
            const seed = encodeURIComponent(parent.firstName);
            faceContainer.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}" class="w-full h-full object-cover">`;
        }
    }

    // Load ID document
    const idContainer = document.getElementById(`id-container-${parent.$id}`);
    if (idContainer && parent.idDocumentId && parent.idDocumentId !== 'deleted') {
        try {
            const blobUrl = await fetchImage(parent.idDocumentId, jwt);
            idContainer.innerHTML = `<img src="${blobUrl}" class="w-full h-full object-cover">`;
        } catch (e) {
            console.warn(`Could not load ID image for ${parent.$id}:`, e.message);
            idContainer.innerHTML = `<div class="text-gray-400 flex flex-col items-center"><i class="fa-solid fa-id-card text-3xl mb-2"></i><span>Could not load ID</span></div>`;
        }
    }
}

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

// --- CHAT MODERATION ---

async function loadChatReports() {
    const container = document.getElementById('tab-moderation');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';

    try {
        const reports = await DataService.getThreatLogs('pending');

        container.innerHTML = '';

        if (reports.length === 0) {
            container.innerHTML = `
                <div class="text-center p-12 bg-white rounded-xl shadow-sm border border-gray-100">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500 text-2xl">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <h3 class="text-lg font-bold text-gray-800">Safe & Sound!</h3>
                    <p class="text-gray-500">No chat reports or threats pending review.</p>
                </div>
            `;
            updateBadge('moderation', 0);
            return;
        }

        updateBadge('moderation', reports.length);

        reports.forEach(report => {
            const html = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dashboard-card mb-4" id="report-${report.$id}">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-gray-800">Flagged Message</h3>
                            <p class="text-xs text-gray-500">Reason: <span class="text-red-500 font-bold">${report.reason || 'Keyword Detetced'}</span></p>
                            <p class="text-xs text-gray-400 mt-1">From: ${report.senderId || 'Unknown'} -> To: ${report.receiverId || 'Global'}</p>
                        </div>
                        <span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">High Priority</span>
                    </div>
                    <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-3 mb-6">
                        <div class="flex gap-2 p-2 bg-red-50 border border-red-100 rounded-md">
                            <span class="text-xs font-bold text-red-500">Message:</span>
                            <span class="text-xs text-red-700 font-bold">${report.messageContent}</span>
                        </div>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 border-t border-gray-100 p-4 -mx-6 -mb-6 mt-4">
                        <div class="flex gap-2 items-center bg-white p-1.5 rounded-lg border border-gray-200">
                            <select id="ban-time-${report.$id}" class="text-xs border-none bg-transparent focus:ring-0 text-gray-600 font-bold outline-none cursor-pointer">
                                <option value="3600000">1 hour</option>
                                <option value="18000000">5 hours</option>
                                <option value="86400000">1 day</option>
                                <option value="604800000">1 week</option>
                                <option value="2592000000">1 month</option>
                            </select>
                            <button onclick="handleBanUser('${report.$id}', '${report.senderId}', document.getElementById('ban-time-${report.$id}').value)" class="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-red-600 transition-colors">Ban Sender</button>
                        </div>
                        
                        <div class="flex gap-2">
                            <button onclick="resolveReport('${report.$id}', 'dismissed')" class="text-sm font-bold text-gray-500 hover:text-gray-700 px-3 py-2">Dismiss</button>
                            <button onclick="handleAlertParents('${report.$id}', '${report.senderId}', '${report.receiverId}')" class="bg-blue-100 text-blue-600 text-sm font-bold px-4 py-2 rounded-lg hover:bg-blue-200 transition-colors"><i class="fa-solid fa-bell mr-1"></i> Alert Parents</button>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error("Error loading chat reports:", error);
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error loading data: ${error.message}</div>`;
    }
}

async function resolveReport(reportId, action) {
    if (!confirm("Resolve this report as " + action + "?")) return;

    try {
        await DataService.updateThreatLog(reportId, 'resolved', action);
        loadChatReports();
        loadOverviewStats();
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function handleAlertParents(reportId, senderId, receiverId) {
    if (!confirm("Alert both parents about this report?")) return;
    try {
        await DataService.alertParentsOfReport(senderId, receiverId);
        await DataService.updateThreatLog(reportId, 'resolved', 'alerted parents');
        loadChatReports();
        loadOverviewStats();
        alert("Parents have been successfully alerted.");
    } catch (e) {
        alert("Error: " + e.message);
    }
}

async function handleBanUser(reportId, senderId, durationMs) {
    if (!confirm("Ban this user from chatting for the selected duration?")) return;
    try {
        await DataService.banChildFromChat(senderId, parseInt(durationMs));
        await DataService.updateThreatLog(reportId, 'resolved', 'banned user');
        loadChatReports();
        loadOverviewStats();
        alert("User banned and their parent notified.");
    } catch (e) {
        alert("Error: " + e.message);
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
window.resolveReport = resolveReport;
window.handleAlertParents = handleAlertParents;
window.handleBanUser = handleBanUser;