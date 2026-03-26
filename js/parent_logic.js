// Logic for parent/dashboard.html AND parent/register_child.html

let currentScreenTimeMode = 'daily';

// ── Virtual Scroll Core Logic ──────────────────────────────────────────────────
let _vsState = { items: [], height: 85, pool: [], initialized: false };

function renderVirtualScrollVisible() {
    const container = document.getElementById('notifications-container');
    if (!container) return;
    const scrollTop = container.scrollTop;
    const startIndex = Math.max(0, Math.floor(scrollTop / _vsState.height));

    for (let i = 0; i < _vsState.pool.length; i++) {
        const itemIndex = startIndex + i;
        const node = _vsState.pool[i];

        if (itemIndex < _vsState.items.length) {
            node.style.top = `${itemIndex * _vsState.height}px`;
            node.style.display = 'block';
            if (node.dataset.index !== String(itemIndex)) {
                node.innerHTML = _vsState.items[itemIndex];
                node.dataset.index = itemIndex;
            }
        } else {
            node.style.display = 'none';
            node.dataset.index = '-1';
        }
    }
}

function setupVirtualScroll(containerId, listId, itemsHtmlArray) {
    const container = document.getElementById(containerId);
    const list = document.getElementById(listId);
    if (!container || !list) return;

    _vsState.items = itemsHtmlArray;
    list.style.position = 'relative';
    const totalH = itemsHtmlArray.length * _vsState.height;
    list.style.height = `${Math.max(10, totalH)}px`;

    if (!_vsState.initialized) {
        list.innerHTML = '';
        const winHeight = container.clientHeight || 400;
        const itemsPerScreen = Math.ceil(winHeight / _vsState.height) + 4;

        _vsState.pool = [];
        for (let i = 0; i < itemsPerScreen; i++) {
            const div = document.createElement('div');
            div.style.position = 'absolute';
            div.style.left = '0';
            div.style.right = '0';
            div.style.height = `${_vsState.height}px`;
            div.style.boxSizing = 'border-box';
            div.style.paddingBottom = '10px';
            list.appendChild(div);
            _vsState.pool.push(div);
        }

        container.addEventListener('scroll', renderVirtualScrollVisible);
        container.style.overflowY = 'auto';
        container.style.position = 'absolute';
        _vsState.initialized = true;
    }

    renderVirtualScrollVisible();
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Notification push-based updates ──────────────────────────────────────────
let _unsubNotifs = null;

function startNotifPolling() {
    checkLoginRequests(); // internal logic: fetch once immediately
    
    // Subscribe to access logs (login requests) and generic notifications
    const { DB_ID, COLLECTIONS } = AppwriteService;
    
    _unsubNotifs = DataService.subscribe([
        `databases.${DB_ID}.collections.${COLLECTIONS.ACCESS_LOGS}.documents`,
        `databases.${DB_ID}.collections.${COLLECTIONS.NOTIFICATIONS}.documents`
    ], () => {
        // Any change in these collections → refresh UI
        checkLoginRequests();
    });
}

function stopNotifPolling() {
    if (_unsubNotifs) {
        _unsubNotifs();
        _unsubNotifs = null;
    }
}

async function checkLoginRequests() {
    const user = await DataService.getCurrentUser();
    if (!user || !user.email) return;

    const [pending, handled, buddyNotifs] = await Promise.all([
        DataService.getPendingLoginRequests(user.email),
        DataService.getHandledLoginRequests(user.email),
        DataService.getParentNotifications(user.$id, false)
    ]);

    // ── 1. Bell panel (tile) — login history + buddy notifications ────────────
    const notifList = document.getElementById('notif-list');
    if (notifList) {
        const loginItems = handled.map(req => {
            const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const isApproved = req.status === 'approved';
            return {
                ts: req.requestedAt,
                html: `
                    <div class="flex items-start gap-4 h-[75px] overflow-hidden bg-gray-50/50 rounded-[20px] p-3 border border-gray-100/60 shadow-sm transition-all hover:bg-white group cursor-default">
                        <div class="w-9 h-9 ${isApproved ? 'bg-[#EEF9EC] text-[#5EC74D]' : 'bg-[#FFF1F2] text-[#FF456A]'} rounded-[14px] shadow-sm flex items-center justify-center shrink-0 border border-white mt-0.5">
                            <i class="fa-solid fa-child-reaching text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-bold text-[#1C1D21] text-[13px] truncate leading-tight">${req.childUsername} — Login ${isApproved ? 'Approved' : 'Denied'}</p>
                            <p class="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">${time}</p>
                        </div>
                    </div>`
            };
        });

        const buddyItems = buddyNotifs.map(notif => {
            const time = new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            let icon;
            if (notif.type === 'buddy_request') icon = 'fa-user-plus text-cubby-pink';
            else if (notif.type === 'buddy_added') icon = 'fa-user-check text-cubby-blue';
            else icon = 'fa-handshake text-cubby-green';
            return {
                ts: notif.createdAt,
                html: `
                    <div class="flex items-start gap-4 h-[75px] overflow-hidden bg-gray-50/50 rounded-[20px] p-3 border border-gray-100/60 shadow-sm transition-all hover:bg-white cursor-pointer group"
                         onclick="markNotifRead('${notif.$id}', this)">
                        <div class="w-9 h-9 bg-white group-hover:shadow-md rounded-[14px] flex items-center justify-center shrink-0 border border-gray-100 shadow-sm transition-all mt-0.5">
                            <i class="fa-solid ${icon} text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0 pr-2 relative">
                            <p class="font-bold text-[#1C1D21] text-[12px] leading-snug">${notif.message}</p>
                            <p class="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-wider">${time}</p>
                            ${!notif.isRead ? `<div class="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 bg-[#8A51FC] rounded-full ring-2 ring-white"></div>` : ''}
                        </div>
                    </div>`
            };
        });

        const allItems = [...loginItems, ...buddyItems]
            .sort((a, b) => new Date(b.ts) - new Date(a.ts));

        if (allItems.length > 0) {
            const htmlArray = allItems.map(i => i.html);
            setupVirtualScroll('notifications-container', 'notif-list', htmlArray);
        } else {
            notifList.innerHTML = '<div class="flex items-center justify-center py-10 text-gray-400 font-bold text-sm">No recent notifications.</div>';
            notifList.style.height = 'auto';
        }
    }

    // ── 2. Global Unread pending login requests (Slide-down header) ───────────
    const unreadList = document.getElementById('global-unread-list');
    const slideHeader = document.getElementById('global-login-request-header');

    if (!unreadList || !slideHeader) return;

    if (pending.length === 0) {
        slideHeader.classList.add('-translate-y-full');
        unreadList.innerHTML = '';
        return;
    }

    slideHeader.classList.remove('-translate-y-full');

    unreadList.innerHTML = pending.map(req => {
        const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between bg-[#FFF8DF] border border-[#FBEAC5] rounded-[20px] p-3 md:p-4 shadow-sm gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-[16px] bg-white border border-[#FBEAC5] flex items-center justify-center shrink-0 shadow-sm text-amber-500">
                        <i class="fa-solid fa-bell-ring animate-pulse text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="font-extrabold text-[#1C1D21] text-[15px] leading-tight tracking-tight">${req.childUsername} is requesting access</p>
                        <p class="text-[11px] font-bold text-amber-600/70 uppercase tracking-widest mt-1">Requested at ${time}</p>
                    </div>
                </div>
                <div class="flex gap-2 w-full md:w-auto shrink-0">
                    <button onclick="inlineApprove('${req.$id}', this)" class="flex-1 md:flex-none px-6 bg-amber-500 hover:bg-amber-600 text-white text-[13px] font-extrabold py-3 rounded-[14px] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1">Approve</button>
                    <button onclick="inlineDeny('${req.$id}')" class="flex-1 md:flex-none px-6 bg-white hover:bg-gray-50 text-gray-700 border border-[#FBEAC5] text-[13px] font-extrabold py-3 rounded-[14px] shadow-sm transition-all focus:outline-none">Deny</button>
                </div>
            </div>
        `;
    }).join('');
}
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // 1. Dashboard Logic — detect by a stable unique element
    const dashboardMain = document.getElementById('sidebar');
    if (dashboardMain) {
        console.log("Parent Dashboard Loaded");
        loadDashboardData();
    }

    // 2. Register Child Logic
    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) {
        console.log("Add Child Form Loaded");
        // No special init needed yet
    }

    window.stopNotifPollingGlobal = stopNotifPolling;

    // --- Start notification polling when on the dashboard ---
    if (dashboardMain) {
        startNotifPolling();
        _checkLoginRequestsRef = checkLoginRequests; // expose for inline buttons

        // ── Smart Polling (Visibility-Based) ────────────────────────────────
        // Polls every 60s ONLY when the tab is active.
        // Avoids using Appwrite Realtime (websockets) to stay within Free Tier limits.
        let _dashboardPollInterval = null;

        function _startDashboardPolling() {
            if (_dashboardPollInterval) return; // already running
            _dashboardPollInterval = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    console.log('[SmartPoll] Tab active — refreshing dashboard data...');
                    loadDashboardData();
                }
            }, 60000); // every 60 seconds
        }

        function _stopDashboardPolling() {
            if (_dashboardPollInterval) {
                clearInterval(_dashboardPollInterval);
                _dashboardPollInterval = null;
            }
        }

        // Start polling and re-fetch immediately when the tab becomes visible again
        _startDashboardPolling();
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('[SmartPoll] Tab became visible — refreshing dashboard data...');
                loadDashboardData();
            }
        });
        window.addEventListener('beforeunload', _stopDashboardPolling);
    }

    // (Virtual scroll, polling vars, and checkLoginRequests are now at module scope above)

    // ── All onclick handlers are top-level function declarations below the
    // DOMContentLoaded block — see bottom of this file. ──────────────────────

    // 3. Tab Switching — top-level function below
    // 4. Sidebar Toggle — top-level function below

});

// --- Global Parent Logout ---
window.handleParentLogout = async function () {
    try {
        if (typeof window.stopNotifPollingGlobal === 'function') {
            window.stopNotifPollingGlobal();
        }
    } catch (e) {
        console.warn('stop polling error:', e);
    }

    try {
        await DataService.logout();
    } catch (e) {
        console.warn("Logout error:", e);
    }

    window.location.href = '../login.html';
};

// ── Sidebar Toggle ────────────────────────────────────────────────────────────
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('-translate-x-full');
    }
}

// ── Notification Panel & Approval Modal ──────────────────────────────────────
// All declared at top level so onclick attrs work before DOMContentLoaded fires.

let _currentRequestId = null; // shared by modal functions

function openApprovalModal(requestId, childUsername, time, deviceInfo) {
    _currentRequestId = requestId;
    const u = document.getElementById('modal-child-username');
    const t = document.getElementById('modal-requested-at');
    const d = document.getElementById('modal-device');
    if (u) u.textContent = childUsername;
    if (t) t.textContent = time;
    if (d) d.textContent = deviceInfo || 'Unknown Device';
    const modal = document.getElementById('approval-modal');
    if (modal) modal.classList.remove('hidden');
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.add('hidden');
}

function closeApprovalModal() {
    const modal = document.getElementById('approval-modal');
    if (modal) modal.classList.add('hidden');
    _currentRequestId = null;
}

async function handleApproveRequest() {
    if (!_currentRequestId) return;
    const approveBtn = document.getElementById('approve-btn');
    const denyBtn = document.getElementById('deny-btn');
    if (approveBtn) { approveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Approving...'; approveBtn.disabled = true; }
    if (denyBtn) { denyBtn.disabled = true; }
    try {
        const child = await DataService.approveLoginRequest(_currentRequestId);
        closeApprovalModal();
        if (_checkLoginRequestsRef) await _checkLoginRequestsRef();
        alert('✅ ' + child.name + "'s login has been approved!");
    } catch (err) {
        alert('Error approving: ' + err.message);
        if (approveBtn) { approveBtn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Approve'; approveBtn.disabled = false; }
        if (denyBtn) { denyBtn.disabled = false; }
    }
}

async function handleDenyRequest() {
    if (!_currentRequestId) return;
    try {
        await DataService.denyLoginRequest(_currentRequestId);
        closeApprovalModal();
        if (_checkLoginRequestsRef) await _checkLoginRequestsRef();
        alert('Login request denied.');
    } catch (err) {
        alert('Error denying: ' + err.message);
    }
}

async function markNotifRead(notifId, el) {
    await DataService.markNotificationRead(notifId);
    const dot = el && el.querySelector('.bg-cubby-blue.rounded-full');
    if (dot) dot.remove();
    if (_checkLoginRequestsRef) await _checkLoginRequestsRef();
}

// ── Inline approve/deny handlers ─────────────────────────────────────────────
// Defined at top level so onclick attrs in dynamic HTML always find them.

let _checkLoginRequestsRef = null; // set by DOMContentLoaded after polling starts
let _selectedChildId = null; // Tracks newly selected child in sidebar

async function inlineApprove(requestId, btn) {
    if (btn) { btn.textContent = '...'; btn.disabled = true; }
    try {
        const child = await DataService.approveLoginRequest(requestId);
        if (_checkLoginRequestsRef) await _checkLoginRequestsRef();
        alert('✅ ' + child.name + "'s login has been approved!");
    } catch (err) {
        alert('Error approving: ' + err.message);
        if (btn) { btn.textContent = 'Approve'; btn.disabled = false; }
    }
}


async function inlineDeny(requestId) {
    try {
        await DataService.denyLoginRequest(requestId);
        if (_checkLoginRequestsRef) await _checkLoginRequestsRef();
    } catch (err) {
        alert('Error denying: ' + err.message);
    }
}


/**
 * Loads and calculates all dashboard statistics and lists
 */
async function loadDashboardData() {
    const user = await DataService.getCurrentUser();
    if (!user) {
        window.location.href = '../login.html';
        return; // Redirect to login immediately
    }

    // 1. Update Parent Info
    const userNameEl = document.getElementById('userName');
    if (userNameEl) {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        userNameEl.textContent = fullName;
    }

    const parentNameEl = document.getElementById('sidebar-parent-name');
    if (parentNameEl) parentNameEl.textContent = user.name || user.firstName;

    const parentAvatarEl = document.getElementById('sidebar-parent-avatar');
    const headerAvatarEl = document.getElementById('header-avatar');
    let avatarSrc = `https://ui-avatars.com/api/?name=${user.firstName}&background=random`;

    try {
        const prefs = await AppwriteService.account.getPrefs();
        if (prefs && prefs.profilePictureUrl) {
            avatarSrc = prefs.profilePictureUrl;
        }
    } catch (e) { /* ignore prefs fetch error */ }

    if (parentAvatarEl) parentAvatarEl.src = avatarSrc;
    if (headerAvatarEl) headerAvatarEl.src = avatarSrc;

    // --- 1. Render Kids ---
    await renderKidsAndStats(user);

    // --- Initial Screen Time Mode ---
    changeTimeMode('daily'); // Default
}

async function renderKidsAndStats(user) {
    const kidsListEl = document.getElementById('sidebar-kids-list');

    // Query children from the database by parentId
    const children = await DataService.getChildrenByParent(user.$id);
    window._currentChildren = children;

    // Retrieve or generate kidIds for any existing children that don't have one
    if (children && children.length > 0) {
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (!child.kidId || child.kidId === '') {
                child.kidId = await DataService.ensureKidId(child.$id);
            }
        }
    }

    if (!children || children.length === 0) {
        if (kidsListEl) kidsListEl.innerHTML = '<div class="text-center py-4 text-xs font-semibold text-gray-500">No children added yet.</div>';
        return;
    }

    // Set default selected child if none selected yet
    if (!_selectedChildId && children.length > 0) {
        _selectedChildId = children[0].$id;
    }

    if (kidsListEl) kidsListEl.innerHTML = '';

    children.forEach(child => {
        const isActive = child.$id === _selectedChildId;
        const activeBg = isActive ? 'bg-purple-50' : 'hover:bg-purple-50/50';
        const activeText = isActive ? 'text-cubby-purple font-bold' : 'text-gray-600 font-semibold group-hover:text-cubby-purple';
        const activeIndicator = isActive ? `<div class="w-1.5 h-1.5 rounded-full bg-green-400 absolute left-2 top-1/2 transform -translate-y-1/2 shadow-sm"></div>` : '';
        const borderClass = isActive ? 'border-purple-200' : 'border-transparent hover:border-purple-100';

        let avatarHtml = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(child.username || child.name)}"
                    class="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm ml-2 object-cover group-hover:border-purple-200 transition-colors">`;

        if (child.avatarImage) {
            const bgStr = child.avatarBgColor ? `style="background-color: ${child.avatarBgColor}"` : 'bg-white';
            avatarHtml = `<img src="${child.avatarImage}" ${bgStr} class="w-8 h-8 rounded-full border border-gray-200 shadow-sm ml-2 object-contain p-0.5 group-hover:border-purple-200 transition-colors">`;
        }

        const html = `
            <div onclick="selectChild('${child.$id}')" class="relative flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group ${activeBg} border ${borderClass}">
                ${activeIndicator}
                ${avatarHtml}
                <div class="flex-1 min-w-0">
                    <h4 class="text-[13px] truncate transition-colors ${activeText}">${child.name}</h4>
                    <p class="text-[10px] text-gray-400 truncate">${child.isOnline ? 'Active Now' : 'Offline'}</p>
                </div>
            </div>
        `;
        if (kidsListEl) kidsListEl.insertAdjacentHTML('beforeend', html);
    });

    // Render child-specific modules
    renderActivityLogs();
    renderSafetyAlerts();
    renderRewardsAndPaths();
    changeTimeMode(currentScreenTimeMode);
}

window.selectChild = function (childId) {
    if (_selectedChildId === childId) return; // already selected
    _selectedChildId = childId;
    const user = { $id: window._currentChildren[0]?.parentId }; // Stub to prevent crash and re-render sidebar safely
    renderKidsAndStats(user);
};

function renderActivityLogs() {
    const listEl = document.getElementById('activity-list');
    const children = window._currentChildren || [];
    const activeChild = children.find(c => c.$id === _selectedChildId);

    if (!activeChild || !activeChild.activityLogs || listEl === null) {
        if (listEl) listEl.innerHTML = '<div class="absolute inset-0 flex items-center justify-center h-full text-sm text-gray-400 font-medium pb-10">No recent activity.</div>';
        return;
    }

    let logs;
    if (typeof activeChild.activityLogs === 'string') {
        try { logs = JSON.parse(activeChild.activityLogs); } catch (e) { logs = []; }
    } else if (Array.isArray(activeChild.activityLogs)) {
        logs = activeChild.activityLogs;
    } else {
        logs = [];
    }

    if (logs.length === 0) {
        listEl.innerHTML = '<div class="absolute inset-0 flex items-center justify-center h-full text-sm text-gray-400 font-medium pb-10">No recent activity.</div>';
        return;
    }

    // Sort by descending timestamp
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    logs = logs.slice(0, 15); // show top 15

    listEl.innerHTML = '<div class="absolute left-6 top-2 bottom-4 w-px bg-gray-100"></div>'; // Reset with vertical line

    logs.forEach(log => {
        const timeStr = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const html = `
            <div class="flex gap-4 relative items-start">
                <div class="w-10 h-10 rounded-[14px] bg-[#EEF9EC] border-[3px] border-white shadow-sm z-10 flex-shrink-0 flex items-center justify-center text-[#5EC74D] mt-0.5 ml-1">
                    <i class="fa-solid fa-play text-xs"></i>
                </div>
                <div class="bg-gray-50 rounded-2xl p-4 flex-1 border border-gray-100/50 shadow-sm transition-all hover:bg-white min-w-0">
                    <p class="text-sm text-[#1C1D21] font-bold truncate">${log.action}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span class="text-xs font-bold text-gray-400"><i class="fa-regular fa-clock mr-1 text-[10px]"></i>${timeStr}</span>
                        ${log.link ? `<a href="${log.link}" class="text-[11px] text-[#8A51FC] font-bold hover:underline bg-[#F8F5FF] px-2 py-0.5 rounded-md border border-[#F8F5FF]">View Content</a>` : ''}
                    </div>
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

async function renderSafetyAlerts() {
    const listEl = document.getElementById('safety-list');
    if (!listEl || !_selectedChildId) return;

    const activeChild = window._currentChildren?.find(c => c.$id === _selectedChildId);

    // Fetch both threat logs AND parent safety alert notifications
    const [allThreats, safetyNotifs] = await Promise.all([
        DataService.getThreatLogs().catch(() => []),
        activeChild?.parentId
            ? DataService.getParentNotifications(activeChild.parentId, false).catch(() => [])
            : Promise.resolve([])
    ]);

    // Filter threat logs for this child
    const childThreats = allThreats.filter(t =>
        t.childId === _selectedChildId ||
        t.fromChildId === _selectedChildId ||
        t.reporterChildId === _selectedChildId ||
        t.reportedChildId === _selectedChildId ||
        (activeChild && t.fromUsername === activeChild.username)
    );

    // Filter safety_alert notifications for THIS child
    const childSafetyNotifs = safetyNotifs.filter(n =>
        n.type === 'safety_alert' && n.childId === _selectedChildId
    );

    if (childThreats.length === 0 && childSafetyNotifs.length === 0) {
        listEl.innerHTML = `
            <div class="h-full flex flex-col items-center justify-center text-center py-10 opacity-70">
                <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                    <i class="fa-solid fa-shield-check text-3xl"></i>
                </div>
                <p class="text-[15px] font-bold text-gray-500">No safety alerts detected.</p>
                <p class="text-xs text-gray-400 mt-1 font-medium">This profile is clean.</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';

    // ── Purple safety_alert notifications ─────────────────────────────────────
    childSafetyNotifs.slice(0, 5).forEach(notif => {
        const timeStr = timeAgo(notif.createdAt);
        // Split the message to find the note (last line after \n\n)
        const parts = (notif.message || '').split('\n');
        const lastLine = parts[parts.length - 1] || '';
        const mainMsg = parts.slice(0, parts.length - 1).join('\n').trim();

        const html = `
            <div class="bg-white rounded-2xl p-4 border border-purple-100 shadow-sm relative overflow-hidden group hover:border-cubby-purple/40 transition-colors">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-cubby-purple rounded-l-2xl"></div>
                <div class="flex items-start justify-between mb-1.5 ml-2">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-shield-cat text-cubby-purple text-sm"></i>
                        <h4 class="text-[13px] font-bold text-cubby-purple">Safety Alert</h4>
                    </div>
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded ml-2 whitespace-nowrap">${timeStr}</span>
                </div>
                <p class="text-[11px] text-gray-700 font-medium italic mb-2 ml-2 leading-relaxed bg-purple-50 p-2 rounded-lg border border-purple-100 whitespace-pre-wrap break-words">${escHtml(mainMsg)}</p>
                ${lastLine ? `<p class="text-[11px] font-bold text-cubby-purple ml-2 mt-1">${escHtml(lastLine)}</p>` : ''}
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });

    // ── Legacy threat log alerts ───────────────────────────────────────────────
    childThreats.slice(0, 10).forEach(threat => {
        const timeStr = timeAgo(threat.$createdAt);
        const excerpt = threat.messageContent || threat.messagePreview || 'Inappropriate content detected.';
        const resolved = threat.status === 'resolved';

        const html = `
            <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#FF456A]/50 transition-colors">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 ${resolved ? 'bg-green-400' : 'bg-red-400'}"></div>
                <div class="flex items-start justify-between mb-1.5 ml-2">
                    <h4 class="text-[13px] font-bold text-[#1C1D21]">Chat Moderation Alert</h4>
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded ml-2 whitespace-nowrap">${timeStr}</span>
                </div>
                <p class="text-[11px] text-gray-400 font-medium italic mb-3 line-clamp-2 ml-2 leading-relaxed bg-gray-50 p-2 rounded-lg">"${escHtml(excerpt)}"</p>
                <div class="flex justify-between items-center ml-2 border-t border-gray-50 pt-2">
                    <span class="text-[9px] font-bold px-2 py-1 rounded-md ${resolved ? 'bg-green-50 text-green-600' : 'bg-[#FFF1F2] text-[#FF456A]'} uppercase tracking-wider">
                        ${threat.status || 'pending'}
                    </span>
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

async function renderRewardsAndPaths() {
    const container = document.getElementById('rewards-progress-container');
    if (!container || !_selectedChildId) return;

    container.innerHTML = '<div class="flex items-center justify-center py-12"><i class="fa-solid fa-spinner fa-spin text-2xl text-orange-400"></i></div>';

    try {
        const [rewards, pathStatuses, allPaths] = await Promise.all([
            DataService.getRewardsByChild(_selectedChildId).catch(() => []),
            DataService.getPathStatusesByChild(_selectedChildId).catch(() => []),
            DataService.getPaths().catch(() => [])
        ]);

        if (rewards.length === 0 && pathStatuses.length === 0) {
            container.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-center py-10 opacity-70">
                    <div class="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                        <i class="fa-solid fa-medal text-3xl"></i>
                    </div>
                    <p class="text-[15px] font-bold text-gray-500">No rewards yet.</p>
                    <p class="text-xs text-gray-400 mt-1 font-medium">Progress will appear as they watch videos.</p>
                </div>`;
            return;
        }

        let html = '<div class="space-y-6">';

        // ── 1. Active Learning Paths Status ─────────────────────────────────────
        if (pathStatuses.length > 0) {
            html += `<div>
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-route text-cubby-purple"></i> Path Progress
                </h4>
                <div class="grid grid-cols-1 gap-3">`;
            
            pathStatuses.forEach(status => {
                const path = allPaths.find(p => p.$id === status.pathId);
                if (!path) return;

                const completedCount = (status.completedVideoIds || []).length;
                const totalCount = (path.videoIds || []).length;
                const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                const isCompleted = status.currentStatus === 'completed' || percent >= 100;

                html += `
                    <div class="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 shadow-sm">
                        <div class="flex items-center justify-between mb-2">
                            <h5 class="text-[13px] font-bold text-gray-800 truncate pr-2">${escHtml(path.title)}</h5>
                            <span class="text-[10px] font-black ${isCompleted ? 'text-green-500' : 'text-cubby-purple'} bg-white px-2 py-0.5 rounded shadow-sm border border-gray-50">
                                ${isCompleted ? 'COMPLETE' : percent + '%'}
                            </span>
                        </div>
                        <div class="w-full bg-white h-2 rounded-full border border-gray-100 overflow-hidden">
                            <div class="h-full ${isCompleted ? 'bg-green-400' : 'bg-cubby-purple'} transition-all duration-1000" style="width: ${percent}%"></div>
                        </div>
                        <div class="flex justify-between mt-2 text-[10px] font-bold text-gray-400">
                            <span>${completedCount} / ${totalCount} Videos</span>
                            ${isCompleted ? '<span class="text-green-500"><i class="fa-solid fa-circle-check"></i> Bonus Earned</span>' : ''}
                        </div>
                    </div>`;
            });
            html += `</div></div>`;
        }

        // ── 2. Recent Rewards Timeline ──────────────────────────────────────────
        if (rewards.length > 0) {
            html += `<div>
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <i class="fa-solid fa-bolt text-orange-400"></i> Recent Achievements
                </h4>
                <div class="space-y-2">`;
            
            rewards.slice(0, 10).forEach(reward => {
                const timeStr = timeAgo(reward.earnedAt);
                const isPathBonus = reward.rewardType === 'path_bonus';
                
                html += `
                    <div class="flex items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm group hover:border-orange-200 transition-colors">
                        <div class="w-8 h-8 rounded-xl ${isPathBonus ? 'bg-purple-50 text-cubby-purple' : 'bg-orange-50 text-orange-500'} flex items-center justify-center shrink-0">
                            <i class="fa-solid ${isPathBonus ? 'fa-trophy' : 'fa-star'} text-[10px]"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[11px] font-bold text-gray-800 truncate">${isPathBonus ? 'Learning Path Complete!' : 'Video Watch Reward'}</p>
                            <p class="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">${timeStr}</p>
                        </div>
                        <div class="text-[11px] font-black text-orange-500">+${reward.points}</div>
                    </div>`;
            });
            html += `</div></div>`;
        }

        html += '</div>';
        container.innerHTML = html;

    } catch (e) {
        console.error('renderRewardsAndPaths error:', e);
        container.innerHTML = '<div class="text-center py-10 text-red-400 font-bold">Error loading progress data.</div>';
    }
}

function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}


let screenTimeChartInstance = null;

function changeTimeMode(mode) {
    currentScreenTimeMode = mode;

    // Update the dropdown display text
    const displayEl = document.getElementById('timeModeDisplay');
    const selectEl = document.getElementById('timeModeSelect');
    if (displayEl && selectEl) {
        displayEl.innerText = selectEl.options[selectEl.selectedIndex].text;
    }

    let totalMinutes = 0;
    const children = window._currentChildren || [];
    const activeChild = children.find(c => c.$id === _selectedChildId);

    // Chart grouping structures
    let labels = [];
    let gameMinsData = [];
    let entMinsData = [];
    let comMinsData = [];
    let overallData = []; // for line graph
    const now = new Date();

    if (mode === 'daily') {
        // Show last 7 days individually (our logs are date-level, not hour-level)
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        labels = [];
        gameMinsData = [];
        entMinsData = [];
        comMinsData = [];

        for (let i = 6; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            labels.push(i === 0 ? 'Today' : dayNames[d.getDay()]);
            gameMinsData.push(0);
            entMinsData.push(0);
            comMinsData.push(0);
        }
    } else if (mode === 'weekly') {
        labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        gameMinsData = [0, 0, 0, 0, 0, 0, 0];
        entMinsData = [0, 0, 0, 0, 0, 0, 0];
        comMinsData = [0, 0, 0, 0, 0, 0, 0];
    } else if (mode === 'monthly') {
        labels = ["Week 1", "Week 2", "Week 3", "Week 4"];
        gameMinsData = [0, 0, 0, 0];
        entMinsData = [0, 0, 0, 0];
        comMinsData = [0, 0, 0, 0];
    } else if (mode === 'overall') {
        labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        overallData = new Array(12).fill(0);
    }

    if (activeChild && activeChild.screenTimeLogs) {
        let logs;
        if (typeof activeChild.screenTimeLogs === 'string') {
            try { logs = JSON.parse(activeChild.screenTimeLogs); } catch (e) { logs = []; }
        } else if (Array.isArray(activeChild.screenTimeLogs)) {
            logs = activeChild.screenTimeLogs;
        } else {
            logs = [];
        }

        // Today's UTC date string e.g. "2026-03-03"
        const todayUTC = now.toISOString().split('T')[0];

        logs.forEach(log => {
            if (!log.date) return;
            // Parse log.date as a local date (avoid UTC midnight shift)
            const [y, mo, d] = log.date.split('-').map(Number);
            const logDate = new Date(y, mo - 1, d); // local midnight
            let include = false;
            let bucketIndex = 0;

            if (mode === 'daily') {
                // Which of the last-7-day slots does this belong to?
                for (let i = 0; i < 7; i++) {
                    const slotDate = new Date(now);
                    slotDate.setDate(now.getDate() - (6 - i));
                    if (logDate.toDateString() === slotDate.toDateString()) {
                        include = true;
                        bucketIndex = i;
                        break;
                    }
                }
            } else if (mode === 'weekly') {
                const diffDays = Math.round((now - logDate) / (1000 * 60 * 60 * 24));
                if (diffDays <= 7) {
                    include = true;
                    bucketIndex = logDate.getDay() === 0 ? 6 : logDate.getDay() - 1; // Mon=0, Sun=6
                }
            } else if (mode === 'monthly') {
                if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) {
                    include = true;
                    bucketIndex = Math.min(3, Math.floor((logDate.getDate() - 1) / 7));
                }
            } else if (mode === 'overall') {
                if (logDate.getFullYear() === now.getFullYear()) {
                    include = true;
                    bucketIndex = logDate.getMonth();
                }
            }

            if (include) {
                totalMinutes += log.minutes;
                if (mode === 'overall') {
                    overallData[bucketIndex] += log.minutes;
                } else {
                    // Split minutes across the 3 categories.
                    // If a 'category' is stored on the log entry, use it directly.
                    // Otherwise fall back to an even 3-way split so no single
                    // category is shown as 100% of the time.
                    const cat = (log.category || '').toLowerCase();
                    if (cat === 'games' || cat === 'game') {
                        gameMinsData[bucketIndex] += log.minutes;
                    } else if (cat === 'entertainment' || cat === 'ent') {
                        entMinsData[bucketIndex] += log.minutes;
                    } else if (cat === 'communication' || cat === 'com' || cat === 'chat') {
                        comMinsData[bucketIndex] += log.minutes;
                    } else {
                        // No category stored — distribute evenly over 3 segments
                        const third = Math.floor(log.minutes / 3);
                        const remainder = log.minutes - third * 3;
                        gameMinsData[bucketIndex] += third;
                        entMinsData[bucketIndex] += third;
                        comMinsData[bucketIndex] += third + remainder; // remainder goes to communication
                    }
                }
            }
        });
    }

    let timeText = "";
    if (totalMinutes === 0) {
        timeText = "0 min";
    } else {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        timeText = h > 0 ? `${h} hrs ${m} min` : `${m} min`;
    }

    const statEl = document.getElementById('stat-screen-time');
    if (statEl) statEl.innerText = timeText;

    // Define standard Chart.js datasets
    let datasets = [];
    let chartType = 'bar';

    if (mode === 'overall') {
        chartType = 'line';
        datasets = [
            {
                label: 'Total Screen Time (mins)',
                data: overallData,
                borderColor: '#8A51FC',
                backgroundColor: 'rgba(138, 81, 252, 0.1)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#8A51FC',
                pointBorderWidth: 2,
                pointRadius: 4,
            }
        ];
    } else {
        datasets = [
            {
                label: 'Games',
                data: gameMinsData,
                backgroundColor: '#5C45FD',
                borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 4, bottomRight: 4 },
                barThickness: mode === 'daily' ? 30 : 20
            },
            {
                label: 'Entertainment',
                data: entMinsData,
                backgroundColor: '#A2DE4E',
                borderRadius: 0,
                barThickness: mode === 'daily' ? 30 : 20
            },
            {
                label: 'Communication',
                data: comMinsData,
                backgroundColor: '#FF456A',
                borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
                barThickness: mode === 'daily' ? 30 : 20
            }
        ];
    }

    renderChart(labels, datasets, chartType);
}

function renderChart(labels, datasets, type) {
    const canvas = document.getElementById('screenTimeChart');
    if (!canvas) return;

    if (screenTimeChartInstance) {
        screenTimeChartInstance.destroy();
    }

    // Dark mode aware colors
    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? '#374151' : '#F3F4F6';
    const tickColor = isDark ? '#9CA3AF' : '#9CA3AF';

    screenTimeChartInstance = new Chart(canvas, {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    stacked: type === 'bar',
                    grid: { color: gridColor, drawBorder: false },
                    border: { display: false },
                    ticks: {
                        color: tickColor,
                        font: { size: 10, weight: 'bold' }
                    }
                },
                x: {
                    stacked: type === 'bar',
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        color: tickColor,
                        font: { size: 10, weight: 'bold' }
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? 'rgba(55, 65, 81, 0.95)' : 'rgba(28, 29, 33, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#A1A1AA',
                    cornerRadius: 8,
                    padding: 12
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// Helper: Simple Time Ago
function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hours ago`;
    return "Yesterday";
}

// Function to handle "Create Profile" button click
// Function to handle "Create Profile" button click
async function saveChild() {
    const nameInput = document.querySelector('input[placeholder="e.g. Tommy"]');
    const usernameInput = document.querySelector('input[placeholder="e.g. TommyRox123"]');
    const passwordInput = document.getElementById('childPassword');

    const name = nameInput ? nameInput.value.trim() : "";
    const username = usernameInput ? usernameInput.value.trim() : "";
    const password = passwordInput ? passwordInput.value : "";

    // Validation
    if (!name || !username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    const passCheck = SecurityUtils.validatePassword(password);
    if (!passCheck.isValid) {
        alert(passCheck.error); // Show strict password rules
        return;
    }

    // 1. Show loading state
    const btn = document.querySelector('button[onclick="saveChild()"]');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        btn.classList.add('opacity-75');
    }

    try {
        const user = await DataService.getCurrentUser();
        if (!user) throw new Error("Parent not logged in.");

        const childData = {
            name: name,
            username: username,
            password: password,
            avatar: document.querySelector('input[name="avatar"]:checked')?.value || 'Felix',
            allowChat: document.querySelector('input[name="allowChat"]')?.checked || false,
            allowGames: document.querySelector('input[name="allowGames"]')?.checked || true
        };

        await DataService.createChild(user.$id, childData);

        alert("Child Profile Created Successfully!");
        window.location.href = 'dashboard.html';

    } catch (error) {
        console.error("Save Child Error:", error);
        alert("Failed to create child profile: " + error.message);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check ml-2"></i> Create Profile'; // Reset (approx)
            btn.disabled = false;
            btn.classList.remove('opacity-75');
        }
    }
}

// --- Child Edit Modal ---
let _editingChildId = null;

function openEditChildModal(childId) {
    if (!window._currentChildren) return;
    const child = window._currentChildren.find(c => c.$id === childId);
    if (!child) return;

    _editingChildId = childId;
    const modal = document.getElementById('edit-child-modal');
    if (!modal) return;

    // Populate modal fields
    document.getElementById('editChildName').value = child.name || '';
    document.getElementById('editChildUsername').value = child.username || '';
    document.getElementById('editChildPassword').value = child.password || '';

    // Select avatar
    const avatarInput = document.querySelector(`input[name="editAvatar"][value="${child.avatar}"]`);
    if (avatarInput) avatarInput.checked = true;

    // Checkboxes
    document.getElementById('editAllowChat').checked = !!child.allowChat;
    document.getElementById('editAllowGames').checked = !!child.allowGames;

    modal.classList.remove('hidden');
}

function closeEditChildModal() {
    const modal = document.getElementById('edit-child-modal');
    if (modal) modal.classList.add('hidden');
    _editingChildId = null;
}

async function saveEditedChild() {
    if (!_editingChildId) return;

    const btn = document.getElementById('editChildSaveBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    const name = document.getElementById('editChildName').value.trim();
    const username = document.getElementById('editChildUsername').value.trim();
    const password = document.getElementById('editChildPassword').value;
    const avatar = document.querySelector('input[name="editAvatar"]:checked')?.value || 'Felix';
    const allowChat = document.getElementById('editAllowChat').checked;
    const allowGames = document.getElementById('editAllowGames').checked;

    if (!name || !username || !password) {
        alert("Please fill in all fields.");
        btn.innerHTML = originalText;
        btn.disabled = false;
        return;
    }

    try {
        await DataService.updateChild(_editingChildId, {
            name, username, password, avatar, allowChat, allowGames
        });
        alert('Child profile updated successfully!');
        closeEditChildModal();
        let user = await DataService.getCurrentUser();
        await renderKidsAndStats(user); // refresh list
    } catch (e) {
        alert('Failed to update child: ' + e.message);
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
}

// ─────────────────────────────────────────────────────────────────────────
// PROFILE SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────

let _origParentUsername = '';

window.openSettingsModal = function () {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;

    const svc = window.AppwriteService;
    svc.account.get().then(acct => {
        const prefs = acct.prefs || {};
        const avatarEl = document.getElementById('sidebar-parent-avatar');

        let displayAvatarUrl = avatarEl ? avatarEl.src : '';
        if (prefs.profilePictureUrl) {
            displayAvatarUrl = prefs.profilePictureUrl;
        }

        document.getElementById('settings-avatar').src = displayAvatarUrl;
        document.getElementById('settings-email').textContent = acct.email || '';
        document.getElementById('settings-bio').value = prefs.bio || '';
        document.getElementById('settings-username').value = acct.name || '';
        _origParentUsername = acct.name || '';
        document.getElementById('settings-darkmode').checked = prefs.darkMode === 'true';
        document.getElementById('settings-current-pass').value = '';
        document.getElementById('settings-new-pass').value = '';

        const bioEl = document.getElementById('settings-bio');
        document.getElementById('bio-char-count').textContent = bioEl.value.length;
        bioEl.oninput = () => { document.getElementById('bio-char-count').textContent = bioEl.value.length; };

        const lastChange = prefs.lastUsernameChange ? new Date(prefs.lastUsernameChange) : null;
        const cooldownEl = document.getElementById('username-cooldown');
        if (lastChange) {
            const daysSince = Math.floor((Date.now() - lastChange.getTime()) / 86400000);
            const daysLeft = 30 - daysSince;
            cooldownEl.textContent = daysLeft > 0
                ? `⏳ You can change your username again in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
                : '✅ You can change your username.';
        } else {
            cooldownEl.textContent = '✅ You can change your username.';
        }
        modal.classList.remove('hidden');
    }).catch(e => { console.error('Settings load error:', e); });
};

window.closeSettingsModal = function () {
    document.getElementById('settings-modal')?.classList.add('hidden');
};

window.saveSettings = async function () {
    const svc = window.AppwriteService;
    try {
        const acct = await svc.account.get();
        const prefs = acct.prefs || {};
        const newBio = document.getElementById('settings-bio').value.trim();
        const newUsername = document.getElementById('settings-username').value.trim();
        const darkMode = document.getElementById('settings-darkmode').checked;
        const currentPass = document.getElementById('settings-current-pass').value;
        const newPass = document.getElementById('settings-new-pass').value;
        const avatarUpload = document.getElementById('settings-avatar-upload');

        const updatedPrefs = { ...prefs, bio: newBio, darkMode: String(darkMode) };

        // Handle profile picture upload
        if (avatarUpload && avatarUpload.files && avatarUpload.files.length > 0) {
            const file = avatarUpload.files[0];
            try {
                const { ID, Permission, Role } = Appwrite;
                const uploadResult = await svc.storage.createFile(
                    svc.BUCKET_PROFILE_PICS,
                    ID.unique(),
                    file,
                    [Permission.read(Role.any())]
                );

                // Construct the file view URL
                const fileUrl = `${svc.client.config.endpoint}/storage/buckets/${svc.BUCKET_PROFILE_PICS}/files/${uploadResult.$id}/view?project=${svc.client.config.project}`;

                updatedPrefs.profilePictureUrl = fileUrl;
                document.getElementById('settings-avatar').src = fileUrl;
                // Update sidebar and header avatars globally
                const sideAvatar = document.getElementById('sidebar-parent-avatar');
                if (sideAvatar) sideAvatar.src = fileUrl;
                const headerAvatar = document.getElementById('header-avatar');
                if (headerAvatar) headerAvatar.src = fileUrl;
            } catch (uploadError) {
                console.error("Profile picture upload failed:", uploadError);
                alert("Failed to upload profile picture. Please try again.");
                return;
            }
        }

        if (newUsername && newUsername !== _origParentUsername) {
            const lastChange = prefs.lastUsernameChange ? new Date(prefs.lastUsernameChange) : null;
            if (lastChange) {
                const daysSince = Math.floor((Date.now() - lastChange.getTime()) / 86400000);
                if (daysSince < 30) {
                    alert(`You can only change your username once every 30 days. ${30 - daysSince} days remaining.`);
                    return;
                }
            }
            await svc.account.updateName(newUsername);
            updatedPrefs.lastUsernameChange = new Date().toISOString();
        }

        await svc.account.updatePrefs(updatedPrefs);

        if (currentPass && newPass) {
            if (newPass.length < 8) { alert('New password must be at least 8 characters.'); return; }
            await svc.account.updatePassword(newPass, currentPass);
            alert('Password updated successfully!');
        }

        // Dark mode — save to localStorage for instant load next time
        if (darkMode) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('cubbycove_theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('cubbycove_theme', 'light');
        }

        const nameEl = document.getElementById('sidebar-parent-name');
        if (nameEl && newUsername) nameEl.textContent = newUsername;

        closeSettingsModal();
        alert('Settings saved!');
    } catch (e) {
        alert('Error saving settings: ' + e.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PARENT PROFILE PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Saves parent profile fields (firstName, lastName, bio, profilePicture) to
 * the Users collection AND Appwrite Account Preferences.
 *
 * Call from a "Save Profile" button: onclick="saveParentProfile()"
 * Reads values from: #parent-first-name, #parent-last-name, #parent-bio,
 *                    #parent-profile-pic (optional URL field)
 */
window.saveParentProfile = async function () {
    const session = JSON.parse(sessionStorage.getItem('cubby_session') || '{}');
    if (!session || !session.$id) {
        alert('Session not found. Please log in again.');
        return;
    }

    const firstNameEl = document.getElementById('parent-first-name');
    const lastNameEl  = document.getElementById('parent-last-name');
    const bioEl       = document.getElementById('parent-bio');
    const picEl       = document.getElementById('parent-profile-pic');

    const profileData = {
        firstName: firstNameEl ? firstNameEl.value.trim() : undefined,
        lastName:  lastNameEl  ? lastNameEl.value.trim()  : undefined,
        prefs: {
            bio:               bioEl ? bioEl.value.trim() : undefined,
            profilePictureUrl: picEl ? picEl.value.trim() : undefined,
        }
    };

    // Remove undefined fields from prefs
    Object.keys(profileData.prefs).forEach(k => {
        if (profileData.prefs[k] === undefined) delete profileData.prefs[k];
    });

    const saveBtn = document.getElementById('parent-save-profile-btn');
    const originalHtml = saveBtn ? saveBtn.innerHTML : null;
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Saving...';
    }

    try {
        await DataService.updateUserProfile(session.$id, profileData);

        // Sync local session
        if (profileData.firstName) session.firstName = profileData.firstName;
        if (profileData.lastName)  session.lastName  = profileData.lastName;
        sessionStorage.setItem('cubby_session', JSON.stringify(session));

        // Refresh sidebar name if present
        const nameEl = document.getElementById('sidebar-parent-name');
        if (nameEl && profileData.firstName) {
            nameEl.textContent = `${profileData.firstName} ${profileData.lastName || ''}`.trim();
        }

        alert('Profile saved! ✅');
    } catch (e) {
        console.error('[saveParentProfile] Error:', e);
        alert('❌ Could not save profile: ' + e.message + '\n\nYour changes were NOT saved.');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    }
};