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
    showConfirm(`${action} this parent? Their verification photos will be deleted after.`, async () => {
        try {
            await DataService.updateUserStatus(userId, status);
            await DataService.cleanupParentVerificationFiles(userId);
            loadPendingParents();
            loadOverviewStats();
        } catch (error) {
            alert('Error updating status: ' + error.message);
        }
    });
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
    const label = status === 'approved' ? 'Approve' : 'Reject';
    showConfirm(`${label} this video?`, async () => {
        try {
            await DataService.updateVideoStatus(videoId, status);
            loadPendingVideos();
            loadOverviewStats();
        } catch (error) {
            alert('Error updating status: ' + error.message);
        }
    });
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
                    <h3 class="text-lg font-bold text-gray-800">Safe &amp; Sound!</h3>
                    <p class="text-gray-500">No chat reports pending review.</p>
                </div>`;
            updateBadge('moderation', 0);
            return;
        }

        updateBadge('moderation', reports.length);

        // Store reports in a map so onclick handlers can look them up without
        // passing complex data through HTML attribute strings (which breaks quoting)
        _reportMap.clear();
        reports.forEach(report => _reportMap.set(report.$id, report));

        reports.forEach(report => {
            const violationBadge = report.violationType
                ? `<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">${report.violationType}</span>`
                : `<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">Reported</span>`;

            const html = `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 dashboard-card mb-4" id="report-${report.$id}">

                    <!-- Header -->
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="font-bold text-gray-800">Chat Report</h3>
                        ${violationBadge}
                    </div>

                    <!-- 5 Required Info Fields -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div class="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p class="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Reporter (Victim) Child</p>
                            <p class="font-bold text-gray-800 text-sm">${report.reporterChildName || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">${report.reporterParentEmail || 'N/A'}</p>
                        </div>
                        <div class="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Reported (Sender) Child</p>
                            <p class="font-bold text-gray-800 text-sm">${report.reportedChildName || report.childId || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">${report.reportedParentEmail || 'N/A'}</p>
                        </div>
                    </div>

                    <!-- Reported Message -->
                    <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p class="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">Reported Message</p>
                        <p class="text-sm text-red-800 font-semibold break-words">&ldquo;${(report.messageContent || report.content || 'No content').replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;</p>
                    </div>

                    <!-- Actions -->
                    <div class="flex gap-3 border-t border-gray-100 pt-4">
                        <button onclick="handleDenyReport('${report.$id}')" class="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                            <i class="fa-solid fa-xmark mr-1"></i> Deny
                        </button>
                        <button onclick="openViolationPicker('${report.$id}')"
                            class="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors shadow-sm text-sm">
                            <i class="fa-solid fa-gavel mr-1"></i> Confirm Violation
                        </button>
                    </div>
                </div>`;
            container.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error('Error loading chat reports:', error);
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error loading data: ${error.message}</div>`;
    }
}

// Map of report $id → full report doc — avoids embedding complex data in onclick attributes
const _reportMap = new Map();

// State for violation picker
let _vpReportId = '', _vpReportedId = '', _vpReporterId = '', _vpMsgText = '';

window.openViolationPicker = function (reportId) {
    const report = _reportMap.get(reportId);
    if (!report) {
        alert('Report data not found. Please reload the page.');
        return;
    }
    _vpReportId = report.$id;
    _vpReportedId = report.reportedChildId || report.childId || '';
    _vpReporterId = report.reporterChildId || '';
    _vpMsgText = report.messageContent || report.content || '';

    document.querySelectorAll('input[name="mute-duration"]').forEach(r => r.checked = false);
    const modal = document.getElementById('violation-picker-modal');
    if (modal) modal.classList.remove('hidden');
    else alert('Violation picker modal not found in HTML.');
};

window.submitViolationPicker = function () {
    const sel = document.querySelector('input[name="mute-duration"]:checked');
    if (!sel) { alert('Please choose a mute duration.'); return; }
    const { value: durationMs, dataset: { label: durationLabel } } = sel;
    document.getElementById('violation-picker-modal').classList.add('hidden');

    showConfirm(`Mute this child for ${durationLabel} and notify both parents?`, async () => {
        try {
            await DataService.banChildFromChat(_vpReportedId, parseInt(durationMs));
            await DataService.alertParentsOfReport(_vpReportedId, _vpReporterId, _vpMsgText, durationLabel);
            await DataService.updateThreatLog(_vpReportId, 'resolved', `muted:${durationLabel}`);
            loadChatReports();
            loadOverviewStats();
            alert('Violation confirmed. Child muted and parents notified.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
};

window.handleDenyReport = function (reportId) {
    showConfirm('Are you sure you want to deny this report? No action will be taken.', async () => {
        try {
            await DataService.updateThreatLog(reportId, 'resolved', 'dismissed');
            loadChatReports();
            loadOverviewStats();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
};

async function resolveReport(reportId, action) {
    showConfirm('Resolve this report as ' + action + '?', async () => {
        try {
            await DataService.updateThreatLog(reportId, 'resolved', action);
            loadChatReports();
            loadOverviewStats();
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
}

// Legacy kept for backward compat
async function handleAlertParents(reportId, reportedId, reporterId) {
    showConfirm('Alert both parents about this report?', async () => {
        try {
            const report = { $id: reportId, reportedChildId: reportedId, reporterChildId: reporterId, messageContent: '' };
            await DataService.alertParentsOfReport(reportedId, reporterId, '', '');
            await DataService.updateThreatLog(reportId, 'resolved', 'alerted parents');
            loadChatReports();
            loadOverviewStats();
            alert('Parents have been successfully alerted.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
}

async function handleBanUser(reportId, senderId, durationMs) {
    showConfirm('Mute this user from chatting for the selected duration?', async () => {
        try {
            await DataService.banChildFromChat(senderId, parseInt(durationMs));
            await DataService.updateThreatLog(reportId, 'resolved', 'banned user');
            loadChatReports();
            loadOverviewStats();
            alert('User muted successfully.');
        } catch (e) {
            alert('Error: ' + e.message);
        }
    });
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
window.loadChatReports = loadChatReports;