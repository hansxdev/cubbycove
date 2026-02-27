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

    // --- Global Parent Logout ---
    window.handleParentLogout = async function () {
        stopNotifPolling();
        try {
            await DataService.logout();
        } catch (e) {
            console.warn("Logout error:", e);
        }
        window.location.replace('../login.html');
    };

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

        // ── 1. Bell badge — pending logins + unread buddy notifications ─────────
        const unreadBuddyCount = buddyNotifs.filter(n => !n.isRead).length;
        const totalBadge = pending.length + unreadBuddyCount;
        const badge = document.getElementById('notif-badge');
        if (badge) {
            if (totalBadge > 0) {
                badge.textContent = totalBadge;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // ── 2. Bell panel — login history + buddy notifications ─────────────────
        const notifList = document.getElementById('notif-list');
        if (notifList) {
            // Build login history items
            const loginItems = handled.map(req => {
                const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const isApproved = req.status === 'approved';
                return {
                    ts: req.requestedAt,
                    html: `
                        <div class="flex items-center gap-3 px-5 py-3">
                            <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-child-reaching text-sm"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-gray-700 text-sm truncate">${req.childUsername} — Login ${isApproved ? '✅' : '❌'}</p>
                                <p class="text-xs text-gray-400">${time}</p>
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
                        <div class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                             onclick="markNotifRead('${notif.$id}', this)">
                            <div class="w-9 h-9 bg-gray-50 rounded-full flex items-center justify-center shrink-0 border border-gray-100">
                                <i class="fa-solid ${icon} text-sm"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-gray-700 text-sm leading-snug">${notif.message}</p>
                                <p class="text-xs text-gray-400">${time}</p>
                            </div>
                            ${unreadDot}
                        </div>`
                };
            });

            const allItems = [...loginItems, ...buddyItems]
                .sort((a, b) => new Date(b.ts) - new Date(a.ts))
                .slice(0, 20);

            notifList.innerHTML = allItems.length > 0
                ? allItems.map(i => i.html).join('')
                : '<p class="text-sm text-gray-400 text-center py-8">No recent activity.</p>';
        }

        // ── 3. Unread section — pending login requests with inline approve/deny ──
        const section = document.getElementById('unread-requests-section');
        const unreadList = document.getElementById('unread-requests-list');
        const unreadCountBadge = document.getElementById('unread-count-badge');

        if (!section || !unreadList) return;

        if (pending.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        if (unreadCountBadge) unreadCountBadge.textContent = `${pending.length} new`;

        unreadList.innerHTML = pending.map(req => {
            const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const device = (req.deviceInfo || 'Unknown Device').slice(0, 60);
            return `
                <div class="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl p-4 gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.childUsername)}"
                            class="w-10 h-10 rounded-full bg-white border border-orange-200 shrink-0">
                        <div class="min-w-0">
                            <p class="font-bold text-gray-800 text-sm">${req.childUsername}</p>
                            <p class="text-xs text-gray-400">${time} · ${device}</p>
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="inlineDeny('${req.$id}')"
                            class="px-3 py-1.5 text-xs font-bold border-2 border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-all">
                            Deny
                        </button>
                        <button onclick="inlineApprove('${req.$id}', this)"
                            class="px-3 py-1.5 text-xs font-bold bg-cubby-blue text-white rounded-lg hover:bg-blue-500 transition-all shadow-sm">
                            Approve
                        </button>
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

// ── Tab Switching ─────────────────────────────────────────────────────────────
function showTab(tabName) {
    const titles = { overview: 'Dashboard Overview', kids: 'My Kids', activity: 'Activity Log', settings: 'Settings' };
    const titleEl = document.getElementById('page-title');
    if (titleEl && titles[tabName]) titleEl.textContent = titles[tabName];

    document.querySelectorAll('main > div[id^="tab-"]').forEach(div => div.classList.add('hidden'));
    document.querySelectorAll('nav a.nav-item').forEach(a => {
        a.classList.remove('bg-cubby-purple', 'text-white', 'shadow-md', 'shadow-purple-200', 'scale-105');
        a.classList.add('text-gray-600', 'hover:bg-gray-50', 'hover:shadow-sm');
    });

    const targetDiv = document.getElementById('tab-' + tabName);
    const targetNav = document.getElementById('nav-' + tabName);
    if (targetDiv) targetDiv.classList.remove('hidden');
    if (targetNav) {
        targetNav.classList.add('bg-cubby-purple', 'text-white', 'shadow-md', 'shadow-purple-200', 'scale-105');
        targetNav.classList.remove('text-gray-600', 'hover:bg-gray-50', 'hover:shadow-sm');
    }
}

// ── Sidebar Toggle ────────────────────────────────────────────────────────────
let _sidebarCollapsed = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn = document.getElementById('sidebar-toggle-btn');
    if (!sidebar) return;

    _sidebarCollapsed = !_sidebarCollapsed;

    if (_sidebarCollapsed) {
        sidebar.classList.replace('w-64', 'w-16');
        sidebar.querySelectorAll('.nav-label').forEach(el => el.classList.add('hidden'));
        sidebar.querySelectorAll('.nav-item, div.p-4 button').forEach(el => {
            el.classList.remove('gap-3', 'px-4');
            el.classList.add('justify-center', 'px-0');
        });
        if (btn) btn.querySelector('i').className = 'fa-solid fa-chevron-right text-xl';
    } else {
        sidebar.classList.replace('w-16', 'w-64');
        sidebar.querySelectorAll('.nav-label').forEach(el => el.classList.remove('hidden'));
        sidebar.querySelectorAll('.nav-item, div.p-4 button').forEach(el => {
            el.classList.add('gap-3', 'px-4');
            el.classList.remove('justify-center', 'px-0');
        });
        if (btn) btn.querySelector('i').className = 'fa-solid fa-bars text-xl';
    }
}

// ── Notification Panel & Approval Modal ──────────────────────────────────────
// All declared at top level so onclick attrs work before DOMContentLoaded fires.

let _currentRequestId = null; // shared by modal functions

function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.toggle('hidden');
}

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
    if (!user) return; // Should likely redirect to login

    // update Header Profile
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    if (userNameEl) {
        const fullName = [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
        userNameEl.textContent = fullName;
        if (userAvatarEl) userAvatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
    }

    // --- 1. Render Stats & Kids ---
    await renderKidsAndStats(user);

    // --- 2. Render Activity ---
    renderActivityLogs(user);

    // --- 3. Initial Screen Time Mode ---
    changeTimeMode('daily'); // Default
}

async function renderKidsAndStats(user) {
    const kidsListEl = document.getElementById('kids-list-container');
    const activeStatEl = document.getElementById('stat-active-profiles');
    const riskStatEl = document.getElementById('stat-risk-detected');

    // Query children from the database by parentId
    const children = await DataService.getChildrenByParent(user.$id);

    if (!children || children.length === 0) {
        // KEEP EMPTY STATE (Already in HTML)
        if (activeStatEl) activeStatEl.innerText = "0";
        if (riskStatEl) riskStatEl.innerText = "Safe";
        return;
    }

    // Clear Empty State
    if (kidsListEl) kidsListEl.innerHTML = '';

    let activeCount = 0;
    let totalThreats = 0;

    children.forEach(child => {
        // Count Stats
        if (child.isOnline) activeCount++;
        if (child.threatScore) totalThreats += child.threatScore;

        // Render Card
        const statusColor = child.isOnline ? 'bg-green-500' : 'bg-gray-400';
        const statusText = child.isOnline ? 'Online' : 'Offline';
        const borderClass = child.isOnline ? 'border-cubby-green' : 'border-gray-100';

        const html = `
            <div class="flex items-center p-4 bg-gray-50 rounded-xl border ${borderClass} hover:border-cubby-purple transition-colors cursor-pointer group">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(child.username || child.name)}"
                    class="w-12 h-12 rounded-full bg-white border-2 border-white shadow-sm mr-4">
                <div class="flex-1">
                    <h4 class="font-bold text-gray-800 group-hover:text-cubby-purple transition-colors">${child.name}</h4>
                    <p class="text-xs text-gray-500">${child.isOnline ? 'Active Now' : 'Last active: Today'}</p>
                </div>
                <div class="text-right">
                    <span class="block text-xs font-bold text-gray-400 mb-1">Status</span>
                    <span class="inline-block w-2 h-2 ${statusColor} rounded-full" title="${statusText}"></span>
                </div>
            </div>
        `;
        if (kidsListEl) kidsListEl.insertAdjacentHTML('beforeend', html);
    });

    // Update Top Stats
    if (activeStatEl) activeStatEl.innerText = activeCount;
    if (riskStatEl) {
        riskStatEl.innerText = totalThreats > 0 ? `${totalThreats} Alerts` : "Safe";
        if (totalThreats > 0) riskStatEl.classList.add('text-red-500');
    }
}

function renderActivityLogs(user) {
    const listEl = document.getElementById('activity-list');
    if (!listEl || !user.activityLogs || user.activityLogs.length === 0) return;

    listEl.innerHTML = '<div class="absolute left-2.5 top-2 bottom-4 w-0.5 bg-gray-100"></div>'; // Reset with line

    user.activityLogs.forEach(log => {
        const html = `
            <div class="flex gap-4 relative">
                <div class="w-5 h-5 rounded-full bg-cubby-blue/20 border-4 border-white z-10 flex-shrink-0"></div>
                <div>
                    <p class="text-sm text-gray-800 font-semibold">${log.action}</p>
                    <p class="text-xs text-gray-400">${log.childName} • ${timeAgo(log.timestamp)}</p>
                    ${log.link ? `<a href="${log.link}" class="text-xs text-cubby-purple font-bold hover:underline">View Content</a>` : ''}
                </div>
            </div>
        `;
        listEl.insertAdjacentHTML('beforeend', html);
    });
}

function changeTimeMode(mode) {
    currentScreenTimeMode = mode;

    // Update Button Styles
    const buttons = document.querySelectorAll('button[onclick^="changeTimeMode"]');
    buttons.forEach(btn => {
        if (btn.innerText.toLowerCase().includes(mode)) {
            btn.classList.add('bg-white', 'shadow-sm', 'text-cubby-blue');
            btn.classList.remove('text-gray-500', 'hover:bg-gray-200');
        } else {
            btn.classList.remove('bg-white', 'shadow-sm', 'text-cubby-blue');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        }
    });

    // Calculate Screen Time based on Mode (Mock Logic)
    let timeText = "0m";
    if (mode === 'daily') timeText = "45m";
    if (mode === 'weekly') timeText = "5h 12m";
    if (mode === 'monthly') timeText = "22h";

    const statEl = document.getElementById('stat-screen-time');
    if (statEl) statEl.innerText = timeText;
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