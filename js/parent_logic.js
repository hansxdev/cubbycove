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

// ── Notification Bell Panel Toggle ────────────────────────────────────────────
function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const isHidden = panel.classList.toggle('hidden');
    if (!isHidden) {
        // Panel just opened — refresh notifications immediately
        checkLoginRequests();
        // Close panel when clicking outside
        setTimeout(() => {
            document.addEventListener('click', _closeNotifOnOutsideClick, { once: true, capture: true });
        }, 0);
    }
}

function _closeNotifOnOutsideClick(e) {
    const panel = document.getElementById('notif-panel');
    const bell  = document.getElementById('notif-bell-btn');
    if (panel && !panel.contains(e.target) && !bell?.contains(e.target)) {
        panel.classList.add('hidden');
    } else if (panel && !panel.classList.contains('hidden')) {
        // Click was inside panel — re-add listener
        document.addEventListener('click', _closeNotifOnOutsideClick, { once: true, capture: true });
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

    const addBtnHtml = `
        <a href="register_child.html" class="flex-shrink-0 w-12 h-12 rounded-[1rem] bg-white/40 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-[#28C7AE] hover:border-[#28C7AE] hover:bg-white transition-all cursor-pointer shadow-sm group mx-2 my-auto">
            <i class="fa-solid fa-plus text-lg group-hover:scale-110 transition-transform"></i>
        </a>
    `;

    if (!children || children.length === 0) {
        if (kidsListEl) {
            kidsListEl.innerHTML = `
                <div class="text-center py-4 text-xs font-semibold text-gray-500 flex items-center">No children added yet.</div>
                ${addBtnHtml}
            `;
        }
        return;
    }

    // Set default selected child if none selected yet
    if (!_selectedChildId && children.length > 0) {
        _selectedChildId = children[0].$id;
    }

    if (kidsListEl) kidsListEl.innerHTML = '';

    children.forEach(child => {
        const isActive = child.$id === _selectedChildId;
        const activeBg = isActive ? 'border-[#28C7AE] bg-white ring-2 ring-[#28C7AE]/30' : 'border-white/60 bg-white/60 hover:border-sky-300 hover:bg-white';
        const activeText = isActive ? 'text-gray-800' : 'text-gray-600 group-hover:text-cubby-purple';

        let avatarHtml = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(child.username || child.name)}"
                    class="w-10 h-10 rounded-full bg-gray-50 border-2 border-white shadow-sm object-cover transition-transform group-hover:scale-105">`;

        if (child.avatarImage) {
            const bgStr = child.avatarBgColor ? `style="background-color: ${child.avatarBgColor}"` : 'bg-white';
            avatarHtml = `<img src="${child.avatarImage}" ${bgStr} class="w-10 h-10 rounded-full border-2 border-white shadow-sm object-contain p-0.5 group-hover:scale-105 transition-transform">`;
        }

        // Online Status Indicator (Green dot)
        // Note: For now, if child.isOnline isn't explicitly false, assume offline unless we implement real presence
        const statusDot = child.isOnline ? 
            `<div class="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] bg-green-400 border-[3px] border-white rounded-full z-10"></div>` : 
            `<div class="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] bg-gray-300 border-[3px] border-white rounded-full z-10"></div>`;

        const html = `
            <div onclick="selectChild('${child.$id}')" class="flex-shrink-0 cursor-pointer group transition-all duration-200 ${isActive ? 'scale-105' : 'hover:-translate-y-1'}" style="width: 220px;">
                <div class="glass-card shadow-sm pl-3 pr-4 py-3 flex items-center gap-3 transition-all border-2 ${activeBg}">
                    <div class="relative w-10 h-10 shrink-0">
                        ${avatarHtml}
                        ${statusDot}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="font-extrabold text-[14px] truncate ${activeText} leading-snug">${child.name}</p>
                        <p class="text-[10px] font-bold ${child.isOnline ? 'text-green-500' : 'text-gray-400'} uppercase tracking-wider truncate mt-0.5">${child.isOnline ? 'Online' : 'Offline'}</p>
                    </div>
                    
                    <button onclick="openEditChildModal('${child.$id}', event)" title="Edit child" 
                        class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-cubby-purple hover:bg-purple-50 transition-colors focus:outline-none shrink-0 border border-transparent hover:border-purple-100">
                        <i class="fa-solid fa-pen text-[11px]"></i>
                    </button>
                </div>
            </div>
        `;
        if (kidsListEl) kidsListEl.insertAdjacentHTML('beforeend', html);
    });

    // Add child button (Horizontal)
    const addBtn = `
        <a href="register_child.html" class="flex-shrink-0 w-12 h-12 rounded-[1rem] bg-white/40 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-[#28C7AE] hover:border-[#28C7AE] hover:bg-white transition-all cursor-pointer shadow-sm group mx-2 my-auto">
            <i class="fa-solid fa-plus text-lg group-hover:scale-110 transition-transform"></i>
        </a>
    `;
    if (kidsListEl) kidsListEl.insertAdjacentHTML('beforeend', addBtn);

    // Render child-specific modules
    renderActivityLogs();
    renderSafetyAlerts();
    renderRewardsAndPaths();
    changeTimeMode(currentScreenTimeMode);
}

window.selectChild = function (childId) {
    if (_selectedChildId === childId) return; // already selected
    _selectedChildId = childId;

    // Re-render the sidebar child cards from cached data (no DB re-fetch)
    const kidsListEl = document.getElementById('sidebar-kids-list');
    if (kidsListEl) {
        kidsListEl.innerHTML = '';
        const children = window._currentChildren || [];
        children.forEach(child => {
            const isActive = child.$id === _selectedChildId;
            const activeBg = isActive ? 'border-[#28C7AE] bg-white ring-2 ring-[#28C7AE]/30' : 'border-white/60 bg-white/60 hover:border-sky-300 hover:bg-white';
            const activeText = isActive ? 'text-gray-800' : 'text-gray-600 group-hover:text-cubby-purple';

            let avatarHtml = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(child.username || child.name)}"
                        class="w-10 h-10 rounded-full bg-gray-50 border-2 border-white shadow-sm object-cover transition-transform group-hover:scale-105">`;
            if (child.avatarImage) {
                const bgStr = child.avatarBgColor ? `style="background-color: ${child.avatarBgColor}"` : 'bg-white';
                avatarHtml = `<img src="${child.avatarImage}" ${bgStr} class="w-10 h-10 rounded-full border-2 border-white shadow-sm object-contain p-0.5 group-hover:scale-105 transition-transform">`;
            }

            const statusDot = child.isOnline
                ? `<div class="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] bg-green-400 border-[3px] border-white rounded-full z-10"></div>`
                : `<div class="absolute -bottom-0.5 -right-0.5 w-[14px] h-[14px] bg-gray-300 border-[3px] border-white rounded-full z-10"></div>`;

            const html = `
                <div onclick="selectChild('${child.$id}')" class="flex-shrink-0 cursor-pointer group transition-all duration-200 ${isActive ? 'scale-105' : 'hover:-translate-y-1'}" style="width: 220px;">
                    <div class="glass-card shadow-sm pl-3 pr-4 py-3 flex items-center gap-3 transition-all border-2 ${activeBg}">
                        <div class="relative w-10 h-10 shrink-0">
                            ${avatarHtml}
                            ${statusDot}
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="font-extrabold text-[14px] truncate ${activeText} leading-snug">${child.name}</p>
                            <p class="text-[10px] font-bold ${child.isOnline ? 'text-green-500' : 'text-gray-400'} uppercase tracking-wider truncate mt-0.5">${child.isOnline ? 'Online' : 'Offline'}</p>
                        </div>
                        <button onclick="openEditChildModal('${child.$id}', event)" title="Edit child"
                            class="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-cubby-purple hover:bg-purple-50 transition-colors focus:outline-none shrink-0 border border-transparent hover:border-purple-100">
                            <i class="fa-solid fa-pen text-[11px]"></i>
                        </button>
                    </div>
                </div>`;
            kidsListEl.insertAdjacentHTML('beforeend', html);
        });

        // Re-add the add-child button
        kidsListEl.insertAdjacentHTML('beforeend', `
            <a href="register_child.html" class="flex-shrink-0 w-12 h-12 rounded-[1rem] bg-white/40 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-[#28C7AE] hover:border-[#28C7AE] hover:bg-white transition-all cursor-pointer shadow-sm group mx-2 my-auto">
                <i class="fa-solid fa-plus text-lg group-hover:scale-110 transition-transform"></i>
            </a>`);
    }

    // Refresh data panels for the newly selected child (uses cached data — no DB re-fetch)
    renderActivityLogs();
    renderSafetyAlerts();
    renderRewardsAndPaths();
    changeTimeMode(currentScreenTimeMode);
};

