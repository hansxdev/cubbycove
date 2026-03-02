// Logic for parent/dashboard.html AND parent/register_child.html

let currentScreenTimeMode = 'daily';

document.addEventListener('DOMContentLoaded', () => {

    // 1. Dashboard Logic — detect by a stable unique element
    const dashboardMain = document.getElementById('tab-overview');
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

    // Global assignment for stopping notifications
    window.stopNotifPollingGlobal = stopNotifPolling;

    // --- Start notification polling when on the dashboard ---
    if (dashboardMain) {
        startNotifPolling();
        _checkLoginRequestsRef = checkLoginRequests; // expose for inline buttons
    }

    // ── Notification Panel ───────────────────────────────────────────────────

    let _currentRequestId = null;
    let _notifPollInterval = null;

    function startNotifPolling() {
        checkLoginRequests(); // run once immediately
        _notifPollInterval = setInterval(checkLoginRequests, 10000); // then every 10s
    }

    function stopNotifPolling() {
        clearInterval(_notifPollInterval);
    }

    async function checkLoginRequests() {
        const user = await DataService.getCurrentUser();
        if (!user || !user.email) return;

        const [pending, handled, buddyNotifs] = await Promise.all([
            DataService.getPendingLoginRequests(user.email),
            DataService.getHandledLoginRequests(user.email),
            DataService.getParentNotifications(user.$id, false) // all notifs (read + unread)
        ]);

        // ── 1. Bell panel (tile) — login history + buddy notifications ─────────────────
        const notifList = document.getElementById('notif-list');
        if (notifList) {
            // Build login history items
            const loginItems = handled.map(req => {
                const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isApproved = req.status === 'approved';
                return {
                    ts: req.requestedAt,
                    html: `
                        <div class="flex items-start gap-4 bg-gray-50/50 rounded-[20px] p-3 border border-gray-100/60 shadow-sm transition-all hover:bg-white group cursor-default">
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

            // Build buddy notification items
            const buddyItems = buddyNotifs.map(notif => {
                const time = new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                let icon;
                if (notif.type === 'buddy_request') icon = 'fa-user-plus text-cubby-pink';
                else if (notif.type === 'buddy_added') icon = 'fa-user-check text-cubby-blue';
                else icon = 'fa-handshake text-cubby-green';
                const unreadDot = !notif.isRead ? '<span class="w-2 h-2 bg-cubby-blue rounded-full shrink-0"></span>' : '';
                return {
                    ts: notif.createdAt,
                    html: `
                        <div class="flex items-start gap-4 bg-gray-50/50 rounded-[20px] p-3 border border-gray-100/60 shadow-sm transition-all hover:bg-white cursor-pointer group"
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
                .sort((a, b) => new Date(b.ts) - new Date(a.ts))
                .slice(0, 20);

            notifList.innerHTML = allItems.length > 0
                ? allItems.map(i => i.html).join('')
                : '<div class="flex items-center justify-center py-10 text-gray-400 font-bold text-sm">No recent notifications.</div>';
        }

        // ── 2. Unread pending login requests (Inline tile) ──
        const unreadList = document.getElementById('unread-requests-list');

        if (!unreadList) return;

        if (pending.length === 0) {
            unreadList.innerHTML = '';
            return;
        }

        unreadList.innerHTML = pending.map(req => {
            const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="bg-[#FFF8DF] border border-[#FBEAC5] rounded-[24px] p-4 shadow-sm relative overflow-hidden group mb-4">
                    <div class="flex items-center gap-3 relative z-10">
                        <div class="w-10 h-10 rounded-[14px] bg-white border border-[#FBEAC5] flex items-center justify-center shrink-0 shadow-sm text-amber-500">
                            <i class="fa-solid fa-bell-ring animate-pulse text-sm"></i>
                        </div>
                        <div class="flex-1 min-w-0 mr-1">
                            <p class="font-extrabold text-[#1C1D21] text-[14px] leading-tight tracking-tight">${req.childUsername}</p>
                            <p class="text-[10px] font-bold text-amber-600/70 uppercase tracking-widest mt-1">Requested login at ${time}</p>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-4 relative z-10 pl-13">
                        <button onclick="inlineApprove('${req.$id}', this)" class="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-extrabold py-2.5 rounded-xl shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1">Approve</button>
                        <button onclick="inlineDeny('${req.$id}')" class="flex-1 bg-white hover:bg-gray-50 text-gray-700 border border-[#FBEAC5] text-[12px] font-extrabold py-2.5 rounded-xl shadow-sm transition-all focus:outline-none">Deny</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Mark a buddy notification as read (removes the blue dot)
    window.markNotifRead = async function (notifId, el) {
        await DataService.markNotificationRead(notifId);
        // Remove the blue dot from this item
        const dot = el?.querySelector('.bg-cubby-blue.rounded-full');
        if (dot) dot.remove();
        // Refresh badge count
        await checkLoginRequests();
    };

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

    // update Header Profile
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('sidebar-parent-avatar');
    const sidebarParentNameEl = document.getElementById('sidebar-parent-name');

    if (userNameEl) {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        userNameEl.textContent = fullName;
    }

    if (userAvatarEl && sidebarParentNameEl) {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        sidebarParentNameEl.textContent = `${user.firstName}'s`;
        userAvatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
    }

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

        const html = `
            <div onclick="selectChild('${child.$id}')" class="relative flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all group ${activeBg} border ${borderClass}">
                ${activeIndicator}
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(child.username || child.name)}"
                    class="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-sm ml-2 object-cover group-hover:border-purple-200 transition-colors">
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

    // Fetch all threats from the threat logs collection
    const allThreats = await DataService.getThreatLogs();

    // Fallback logic, threat logs might log the fromUsername instead of childId. If we can't find exact matches immediately, show a generic safety empty state
    // But realistically it binds to fromChildId
    const activeChild = window._currentChildren.find(c => c.$id === _selectedChildId);

    const childThreats = allThreats.filter(t => t.childId === _selectedChildId || t.fromChildId === _selectedChildId || (activeChild && t.fromUsername === activeChild.username));

    if (childThreats.length === 0) {
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
    childThreats.slice(0, 10).forEach(threat => {
        const timeStr = timeAgo(threat.$createdAt);
        const excerpt = threat.messagePreview ? `"${threat.messagePreview}"` : "Inappropriate content detected in chat log.";
        const resolved = threat.status === 'resolved';

        const html = `
            <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative overflow-hidden group hover:border-[#FF456A]/50 transition-colors">
                <div class="absolute left-0 top-0 bottom-0 w-1.5 ${resolved ? 'bg-green-400' : 'bg-red-400'}"></div>
                <div class="flex items-start justify-between mb-1.5 ml-2">
                    <h4 class="text-[13px] font-bold text-[#1C1D21]">Chat Moderation Alert</h4>
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded ml-2 whitespace-nowrap">${timeStr}</span>
                </div>
                <p class="text-[11px] text-gray-500 font-medium italic mb-3 line-clamp-2 ml-2 leading-relaxed bg-gray-50 p-2 rounded-lg">${excerpt}</p>
                
                <div class="flex justify-between items-center ml-2 border-t border-gray-50 pt-2">
                    <span class="text-[9px] font-bold px-2 py-1 rounded-md ${resolved ? 'bg-green-50 text-green-600' : 'bg-[#FFF1F2] text-[#FF456A]'} uppercase tracking-wider">
                        ${threat.status || 'pending'}
                    </span>
                    ${!resolved ? `<button class="text-[11px] font-bold text-white bg-red-400 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors shadow-sm focus:outline-none">Review Action</button>` : ''}
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

function changeTimeMode(mode) {
    currentScreenTimeMode = mode;

    let totalMinutes = 0;
    const children = window._currentChildren || [];
    const activeChild = children.find(c => c.$id === _selectedChildId);

    let gameMins = 0, entMins = 0, comMins = 0;
    const now = new Date();

    if (activeChild && activeChild.screenTimeLogs) {
        let logs;
        if (typeof activeChild.screenTimeLogs === 'string') {
            try { logs = JSON.parse(activeChild.screenTimeLogs); } catch (e) { logs = []; }
        } else if (Array.isArray(activeChild.screenTimeLogs)) {
            logs = activeChild.screenTimeLogs;
        } else {
            logs = [];
        }

        logs.forEach(log => {
            const logDate = new Date(log.date);
            let include = false;
            if (mode === 'daily') {
                if (logDate.toDateString() === now.toDateString()) include = true;
            } else if (mode === 'weekly') {
                const diff = Math.abs(now - logDate) / (1000 * 60 * 60 * 24);
                if (diff <= 7) include = true;
            } else if (mode === 'monthly') {
                if (logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear()) include = true;
            }
            if (include) {
                totalMinutes += log.minutes;
                // Distribute pseudo-randomly to create chart
                const r = (log.minutes * 17) % 100;
                if (r < 50) gameMins += log.minutes;
                else if (r < 80) entMins += log.minutes;
                else comMins += log.minutes;
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

    renderChart(gameMins, entMins, comMins, mode, totalMinutes);
}

function renderChart(totalGame, totalEnt, totalCom, mode, totalTime) {
    const chartEl = document.getElementById('screen-time-chart');
    if (!chartEl) return;

    const bgHTML = '<div class="absolute inset-x-0 inset-y-6 flex flex-col justify-between -z-10 pointer-events-none border-b border-gray-200"><div class="w-full border-t border-gray-200 border-dashed"></div><div class="w-full border-t border-gray-200 border-dashed"></div><div class="w-full border-t border-gray-200 border-dashed"></div></div>';

    if (totalTime === 0) {
        chartEl.innerHTML = bgHTML + '<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-[13px] font-bold">No screen time data logged</div>';
        return;
    }

    const labels = ["6AM", "9AM", "12PM", "3PM", "6PM", "9PM"];
    let barsHTML = bgHTML;

    // Distribution weights
    const distData = [15, 25, 45, 10, 5, 0];
    const sumDist = 100;

    for (let i = 0; i < 6; i++) {
        const weight = distData[i] / sumDist;
        const g = totalGame * weight;
        const e = totalEnt * weight;
        const c = totalCom * weight;

        const barTotal = g + e + c;
        const maxScale = Math.max(30, totalTime * 0.5); // Provide a visual ceiling
        const pctHeight = Math.min(100, Math.max(2, (barTotal / maxScale) * 100)); // Map to 100% height

        const pctG = barTotal > 0 ? (g / barTotal) * 100 : 0;
        const pctE = barTotal > 0 ? (e / barTotal) * 100 : 0;
        const pctC = barTotal > 0 ? (c / barTotal) * 100 : 0;

        barsHTML += `
            <div class="flex flex-col items-center justify-end h-full w-full mx-1 lg:mx-2 xl:mx-auto group relative pb-6 pt-10">
                <div class="absolute -top-1 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-md">
                    ${Math.round(barTotal)} mins
                </div>
                
                <!-- Expanded hover hit area -->
                <div class="absolute inset-x-0 bottom-6 top-10 cursor-pointer"></div>

                <div class="w-[clamp(20px,6vw,40px)] bg-gray-50 group-hover:bg-gray-100 transition-colors rounded-full flex flex-col justify-end overflow-hidden mb-2 z-10" style="height: ${barTotal > 0 ? pctHeight : 0}%">
                    ${pctC > 0 ? `<div class="w-full bg-[#FF456A] transition-all duration-700 hover:brightness-110 border-b border-white/20" style="height: ${pctC}%"></div>` : ''}
                    ${pctE > 0 ? `<div class="w-full bg-[#A2DE4E] transition-all duration-700 hover:brightness-110 border-b border-white/20" style="height: ${pctE}%"></div>` : ''}
                    ${pctG > 0 ? `<div class="w-full bg-[#5C45FD] transition-all duration-700 hover:brightness-110" style="height: ${pctG}%"></div>` : ''}
                </div>
                
                <span class="absolute bottom-0 text-[10px] xl:text-xs font-bold text-gray-400 tracking-tight">${labels[i]}</span>
            </div>
        `;
    }

    chartEl.innerHTML = barsHTML;
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