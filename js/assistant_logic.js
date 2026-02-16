// Logic for staff/assistant_panel.html

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initAssistantPanel();

    // Tab Switching
    window.showTab = function (tabName) {
        document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
        document.querySelectorAll('nav a').forEach(a => {
            a.classList.remove('bg-purple-50', 'text-cubby-purple', 'border-cubby-purple');
            a.classList.add('text-gray-500', 'border-transparent');
        });

        const targetDiv = document.getElementById(`tab-${tabName}`);
        const targetNav = document.getElementById(`nav-${tabName}`);

        if (targetDiv) targetDiv.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('bg-purple-50', 'text-cubby-purple', 'border-cubby-purple');
            targetNav.classList.remove('text-gray-500', 'border-transparent');
        }

        if (tabName === 'overview') {
            document.getElementById('tab-overview').classList.remove('hidden');
        }
        if (tabName === 'verification') loadPendingParents();
        if (tabName === 'content') loadPendingVideos();
    };

    // Initial Load - Default to Overview now
    showTab('overview');
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
    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        titleEl.innerHTML = `Welcome back, <span class="text-cubby-purple">${currentUser.firstName}</span>`;
    }

    // Load Data
    loadPendingParents();
    // loadChatReports(); // Not implemented yet
    // loadPendingVideos(); // Needs async fix too if moved out of window.showTab, but showTab calls it.
    // However, showTab is sync. loadPendingVideos calls DataService.getVideos which is async.
    // We should fix loadPendingVideos to handle async awaiting inside.

    // Initial Load - Default to Overview now
    // showTab('overview') is called in DOMContentLoaded.
    // We should probably wait for auth before showing tab data? 
    // But 'overview' is static currently.
}

function handleLogout() {
    DataService.logout();
    window.location.href = '../staff_access.html';
}
window.handleLogout = handleLogout;

// --- PARENT VERIFICATION ---

function loadPendingParents() {
    const container = document.getElementById('tab-verification');
    if (!container) return;

    const allUsers = DataService.getAllUsers();
    const pendingParents = allUsers.filter(u => u.role === 'parent' && u.status === 'pending');

    container.innerHTML = ''; // Clear mocked data

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
        return;
    }

    pendingParents.forEach(parent => {
        const html = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dashboard-card" id="user-${parent.id}">
                <div class="bg-gray-50 px-6 py-3 border-b border-gray-100 flex justify-between items-center">
                    <span class="font-bold text-gray-700 text-sm">${parent.firstName} ${parent.lastName}</span>
                    <span class="text-xs text-gray-400"><i class="fa-regular fa-envelope"></i> ${parent.email}</span>
                </div>
                <div class="p-6">
                    <div class="flex flex-col md:flex-row gap-8 items-center justify-center">
                        <div class="text-center w-1/2">
                            <p class="text-xs font-bold text-gray-400 uppercase mb-2">Details provided</p>
                            <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <p><strong>Email:</strong> ${parent.email}</p>
                                <p><strong>Name:</strong> ${parent.firstName} ${parent.middleName || ''} ${parent.lastName}</p>
                                <p><strong>Joined:</strong> ${new Date(parent.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                    <div class="mt-8 flex gap-4">
                        <button onclick="updateParentStatus('${parent.email}', 'rejected')" class="flex-1 py-3 border-2 border-red-100 text-red-500 font-bold rounded-xl hover:bg-red-50">Reject</button>
                        <button onclick="updateParentStatus('${parent.email}', 'active')" class="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600">Approve Parent</button>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    updateBadge('verification', pendingParents.length);
}

function updateParentStatus(email, status) {
    if (confirm(`Set status to ${status}?`)) {
        DataService.updateUserStatus(email, status);
        loadPendingParents();
    }
}

// --- VIDEO REVIEW ---

function loadPendingVideos() {
    const container = document.getElementById('tab-content');
    if (!container) return;

    const pendingVideos = DataService.getVideos('pending'); // Implement filter in DS if needed or use getAll and filter

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
        return;
    }

    pendingVideos.forEach(video => {
        // Extract ID if URL is full
        let vidId = video.url;
        if (video.url.includes('v=')) vidId = video.url.split('v=')[1].split('&')[0];
        else if (video.url.includes('youtu.be/')) vidId = video.url.split('youtu.be/')[1];

        const html = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden dashboard-card">
                <div class="flex flex-col md:flex-row">
                    <!-- Thumbnail/Embed -->
                    <div class="w-full md:w-1/3 bg-black relative group h-48 md:h-auto">
                        <iframe class="w-full h-full" src="https://www.youtube.com/embed/${vidId}" frameborder="0" allowfullscreen></iframe>
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
                            <button onclick="updateVideoStatus('${video.id}', 'rejected')" class="px-4 py-2 border border-red-200 text-red-500 font-bold rounded-lg hover:bg-red-50 text-sm">
                                <i class="fa-solid fa-ban mr-1"></i> Reject
                            </button>
                            <button onclick="updateVideoStatus('${video.id}', 'approved')" class="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 text-sm shadow-md">
                                <i class="fa-solid fa-check mr-1"></i> Approve & Publish
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });

    updateBadge('content', pendingVideos.length);
}

function updateVideoStatus(vidId, status) {
    if (confirm(`Check this video as ${status}?`)) {
        DataService.updateVideoStatus(vidId, status);
        loadPendingVideos();
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