window._activityState = { data: [], page: 1, limit: 5 };

async function renderActivityLogs() {
    const listEl = document.getElementById('activity-list');
    if (!listEl || !_selectedChildId) return;

    // Show a loading state while fetching
    listEl.innerHTML = '<div class="absolute inset-0 flex items-center justify-center h-full"><i class="fa-solid fa-spinner fa-spin text-xl text-gray-300"></i></div>';

    let logs = [];
    try {
        logs = await DataService.getActivityLogs(_selectedChildId, 50, 'week');
    } catch (e) {
        console.warn('[ActivityLogs] fetch error:', e.message);
    }

    if (!logs || logs.length === 0) {
        listEl.innerHTML = '<div class="absolute inset-0 flex items-center justify-center h-full text-sm text-gray-400 font-medium pb-10">No recent activity.</div>';
        return;
    }

    // Sort by descending timestamp
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    window._activityState.data = logs;
    window._activityState.page = 1;
    _renderActivityPage();
}

window.changeActivityPage = function(delta) {
    window._activityState.page += delta;
    _renderActivityPage();
};

function _renderActivityPage() {
    const listEl = document.getElementById('activity-list');
    if (!listEl) return;
    
    const { data, page, limit } = window._activityState;
    const totalPages = Math.ceil(data.length / limit) || 1;
    const slice = data.slice((page - 1) * limit, page * limit);

    let html = '<div class="absolute left-6 top-2 bottom-12 w-px bg-gray-100"></div><div class="space-y-3 pb-2">';

    const _typeStyle = (type) => {
        switch ((type || '').toLowerCase()) {
            case 'play':           return { bg: '#EEF4FF', text: '#5B8DEF', icon: 'fa-gamepad' };
            case 'watch':          return { bg: '#FFF4EC', text: '#FF7D3A', icon: 'fa-play-circle' };
            case 'buddy_add':      return { bg: '#F0FBF4', text: '#2ECC71', icon: 'fa-user-plus' };
            case 'message_sent':   return { bg: '#F3F0FF', text: '#8A51FC', icon: 'fa-comment' };
            case 'reward':         return { bg: '#FFFBEB', text: '#F59E0B', icon: 'fa-star' };
            case 'game_reward':    return { bg: '#FFFBEB', text: '#F59E0B', icon: 'fa-trophy' };
            case 'safety_threat':  return { bg: '#FFF1F2', text: '#FF456A', icon: 'fa-shield-exclamation' };
            default:               return { bg: '#EEF9EC', text: '#5EC74D', icon: 'fa-circle-check' };
        }
    };

    slice.forEach(log => {
        const ts = log.timestamp || log.$createdAt;
        const timeAgoStr = ts ? timeAgo(ts) : '';
        const timeOfDay = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        const style = _typeStyle(log.type);
        html += `
            <div class="flex gap-4 relative items-start">
                <div class="w-10 h-10 rounded-[14px] border-[3px] border-white shadow-sm z-10 flex-shrink-0 flex items-center justify-center mt-0.5 ml-1"
                     style="background:${style.bg}; color:${style.text};">
                    <i class="fa-solid ${style.icon} text-xs"></i>
                </div>
                <div class="bg-gray-50 rounded-2xl p-4 flex-1 border border-gray-100/50 shadow-sm transition-all hover:bg-white min-w-0">
                    <p class="text-sm text-[#1C1D21] font-bold truncate">${log.action}</p>
                    <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span class="text-xs font-bold text-gray-400"><i class="fa-regular fa-clock mr-1 text-[10px]"></i>${timeOfDay}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${style.bg}; color:${style.text};">${timeAgoStr}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';

    if (totalPages > 1) {
        html += `
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 sticky bottom-0 bg-white/90 backdrop-blur-sm z-20 pb-2">
                <button onclick="changeActivityPage(-1)" ${page <= 1 ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-[#28C7AE] transition-colors"'}><i class="fa-solid fa-chevron-left mr-1.5"></i>Prev</button>
                <span class="text-[9px] font-black pointer-events-none text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">Page ${page} / ${totalPages}</span>
                <button onclick="changeActivityPage(1)" ${page >= totalPages ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-[#28C7AE] transition-colors"'}>Next<i class="fa-solid fa-chevron-right ml-1.5"></i></button>
            </div>
        `;
    }

    listEl.innerHTML = html;
}

window._safetyState = { data: [], page: 1, limit: 3 };

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

    const combined = [
        ...childSafetyNotifs.map(n => ({ kind: 'notif', data: n, ts: n.createdAt })),
        ...childThreats.map(t => ({ kind: 'threat', data: t, ts: t.$createdAt }))
    ];
    combined.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    
    window._safetyState.data = combined;
    window._safetyState.page = 1;
    _renderSafetyPage();
}

window.changeSafetyPage = function(delta) {
    window._safetyState.page += delta;
    _renderSafetyPage();
};

function _renderSafetyPage() {
    const listEl = document.getElementById('safety-list');
    if (!listEl) return;
    
    const { data, page, limit } = window._safetyState;
    const totalPages = Math.ceil(data.length / limit) || 1;
    const slice = data.slice((page - 1) * limit, page * limit);
    
    let html = '<div class="space-y-3 pb-2">';
    
    slice.forEach(item => {
        if (item.kind === 'notif') {
            const notif = item.data;
            const timeStr = timeAgo(notif.createdAt);
            const parts = (notif.message || '').split('\n');
            const lastLine = parts[parts.length - 1] || '';
            const mainMsg = parts.slice(0, parts.length - 1).join('\n').trim();

            html += `
                <div class="bg-white/60 backdrop-blur-sm rounded-[20px] p-4 border border-white shadow-sm transition-all hover:bg-white hover:border-[#8A51FC]/30 group cursor-pointer" onclick="document.getElementById('guidance-flyout').classList.remove('translate-x-full'); document.getElementById('guidance-overlay').classList.remove('hidden');">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-[14px] bg-[#F3F0FF] text-[#8A51FC] border-[3px] border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5 relative">
                            <i class="fa-solid fa-shield-cat text-xs"></i>
                            <div class="absolute -top-1 -right-1 w-3 h-3 bg-red-400 border-2 border-white rounded-full"></div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1.5">
                                <h4 class="text-[14px] font-extrabold text-[#1C1D21]">Safety Alert</h4>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${timeStr}</span>
                            </div>
                            <p class="text-[12px] text-gray-600 font-bold mb-2 leading-relaxed bg-white/50 p-2.5 rounded-xl border border-gray-100/50 whitespace-pre-wrap break-words">${escHtml(mainMsg)}</p>
                            ${lastLine ? `<p class="text-[11px] font-extrabold text-[#8A51FC] mt-1.5 flex items-center gap-1"><i class="fa-solid fa-circle-info text-[9px]"></i> ${escHtml(lastLine)}</p>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            const threat = item.data;
            const timeStr = timeAgo(threat.$createdAt);
            const excerpt = threat.messageContent || threat.messagePreview || 'Inappropriate content detected.';
            const resolved = threat.status === 'resolved';

            const style = resolved 
                ? { bg: '#EEF9EC', text: '#5EC74D', icon: 'fa-shield-check', border: 'hover:border-[#5EC74D]/30' }
                : { bg: '#FFF1F2', text: '#FF456A', icon: 'fa-shield-exclamation', border: 'hover:border-[#FF456A]/30' };

            html += `
                <div class="bg-white/60 backdrop-blur-sm rounded-[20px] p-4 border border-white shadow-sm transition-all hover:bg-white ${style.border} group">
                    <div class="flex items-start gap-4">
                        <div class="w-10 h-10 rounded-[14px] border-[3px] border-white shadow-sm flex items-center justify-center shrink-0 mt-0.5"
                             style="background: ${style.bg}; color: ${style.text};">
                            <i class="fa-solid ${style.icon} text-xs"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between mb-1.5">
                                <h4 class="text-[14px] font-extrabold text-[#1C1D21]">Chat Moderation</h4>
                                <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">${timeStr}</span>
                            </div>
                            <p class="text-[12px] text-gray-500 font-medium italic mb-3 leading-relaxed bg-white/50 p-2.5 rounded-xl border border-gray-100/50 line-clamp-2">"${escHtml(excerpt)}"</p>
                            <div class="flex justify-start">
                                <span class="text-[9px] font-extrabold px-2.5 py-1 rounded-[8px] border border-white shadow-sm uppercase tracking-wider"
                                      style="background: ${style.bg}; color: ${style.text};">
                                    ${threat.status || 'pending'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';

    if (totalPages > 1) {
        html += `
            <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 sticky bottom-0 bg-white/90 backdrop-blur-sm z-20 pb-2">
                <button onclick="changeSafetyPage(-1)" ${page <= 1 ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-[#28C7AE] transition-colors"'}><i class="fa-solid fa-chevron-left mr-1.5"></i>Prev</button>
                <span class="text-[9px] font-black pointer-events-none text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">Page ${page} / ${totalPages}</span>
                <button onclick="changeSafetyPage(1)" ${page >= totalPages ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-[#28C7AE] transition-colors"'}>Next<i class="fa-solid fa-chevron-right ml-1.5"></i></button>
            </div>
        `;
    }

    listEl.innerHTML = html;
}

window._rewardsState = { pathsHtml: '', rewards: [], page: 1, limit: 4 };

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

        let pathsHtml = '';
        if (pathStatuses.length > 0) {
            pathsHtml += `<div>
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

                pathsHtml += `
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
            pathsHtml += `</div></div>`;
        }

        window._rewardsState.pathsHtml = pathsHtml;
        window._rewardsState.rewards = rewards.sort((a,b) => new Date(b.earnedAt) - new Date(a.earnedAt));
        window._rewardsState.page = 1;
        
        _renderRewardsPage();

    } catch (e) {
        console.error('renderRewardsAndPaths error:', e);
        container.innerHTML = '<div class="text-center py-10 text-red-400 font-bold">Error loading progress data.</div>';
    }
}

window.changeRewardsPage = function(delta) {
    window._rewardsState.page += delta;
    _renderRewardsPage();
};

function _renderRewardsPage() {
    const container = document.getElementById('rewards-progress-container');
    if (!container) return;
    
    let html = '<div class="space-y-6">';
    html += window._rewardsState.pathsHtml;

    const { rewards, page, limit } = window._rewardsState;
    
    if (rewards.length > 0) {
        html += `<div class="relative mt-2">
            <div class="absolute left-[22px] top-6 bottom-0 w-px bg-gray-100 z-0"></div>
            <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                <i class="fa-solid fa-bolt text-orange-400"></i> Recent Achievements
            </h4>
            <div class="space-y-3 pb-2 relative z-10">`;
        
        const totalPages = Math.ceil(rewards.length / limit) || 1;
        const slice = rewards.slice((page - 1) * limit, page * limit);

        slice.forEach(reward => {
            const timeStr = timeAgo(reward.earnedAt);
            const isPathBonus = reward.rewardType === 'path_bonus';
            const bgClass = isPathBonus ? 'bg-[#F3F0FF] text-[#8A51FC]' : 'bg-[#FFFBEB] text-[#F59E0B]';
            const icon = isPathBonus ? 'fa-trophy' : 'fa-star';
            
            html += `
                <div class="flex gap-4 relative items-start">
                    <div class="w-10 h-10 rounded-[14px] border-[3px] border-white shadow-sm z-10 flex-shrink-0 flex items-center justify-center mt-0.5 ml-0.5 ${bgClass}">
                        <i class="fa-solid ${icon} text-xs"></i>
                    </div>
                    <div class="bg-gray-50 rounded-2xl p-4 flex-1 border border-gray-100/50 shadow-sm transition-all hover:bg-white min-w-0 flex items-center justify-between">
                        <div class="flex-1 min-w-0 pr-2">
                            <p class="text-sm text-[#1C1D21] font-bold truncate">${isPathBonus ? 'Learning Path Complete!' : 'Video Watch Reward'}</p>
                            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span class="text-xs font-bold text-gray-400"><i class="fa-regular fa-clock mr-1 text-[10px]"></i>${timeStr}</span>
                                ${isPathBonus ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${bgClass}">Path Bonus</span>` : ''}
                            </div>
                        </div>
                        <div class="text-[14px] font-black ${isPathBonus ? 'text-[#8A51FC]' : 'text-orange-500'} bg-white px-3 py-1.5 rounded-[12px] shadow-sm border border-gray-100 shrink-0">+${reward.points}</div>
                    </div>
                </div>`;
        });
        html += `</div>`;
        
        if (totalPages > 1) {
            html += `
                <div class="flex items-center justify-between mt-3 pt-4 border-t border-gray-100 relative z-10 bg-white/90 backdrop-blur-sm">
                    <button onclick="changeRewardsPage(-1)" ${page <= 1 ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-orange-500 transition-colors"'}><i class="fa-solid fa-chevron-left mr-1.5"></i>Prev</button>
                    <span class="text-[9px] font-black pointer-events-none text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">Page ${page} / ${totalPages}</span>
                    <button onclick="changeRewardsPage(1)" ${page >= totalPages ? 'disabled class="text-[11px] font-extrabold text-gray-300 cursor-not-allowed"' : 'class="text-[11px] font-extrabold text-gray-600 hover:text-orange-500 transition-colors"'}>Next<i class="fa-solid fa-chevron-right ml-1.5"></i></button>
                </div>
            `;
        }
        
        html += `</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
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
            try {
                const parsed = JSON.parse(activeChild.screenTimeLogs);
                // Guard: JSON.parse might return an object (e.g. {_timeSettings:...})
                // instead of an array — check before assigning.
                logs = Array.isArray(parsed) ? parsed : [];
            } catch (e) { logs = []; }
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

    // Define standard Chart.js datasets for Playful Glass aesthetic
    let datasets = [];
    let chartType = 'line'; // Always use line chart for smooth area graph

    // Note: Creating gradients requires a canvas context, but Chart.js 3+ supports scriptable options nicely.
    // For simplicity, we define the background colors as soft rgba.
    
    if (mode === 'overall') {
        datasets = [
            {
                label: 'Total Screen Time (mins)',
                data: overallData,
                borderColor: '#8A51FC',
                backgroundColor: 'rgba(182, 137, 245, 0.4)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#8A51FC',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ];
    } else {
        datasets = [
            {
                label: 'Games',
                data: gameMinsData.map(v => v || 0), // Use 0 (not null) so zero-minute days render as flat points, not gaps
                borderColor: '#B689F5',
                backgroundColor: 'rgba(182, 137, 245, 0.3)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#B689F5',
                pointBorderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6
            },
            {
                label: 'Entertainment',
                data: entMinsData.map(v => v || 0),
                borderColor: '#FFAF7A',
                backgroundColor: 'rgba(255, 175, 122, 0.3)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#FFAF7A',
                pointBorderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6
            },
            {
                label: 'Communication',
                data: comMinsData.map(v => v || 0),
                borderColor: '#5EC74D',
                backgroundColor: 'rgba(94, 199, 77, 0.3)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#5EC74D',
                pointBorderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6
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

// Helper: Accurate Time Ago (supports days, weeks, months)
function timeAgo(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 14) return '1 week ago';
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return '1 month ago';
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

// ─────────────────────────────────────────────────────────────────────────────
// TAB SWITCHER
// ─────────────────────────────────────────────────────────────────────────────

let _activeTab = 'dashboard';

// switchTab function merged below to handle all tabs

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG — Unified Smart Feed
// ─────────────────────────────────────────────────────────────────────────────

let _cachedFeed = [];
let _currentFilter = 'all';

async function renderFullActivityLog() {
    const container = document.getElementById('activity-feed-container');
    if (!container || !_selectedChildId) {
        if (container) container.innerHTML = '<div class="text-center py-16 text-gray-400 font-bold">Select a child to view their activity log.</div>';
        return;
    }

    container.innerHTML = '<div class="flex items-center justify-center py-16 text-gray-400 font-bold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading activity feed...</div>';

    try {
        _cachedFeed = await DataService.getUnifiedActivityFeed(_selectedChildId, 100);
        renderFeedWithFilter(_currentFilter);
    } catch (e) {
        console.error('renderFullActivityLog error:', e);
        container.innerHTML = '<div class="text-center py-10 text-red-400 font-bold">Could not load activity log.</div>';
    }
}

window.filterActivityLog = function (filter) {
    _currentFilter = filter;
    document.querySelectorAll('.log-filter-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-[#28C7AE]', 'text-white');
        if (!btn.classList.contains('bg-red-100') && !btn.classList.contains('bg-blue-100') &&
            !btn.classList.contains('bg-green-100') && !btn.classList.contains('bg-purple-100')) {
            btn.classList.add('bg-gray-100', 'text-gray-500');
        }
    });
    const active = event?.target?.closest('.log-filter-btn');
    if (active) { active.classList.add('active'); }
    renderFeedWithFilter(filter);
};

function renderFeedWithFilter(filter) {
    const container = document.getElementById('activity-feed-container');
    if (!container) return;

    const filtered = filter === 'all' ? _cachedFeed : _cachedFeed.filter(item => item.feedCategory === filter);

    if (filtered.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid fa-inbox text-5xl mb-4 opacity-30"></i>
            <p class="font-extrabold text-lg">No ${filter === 'all' ? '' : filter + ' '}activity found</p>
            <p class="text-sm mt-1">Activity will appear here as your child uses CubbyCove.</p>
        </div>`;
        return;
    }

    const categoryConfig = {
        threat:   { icon: 'fa-shield-exclamation', color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',   label: 'Safety Alert',  cardClass: 'feed-card-threat'  },
        activity: { icon: 'fa-play',               color: 'text-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200',  label: 'Activity',      cardClass: 'feed-card-activity'},
        game:     { icon: 'fa-gamepad',            color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200',label: 'Game',          cardClass: 'feed-card-game'   },
        social:   { icon: 'fa-users',              color: 'text-green-500',  bg: 'bg-green-50',  border: 'border-green-200', label: 'Social',        cardClass: 'feed-card-social' },
    };

    const html = filtered.map(item => {
        const cfg = categoryConfig[item.feedCategory] || categoryConfig.activity;
        const timeStr = timeAgo(item.timestamp);
        const fullTime = new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isThreat = item.feedCategory === 'threat';

        // For threat cards: make them clickable & add a guidance cue badge
        const guidanceCue = isThreat ? `
            <button class="ml-auto shrink-0 flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-xl transition-all">
                <i class="fa-solid fa-lightbulb text-amber-500"></i> Guidance
            </button>` : '';

        const clickAttr = isThreat
            ? `onclick="openGuidanceFlyout(${JSON.stringify(item).replace(/"/g, '&quot;')})" style="cursor:pointer;"`
            : '';

        return `
        <div class="feed-card ${cfg.cardClass} rounded-2xl p-4 border border-gray-100 flex items-start gap-4 hover:shadow-sm transition-all group ${isThreat ? 'hover:border-amber-300 hover:bg-amber-50/30' : ''}" ${clickAttr}>
            <div class="w-10 h-10 ${cfg.bg} ${cfg.color} rounded-[14px] flex items-center justify-center shrink-0 border border-white shadow-sm mt-0.5">
                <i class="fa-solid ${cfg.icon} text-sm"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-800 text-sm leading-snug">${escHtml(item.action || 'Activity recorded')}</p>
                <div class="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span class="text-[10px] font-black uppercase tracking-wider ${cfg.color} ${cfg.bg} px-2 py-0.5 rounded-md">${cfg.label}</span>
                    <span class="text-[11px] font-bold text-gray-400" title="${fullTime}"><i class="fa-regular fa-clock mr-1 opacity-60"></i>${timeStr}</span>
                </div>
            </div>
            ${guidanceCue}
        </div>`;
    }).join('');

    container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS — Charts & Hero Summary
// ─────────────────────────────────────────────────────────────────────────────

let _timeBudgetChart = null;
let _categoryChart   = null;
let _weeklyChart     = null;
let _heatmapChart    = null;

async function renderReports() {
    if (!_selectedChildId) return;

    const child = (window._currentChildren || []).find(c => c.$id === _selectedChildId);
    const childName = child?.name || 'Your child';

    // Fetch data in parallel
    const [summary, timeSettings] = await Promise.all([
        DataService.getScreenTimeSummary(_selectedChildId).catch(() => ({
            totalMinutesToday: 0, byCategory: {}, byDay: {}, topContent: [], byHour: Array(24).fill(0), totalActivities: 0
        })),
        DataService.getChildTimeSettings(_selectedChildId).catch(() => ({ dailyAllowanceMinutes: 60 }))
    ]);

    // ── Hero Summary Text ────────────────────────────────────────────────────
    _buildHeroSummary(childName, summary, timeSettings);

    // ── Time Budget Ring ─────────────────────────────────────────────────────
    const used   = Math.round(summary.totalMinutesToday);
    const budget = timeSettings.dailyAllowanceMinutes || 60;
    const remaining = Math.max(0, budget - used);
    const usedPct = Math.min(100, Math.round((used / budget) * 100));
    const ringColor = usedPct >= 90 ? '#f43f5e' : usedPct >= 70 ? '#f59e0b' : '#28C7AE';

    document.getElementById('ring-used').textContent    = used < 60 ? `${used}m` : `${Math.floor(used/60)}h${used%60 ? (used%60)+'m' : ''}`;
    document.getElementById('ring-total').textContent   = `of ${budget}m`;
    document.getElementById('ring-remaining').textContent = remaining < 60 ? `${remaining}m` : `${Math.floor(remaining/60)}h${remaining%60 ? (remaining%60)+'m' : ''}`;
    document.getElementById('ring-pct').textContent     = `${usedPct}%`;

    const budgetCanvas = document.getElementById('timeBudgetChart');
    if (budgetCanvas) {
        if (_timeBudgetChart) _timeBudgetChart.destroy();
        _timeBudgetChart = new Chart(budgetCanvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [used, Math.max(0, budget - used)],
                    backgroundColor: [ringColor, '#f0fdf4'],
                    borderWidth: 0,
                    circumference: 360,
                }]
            },
            options: {
                cutout: '75%',
                responsive: true,
                maintainAspectRatio: true,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: { animateRotate: true, duration: 800 }
            }
        });
    }

    // ── Category Pie Chart ───────────────────────────────────────────────────
    const catColors = { games: '#8b5cf6', entertainment: '#f59e0b', communication: '#10b981', general: '#3b82f6', learning: '#f43f5e' };
    const catEntries = Object.entries(summary.byCategory);
    const catCanvas = document.getElementById('categoryChart');
    if (catCanvas) {
        if (_categoryChart) _categoryChart.destroy();
        if (catEntries.length === 0) {
            catCanvas.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 font-bold text-sm">No activity today</div>';
        } else {
            _categoryChart = new Chart(catCanvas, {
                type: 'doughnut',
                data: {
                    labels: catEntries.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)),
                    datasets: [{ data: catEntries.map(([,v]) => Math.round(v)), backgroundColor: catEntries.map(([k]) => catColors[k] || '#94a3b8'), borderWidth: 2, borderColor: '#fff' }]
                },
                options: { cutout: '60%', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} min` } } } }
            });

            // Legend
            const legendEl = document.getElementById('category-legend');
            if (legendEl) {
                legendEl.innerHTML = catEntries.map(([k, v]) => `
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 rounded-full" style="background:${catColors[k]||'#94a3b8'}"></div>
                            <span class="text-xs font-bold text-gray-600 capitalize">${k}</span>
                        </div>
                        <span class="text-xs font-extrabold text-gray-800">${Math.round(v)}m</span>
                    </div>`).join('');
            }
        }
    }

    // ── Weekly Bar Chart ─────────────────────────────────────────────────────
    const weeklyCanvas = document.getElementById('weeklyChart');
    if (weeklyCanvas) {
        if (_weeklyChart) _weeklyChart.destroy();
        const dayLabels = Object.keys(summary.byDay);
        const dayValues = Object.values(summary.byDay).map(v => Math.round(v));
        _weeklyChart = new Chart(weeklyCanvas, {
            type: 'bar',
            data: {
                labels: dayLabels,
                datasets: [{
                    data: dayValues,
                    backgroundColor: dayValues.map((v, i) => i === dayLabels.length - 1 ? '#28C7AE' : 'rgba(139,92,246,0.3)'),
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} min` } } },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f0f0f0', drawBorder: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9ca3af' } },
                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' }, color: '#9ca3af' } }
                }
            }
        });
    }

    // ── Heatmap (Hour Distribution) ──────────────────────────────────────────
    const heatCanvas = document.getElementById('heatmapChart');
    if (heatCanvas) {
        if (_heatmapChart) _heatmapChart.destroy();
        const hourLabels = Array.from({ length: 24 }, (_, i) => {
            if (i === 0) return '12a';
            if (i === 12) return '12p';
            return i < 12 ? `${i}a` : `${i-12}p`;
        });
        const heatMax = Math.max(...summary.byHour, 1);
        _heatmapChart = new Chart(heatCanvas, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    data: summary.byHour,
                    backgroundColor: summary.byHour.map(v => {
                        const intensity = v / heatMax;
                        if (intensity > 0.7) return '#8b5cf6';
                        if (intensity > 0.4) return '#a78bfa';
                        if (intensity > 0.1) return '#c4b5fd';
                        return '#ede9fe';
                    }),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false, beginAtZero: true },
                    x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#9ca3af', maxTicksLimit: 12 } }
                }
            }
        });
    }

    // ── Top Content ──────────────────────────────────────────────────────────
    const topEl = document.getElementById('top-content-list');
    if (topEl) {
        if (summary.topContent.length === 0) {
            topEl.innerHTML = '<p class="text-sm text-gray-400 font-bold text-center py-4">No content watched this week.</p>';
        } else {
            topEl.innerHTML = summary.topContent.map((item, i) => `
                <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl hover:bg-white transition-colors">
                    <div class="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-400 to-blue-500 text-white text-xs font-black flex items-center justify-center shrink-0">${i+1}</div>
                    <p class="flex-1 text-xs font-bold text-gray-700 truncate">${escHtml(item.action)}</p>
                    <span class="shrink-0 text-[10px] font-extrabold text-gray-400 bg-white px-2 py-0.5 rounded-lg border border-gray-100">${item.count}x</span>
                </div>`).join('');
        }
    }

    // ── Safety Scorecard ─────────────────────────────────────────────────────
    await _renderSafetyScorecard();
}

async function _renderSafetyScorecard() {
    if (!_selectedChildId) return;
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

    try {
        const { databases, DB_ID, COLLECTIONS } = AppwriteService;
        const { Query } = Appwrite;
        const threats = await databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, [
            Query.equal('childId', _selectedChildId),
            Query.greaterThanEqual('$createdAt', weekAgo.toISOString()),
            Query.limit(50)
        ]).catch(() => ({ documents: [] }));

        const total    = threats.documents.length;
        const resolved = threats.documents.filter(t => t.resolved || t.status === 'resolved').length;
        const pending  = total - resolved;

        let grade = 'A+';
        if (total > 10) grade = 'D';
        else if (total > 5) grade = 'C';
        else if (total > 2) grade = 'B';
        else if (total > 0) grade = 'B+';

        document.getElementById('sc-total-threats').textContent = total;
        document.getElementById('sc-resolved').textContent      = resolved;
        document.getElementById('sc-pending').textContent       = pending;
        document.getElementById('sc-grade').textContent         = grade;
    } catch (e) {
        console.warn('Safety scorecard error:', e.message);
    }
}

function _buildHeroSummary(name, summary, timeSettings) {
    const textEl = document.getElementById('hero-summary-text');
    const subEl  = document.getElementById('hero-summary-sub');
    if (!textEl || !subEl) return;

    const used   = Math.round(summary.totalMinutesToday);
    const budget = timeSettings.dailyAllowanceMinutes || 60;
    const usedPct = Math.min(100, Math.round((used / budget) * 100));
    const topCat = Object.entries(summary.byCategory).sort((a,b) => b[1]-a[1])[0];
    const topCatName = topCat ? topCat[0].charAt(0).toUpperCase() + topCat[0].slice(1) : null;
    const weeklyTotal = Object.values(summary.byDay).reduce((s,v) => s+v, 0);

    // Build dynamic sentence
    let headline = '';
    let sub = '';

    if (used === 0) {
        headline = `${name} hasn't logged in yet today. ✨`;
        sub = weeklyTotal > 0
            ? `This week they spent ${Math.round(weeklyTotal)} minutes on CubbyCove in total.`
            : 'No activity recorded this week.';
    } else if (usedPct >= 90) {
        headline = `${name} is almost at today's time limit! ⏰`;
        sub = `They've used ${used} of ${budget} minutes today${topCatName ? `, mostly in ${topCatName}` : ''}.`;
    } else if (usedPct >= 50) {
        headline = `${name} is having an active day on CubbyCove. 🎉`;
        sub = `${used} minutes used so far today${topCatName ? ` — mostly ${topCatName}` : ''}. ${budget - used} minutes remaining.`;
    } else {
        headline = `${name} had a light session today — great balance! 🌟`;
        sub = `Only ${used} minutes used of their ${budget}-minute daily budget.`;
    }

    if (summary.totalActivities > 20) {
        sub += ' Very active this week!';
    }

    textEl.textContent = headline;
    subEl.textContent  = sub;
}

// ─────────────────────────────────────────────────────────────────────────────
// TIME SETTINGS — Save & Load from Edit Child Modal
// ─────────────────────────────────────────────────────────────────────────────

async function loadChildTimeSettingsIntoModal(childId) {
    try {
        const settings = await DataService.getChildTimeSettings(childId);
        const allowanceEl = document.getElementById('editDailyAllowance');
        const bedtimeEl   = document.getElementById('editBedtime');
        const warnEl      = document.getElementById('editWarningThreshold');

        if (allowanceEl) allowanceEl.value = settings.dailyAllowanceMinutes ?? 60;
        if (bedtimeEl)   bedtimeEl.value   = settings.bedtime ?? '';
        if (warnEl)      warnEl.value      = settings.warningThresholdMinutes ?? 5;
    } catch (e) {
        console.warn('loadChildTimeSettingsIntoModal error:', e.message);
    }
}

window.saveChildTimeSettings = async function () {
    if (!_editingChildId) return;
    const btn = document.getElementById('saveTimeSettingsBtn');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Saving...'; }

    try {
        const settings = {
            dailyAllowanceMinutes: parseInt(document.getElementById('editDailyAllowance')?.value || '60'),
            bedtime:               document.getElementById('editBedtime')?.value || '',
            warningThresholdMinutes: parseInt(document.getElementById('editWarningThreshold')?.value || '5'),
            allowChat:             document.getElementById('editAllowChat')?.checked ?? true,
            allowGames:            document.getElementById('editAllowGames')?.checked ?? true,
        };

        await DataService.updateChildTimeSettings(_editingChildId, settings);

        // Refresh cache
        const user = await DataService.getCurrentUser();
        if (user) await renderKidsAndStats(user);

        if (btn) { btn.innerHTML = '<i class="fa-solid fa-check mr-2"></i>Saved!'; }
        setTimeout(() => { if (btn) { btn.innerHTML = orig; btn.disabled = false; } }, 2000);
    } catch (e) {
        alert('Failed to save time settings: ' + e.message);
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
};

// Patch openEditChildModal to also load time settings
const _origOpenEditChildModal = window.openEditChildModal || openEditChildModal;
window.openEditChildModal = function (childId, event) {
    if (event) event.stopPropagation();
    _origOpenEditChildModal(childId, event);
    loadChildTimeSettingsIntoModal(childId);
};

// ─────────────────────────────────────────────────────────────────────────────
// CONNECT selectChild TO ACTIVE TAB RE-RENDER
// ─────────────────────────────────────────────────────────────────────────────

const _origSelectChild = window.selectChild;
window.selectChild = function (childId) {
    _origSelectChild(childId);
    // Re-render the active tab if it's activity or reports
    if (_activeTab === 'activity') renderFullActivityLog();
    if (_activeTab === 'reports') renderReports();
};

// ─────────────────────────────────────────────────────────────────────────────
// BROWSER PUSH NOTIFICATIONS — Safety Threats
// ─────────────────────────────────────────────────────────────────────────────

let _lastKnownThreatCount = 0;

async function checkForNewThreats() {
    if (!_selectedChildId) return;
    try {
        const { databases, DB_ID, COLLECTIONS } = AppwriteService;
        const { Query } = Appwrite;
        // Only look at threats from the last 2 minutes (fresh threats)
        const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const fresh = await databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, [
            Query.equal('childId', _selectedChildId),
            Query.greaterThanEqual('$createdAt', twoMinsAgo),
            Query.limit(5)
        ]).catch(() => ({ documents: [] }));

        if (fresh.documents.length > _lastKnownThreatCount) {
            _lastKnownThreatCount = fresh.documents.length;
            const child = (window._currentChildren || []).find(c => c.$id === _selectedChildId);
            _sendBrowserNotification(
                '🚨 Safety Alert — CubbyCove',
                `${child?.name || 'Your child'} triggered a safety alert. Tap to review.`
            );
        }
    } catch (e) { /* silent */ }
}

function _sendBrowserNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        new Notification(title, { body, icon: '../images/closedlogo.png' });
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') new Notification(title, { body, icon: '../images/closedlogo.png' });
        });
    }
}

// Request notification permission on load and hook into existing poll
document.addEventListener('DOMContentLoaded', () => {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
    // Piggyback threat check onto the existing 60s SmartPoll
    const origLoadDashboard = window.loadDashboardData;
    if (origLoadDashboard) {
        window.loadDashboardData = async function () {
            await origLoadDashboard();
            checkForNewThreats();
        };
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// GUIDANCE & PRIVACY HUB — Side-Panel Flyout
// Research basis: Parental Mediation (Juarez et al., 2024) &
//                 Privacy by Design (Pothong et al., 2024)
// ─────────────────────────────────────────────────────────────────────────────

const SAFETY_GUIDANCE_MAP = {
    inappropriate_content: {
        emoji: '🛡️',
        title: 'Inappropriate Content Filtered',
        subtext: "The filter caught content that wasn't age-appropriate.",
        mediation: [
            'Ask: "What were you hoping to find when you saw this?"',
            'Discuss: Why some content is made for grown-ups, and how seeing it by accident can be confusing.',
            'Guide: Remind them they can always tell you if they see something that makes them feel uncomfortable — no questions asked.',
            'Reassure: "You didn\'t do anything wrong. The app caught it so you didn\'t have to worry about it."'
        ],
        privacyNote: 'The flagged content was analyzed by our local AI filter and was never stored permanently. Only the time and type of the event are saved to help you see patterns.',
        retentionDays: 30
    },
    cyberbullying_alert: {
        emoji: '💬',
        title: 'Kindness Filter Triggered',
        subtext: 'A message was blocked for not meeting our kindness standard.',
        mediation: [
            'Ask: "How do you think your buddy felt when you sent that?"',
            'Discuss: The "Screen Shield" effect — it\'s easy to say hurtful things when we can\'t see someone\'s face.',
            'Guide: Help them rephrase the message to be honest, but kind. Practice together!',
            'Teach: "Being kind online is just as important as being kind in person."'
        ],
        privacyNote: "The flagged message was blocked before it was sent. The full text was not stored — only the timestamp and event type. Your child's private conversations remain private.",
        retentionDays: 30
    },
    malicious_link: {
        emoji: '🔗',
        title: 'Suspicious Link Blocked',
        subtext: 'Your child may have clicked on a link that was flagged as potentially unsafe.',
        mediation: [
            'Ask: "Where did you find this link? Did someone send it to you?"',
            'Discuss: What phishing is — tricks people use online to disguise dangerous links as fun or friendly content.',
            'Guide: Teach the rule: "Before clicking a link, ask a trusted adult first."',
            'Reassure: "Clicking a bad link accidentally doesn\'t make you bad. Now you know what to look for!"'
        ],
        privacyNote: 'The URL was checked against a safety list. It was not logged in full — only the domain and event type are stored to help identify patterns.',
        retentionDays: 30
    },
    stranger_danger: {
        emoji: '👤',
        title: 'Unknown Contact Alert',
        subtext: "Someone outside your child's buddy list attempted to contact them.",
        mediation: [
            'Ask: "Do you know who this person is in real life?"',
            'Discuss: Why it\'s important to only talk to people we know and trust online.',
            'Guide: Review the buddy list together. Help them understand who is a "safe" contact.',
            'Remind: "You can always tell me if a stranger messages you, and I won\'t be upset."'
        ],
        privacyNote: 'The contact attempt was blocked and no personal information was shared with the unknown user. Only the event type and time are recorded.',
        retentionDays: 30
    },
    general: {
        emoji: '🌟',
        title: 'Safety Event Recorded',
        subtext: 'The system flagged something for your review.',
        mediation: [
            'Check in: "How has your time on CubbyCove been lately? Anything surprising or confusing?"',
            'Remind: "There are no bad questions. You can always ask me about anything you see online."',
            'Encourage: "You\'re doing great navigating the digital world. Let\'s keep learning together."'
        ],
        privacyNote: "CubbyCove collects the minimum data necessary for your child's safety. Events older than 30 days are automatically removed. No audio, video, or full message text is ever stored.",
        retentionDays: 30
    }
};

/**
 * Maps a feed item to a SAFETY_GUIDANCE_MAP key based on its action text.
 */
function _getGuidanceKey(item) {
    const action = (item.action || item.threatType || '').toLowerCase();
    if (action.includes('inappropriate') || action.includes('content') || action.includes('blocked')) return 'inappropriate_content';
    if (action.includes('bully') || action.includes('kind') || action.includes('chat') || action.includes('message')) return 'cyberbullying_alert';
    if (action.includes('link') || action.includes('url') || action.includes('phish')) return 'malicious_link';
    if (action.includes('stranger') || action.includes('unknown') || action.includes('contact')) return 'stranger_danger';
    return 'general';
}

/**
 * Opens the Guidance & Privacy Hub side-panel for a given safety event.
 */
window.openGuidanceFlyout = function (item) {
    const panel = document.getElementById('guidance-flyout');
    if (!panel) return;

    const key   = _getGuidanceKey(item);
    const guide = SAFETY_GUIDANCE_MAP[key] || SAFETY_GUIDANCE_MAP.general;

    const timeStr = item.timestamp
        ? new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Recently';

    const deleteDate = item.timestamp
        ? new Date(new Date(item.timestamp).getTime() + 30 * 24 * 60 * 60 * 1000)
              .toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        : 'after 30 days';

    // Populate panel content
    document.getElementById('gf-emoji').textContent   = guide.emoji;
    document.getElementById('gf-title').textContent   = guide.title;
    document.getElementById('gf-subtext').textContent = guide.subtext;
    document.getElementById('gf-time').textContent    = timeStr;
    document.getElementById('gf-action').textContent  = item.action || 'Safety event';

    document.getElementById('gf-tips').innerHTML = guide.mediation
        .map((tip, i) => `
            <div class="flex gap-3 items-start">
                <div class="w-6 h-6 shrink-0 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-[11px] font-black mt-0.5">${i + 1}</div>
                <p class="text-sm text-gray-700 font-medium leading-relaxed">${escHtml(tip)}</p>
            </div>`)
        .join('');

    document.getElementById('gf-privacy-note').textContent = guide.privacyNote;
    document.getElementById('gf-delete-date').textContent  = deleteDate;

    // Slide panel in from right
    panel.classList.remove('translate-x-full');
    panel.classList.add('translate-x-0');
    document.getElementById('guidance-overlay')?.classList.remove('hidden');
};

/**
 * Closes the Guidance & Privacy Hub side-panel.
 */
window.closeGuidanceFlyout = function () {
    const panel = document.getElementById('guidance-flyout');
    if (!panel) return;
    panel.classList.remove('translate-x-0');
    panel.classList.add('translate-x-full');
    document.getElementById('guidance-overlay')?.classList.add('hidden');
};

/**
 * Purges safety event logs older than 30 days from the threat_logs collection.
 * Runs once per session on parent login — fulfills the Privacy by Design commitment.
 */
async function purgeOldSafetyLogs() {
    try {
        const { databases, DB_ID, COLLECTIONS } = AppwriteService;
        const { Query } = Appwrite;
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const old = await databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, [
            Query.lessThan('$createdAt', cutoff),
            Query.limit(25) // batch: up to 25 per session
        ]).catch(() => ({ documents: [] }));

        if (old.documents.length === 0) return;

        await Promise.allSettled(
            old.documents.map(doc => databases.deleteDocument(DB_ID, COLLECTIONS.THREAT_LOGS, doc.$id))
        );

        console.log(`[PrivacyPurge] Removed ${old.documents.length} safety log(s) older than 30 days.`);
    } catch (e) {
        console.warn('[PrivacyPurge] Could not purge old logs:', e.message);
    }
}

// Hook purge into the dashboard load (runs once per session)
const _origLoadDashboardForPurge = window.loadDashboardData;
window.loadDashboardData = async function () {
    if (_origLoadDashboardForPurge) await _origLoadDashboardForPurge.apply(this, arguments);
    purgeOldSafetyLogs();
};

// ── Tab Switching ─────────────────────────────────────────────────────────────
// Tabs: dashboard | activity | reports | support
// .tab-panel { display: none } and .tab-panel.active { display: block }  — CSS in dashboard.html
window.switchTab = function (tab) {
    _activeTab = tab;
    const TABS = ['dashboard', 'activity', 'reports', 'support'];

    // update panels
    TABS.forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
    });

    // update nav pills
    TABS.forEach(t => {
        const el = document.getElementById(`nav-${t}`);
        if (!el) return;
        if (t === tab) {
            el.classList.add('active');
            el.classList.remove('text-gray-500', 'hover:bg-white/50');
        } else {
            el.classList.remove('active');
            el.classList.add('text-gray-500', 'hover:bg-white/50');
        }
    });

    // update page heading
    const headings = {
        dashboard: 'Child Profiles',
        activity:  'Activity Log',
        reports:   'Reports',
        support:   'Support Inbox'
    };
    const h = document.getElementById('page-heading');
    if (h) h.textContent = headings[tab] || tab;

    // lazy-load content
    if (tab === 'activity') renderFullActivityLog();
    if (tab === 'reports') renderReports();
    if (tab === 'support') _loadSupportTickets();
    
    return false;
};

// ── Support Inbox (Parent Side) ───────────────────────────────────────────────
let _activeTicketId   = null;
let _threadPollTimer  = null;
let _supportSenderId  = null;  // parent user.$id, set on first load

async function _getParentId() {
    if (_supportSenderId) return _supportSenderId;
    try {
        const user = await DataService.getCurrentUser();
        _supportSenderId = user?.$id || null;
    } catch { _supportSenderId = null; }
    return _supportSenderId;
}

async function _loadSupportTickets() {
    const container = document.getElementById('support-ticket-list');
    if (!container) return;

    const parentId = await _getParentId();
    if (!parentId) {
        container.innerHTML = '<p class="text-center text-sm text-gray-400 py-8 font-bold">Please log in to view tickets.</p>';
        return;
    }

    container.innerHTML = '<div class="flex items-center justify-center py-8 text-gray-400 font-bold"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading...</div>';

    const tickets = await DataService.getMyTickets(parentId);

    // Hide unread badge once loaded
    document.getElementById('support-unread-badge')?.classList.add('hidden');

    if (tickets.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <div class="text-5xl mb-4">🎧</div>
                <p class="font-black text-gray-500 text-base">No tickets yet</p>
                <p class="text-sm text-gray-400 font-bold mt-2">Click <strong>New Ticket</strong> to get help from our team.</p>
            </div>`;
        return;
    }

    const statusStyles = {
        open:     { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'Open'    },
        replied:  { bg: 'bg-green-50',  text: 'text-green-600',  label: 'Replied' },
        closed:   { bg: 'bg-gray-100',  text: 'text-gray-500',   label: 'Closed'  }
    };

    container.innerHTML = tickets.map(t => {
        const style = statusStyles[t.status] || statusStyles.open;
        const when = t.lastMessageAt
            ? new Date(t.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '';
        return `
            <div data-ticket-id="${t.$id}" data-ticket-status="${t.status}"
                 class="ticket-row flex items-center gap-4 p-4 bg-white rounded-2xl border-2 border-gray-100 hover:border-[#28C7AE] hover:shadow-md transition-all cursor-pointer group">
                <div class="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 shrink-0 group-hover:bg-teal-200 transition-colors">
                    <i class="fa-solid fa-ticket text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-extrabold text-gray-800 truncate text-sm">${escHtml(t.subject)}</p>
                    <p class="text-[11px] font-bold text-gray-400 mt-0.5 uppercase tracking-wider">${when}</p>
                </div>
                <span class="text-[10px] font-black px-2.5 py-1 rounded-full ${style.bg} ${style.text} shrink-0">${style.label}</span>
                <i class="fa-solid fa-chevron-right text-gray-300 text-xs group-hover:text-[#28C7AE] transition-colors shrink-0"></i>
            </div>`;
    }).join('');

    // Store for click lookup (avoids inline onclick quoting issues)
    window._ticketsCache = Object.fromEntries(tickets.map(t => [t.$id, t]));

    // Delegate clicks from ticket rows
    container.onclick = (e) => {
        const row = e.target.closest('.ticket-row');
        if (!row) return;
        const id = row.dataset.ticketId;
        const ticket = window._ticketsCache?.[id];
        if (ticket) openTicketThread(id, ticket.subject, ticket.status);
    };
}

window.openTicketThread = async function (ticketId, subject, status) {
    _activeTicketId = ticketId;

    const modal = document.getElementById('ticket-thread-modal');
    const subjectEl = document.getElementById('thread-ticket-subject');
    const messagesEl = document.getElementById('thread-messages');
    const input = document.getElementById('thread-reply-input');
    const sendBtn = document.getElementById('thread-send-btn');

    if (!modal || !messagesEl) return;
    if (subjectEl) subjectEl.textContent = subject;
    if (input) { input.value = ''; input.disabled = status === 'closed'; }
    if (sendBtn) sendBtn.disabled = status === 'closed';

    modal.classList.remove('hidden');
    await _renderThreadMessages(ticketId);

    // Poll for new replies every 10 seconds while thread is open
    clearInterval(_threadPollTimer);
    _threadPollTimer = setInterval(() => _renderThreadMessages(ticketId), 10000);
};

window.closeTicketThread = function () {
    document.getElementById('ticket-thread-modal')?.classList.add('hidden');
    clearInterval(_threadPollTimer);
    _threadPollTimer = null;
    _activeTicketId = null;
};

async function _renderThreadMessages(ticketId) {
    const container = document.getElementById('thread-messages');
    if (!container) return;

    const parentId = await _getParentId();
    const messages = await DataService.getSupportMessages(ticketId);

    if (messages.length === 0) {
        container.innerHTML = '<p class="text-center text-sm text-gray-400 font-bold py-4">No messages yet.</p>';
        return;
    }

    container.innerHTML = messages.map(m => {
        const isMe = !m.isStaff;
        const time = new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const bubble = isMe
            ? `<div class="flex justify-end">
                <div class="max-w-[80%]">
                    <div class="bg-[#28C7AE] text-white rounded-2xl rounded-br-sm px-4 py-3 text-sm font-bold shadow-sm">${escHtml(m.text)}</div>
                    <p class="text-[10px] text-gray-400 text-right mt-1 font-bold">${time}</p>
                </div>
               </div>`
            : `<div class="flex gap-3 items-end">
                <div class="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-xs shrink-0">🛡️</div>
                <div class="max-w-[80%]">
                    <div class="bg-gray-100 text-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 text-sm font-bold shadow-sm">${escHtml(m.text)}</div>
                    <p class="text-[10px] text-gray-400 mt-1 font-bold">Support · ${time}</p>
                </div>
               </div>`;
        return bubble;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

window.sendThreadReply = async function () {
    if (!_activeTicketId) return;

    const input = document.getElementById('thread-reply-input');
    const btn = document.getElementById('thread-send-btn');
    const text = input?.value?.trim();
    if (!text) return;

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>'; }

    try {
        const parentId = await _getParentId();
        await DataService.sendSupportMessage(_activeTicketId, parentId, false, text);
        if (input) input.value = '';
        await _renderThreadMessages(_activeTicketId);
    } catch (e) {
        alert('Could not send message: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>'; }
    }
};

window.openNewTicketModal = function () {
    document.getElementById('new-ticket-modal')?.classList.remove('hidden');
    document.getElementById('ticket-subject').value = '';
    document.getElementById('ticket-body').value = '';
};

window.closeNewTicketModal = function () {
    document.getElementById('new-ticket-modal')?.classList.add('hidden');
};

window.submitSupportTicket = async function () {
    const subject  = document.getElementById('ticket-subject')?.value?.trim();
    const category = document.getElementById('ticket-category')?.value;
    const body     = document.getElementById('ticket-body')?.value?.trim();
    const btn      = document.getElementById('submit-ticket-btn');

    if (!subject || !body) { alert('Please fill in the subject and describe the issue.'); return; }

    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Sending...'; }

    try {
        const parentId = await _getParentId();
        await DataService.createSupportTicket(parentId, 'parent', subject, category, body);
        closeNewTicketModal();
        await _loadSupportTickets();
        alert('✅ Ticket submitted! Our team will get back to you within 24 hours.');
    } catch (e) {
        alert('Error submitting ticket: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Send'; }
    }
};