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
        window.location.href = '../index.html';
    };

    // --- Start notification polling when on the dashboard ---
    if (dashboardMain) {
        startNotifPolling();
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

        const [pending, handled] = await Promise.all([
            DataService.getPendingLoginRequests(user.email),
            DataService.getHandledLoginRequests(user.email)
        ]);

        // ── 1. Bell badge — count of pending (unread) ──────────────────────────
        const badge = document.getElementById('notif-badge');
        if (badge) {
            if (pending.length > 0) {
                badge.textContent = pending.length;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // ── 2. Bell panel — shows handled (history) ────────────────────────────
        const notifList = document.getElementById('notif-list');
        if (notifList) {
            if (handled.length === 0) {
                notifList.innerHTML = '<p class="text-sm text-gray-400 text-center py-8">No recent activity.</p>';
            } else {
                notifList.innerHTML = handled.map(req => {
                    const time = new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isApproved = req.status === 'approved';
                    const statusIcon = isApproved
                        ? '<i class="fa-solid fa-circle-check text-green-500 text-xs"></i>'
                        : '<i class="fa-solid fa-circle-xmark text-red-400 text-xs"></i>';
                    const statusLabel = isApproved ? 'Approved' : 'Denied';
                    return `
                        <div class="flex items-center gap-3 px-5 py-3">
                            <div class="w-9 h-9 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-child-reaching text-sm"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-gray-700 text-sm truncate">${req.childUsername}</p>
                                <p class="text-xs text-gray-400">${time}</p>
                            </div>
                            <span class="flex items-center gap-1 text-xs font-bold ${isApproved ? 'text-green-600' : 'text-red-400'}">
                                ${statusIcon} ${statusLabel}
                            </span>
                        </div>
                    `;
                }).join('');
            }
        }

        // ── 3. Unread section — shows pending with inline approve/deny ──────────
        const section = document.getElementById('unread-requests-section');
        const unreadList = document.getElementById('unread-requests-list');
        const unreadBadge = document.getElementById('unread-count-badge');

        if (!section || !unreadList) return;

        if (pending.length === 0) {
            section.classList.add('hidden');
            return;
        }

        section.classList.remove('hidden');
        if (unreadBadge) unreadBadge.textContent = `${pending.length} new`;

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

    window.toggleNotifPanel = function () {
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.toggle('hidden');
    };

    window.openApprovalModal = function (requestId, childUsername, time, deviceInfo) {
        _currentRequestId = requestId;
        document.getElementById('modal-child-username').textContent = childUsername;
        document.getElementById('modal-requested-at').textContent = time;
        document.getElementById('modal-device').textContent = deviceInfo || 'Unknown Device';

        const modal = document.getElementById('approval-modal');
        if (modal) modal.classList.remove('hidden');

        // Close the notif panel
        const panel = document.getElementById('notif-panel');
        if (panel) panel.classList.add('hidden');
    };

    window.closeApprovalModal = function () {
        const modal = document.getElementById('approval-modal');
        if (modal) modal.classList.add('hidden');
        _currentRequestId = null;
    };

    window.handleApproveRequest = async function () {
        if (!_currentRequestId) return;
        const approveBtn = document.getElementById('approve-btn');
        const denyBtn = document.getElementById('deny-btn');
        if (approveBtn) { approveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Approving...'; approveBtn.disabled = true; }
        if (denyBtn) { denyBtn.disabled = true; }

        try {
            const child = await DataService.approveLoginRequest(_currentRequestId);
            window.closeApprovalModal();
            await checkLoginRequests(); // refresh badge
            alert(`✅ ${child.name}'s login has been approved!`);
        } catch (err) {
            alert('Error approving: ' + err.message);
            if (approveBtn) { approveBtn.innerHTML = '<i class="fa-solid fa-check mr-1"></i> Approve'; approveBtn.disabled = false; }
            if (denyBtn) { denyBtn.disabled = false; }
        }
    };

    window.handleDenyRequest = async function () {
        if (!_currentRequestId) return;
        try {
            await DataService.denyLoginRequest(_currentRequestId);
            window.closeApprovalModal();
            await checkLoginRequests();
            alert('Login request denied.');
        } catch (err) {
            alert('Error denying: ' + err.message);
        }
    };

    // Inline approve/deny used by the unread section cards
    window.inlineApprove = async function (requestId, btn) {
        if (btn) { btn.textContent = '...'; btn.disabled = true; }
        try {
            const child = await DataService.approveLoginRequest(requestId);
            await checkLoginRequests();
            alert(`✅ ${child.name}'s login has been approved!`);
        } catch (err) {
            alert('Error approving: ' + err.message);
            if (btn) { btn.textContent = 'Approve'; btn.disabled = false; }
        }
    };

    window.inlineDeny = async function (requestId) {
        try {
            await DataService.denyLoginRequest(requestId);
            await checkLoginRequests();
        } catch (err) {
            alert('Error denying: ' + err.message);
        }
    };

    // 3. Tab Switching
    window.showTab = function (tabName) {
        document.querySelectorAll('main > div[id^="tab-"]').forEach(div => div.classList.add('hidden'));
        document.querySelectorAll('nav a.nav-item').forEach(a => {
            a.classList.remove('bg-cubby-purple', 'text-white', 'shadow-md', 'shadow-purple-200', 'scale-105');
            a.classList.add('text-gray-600', 'hover:bg-gray-50', 'hover:shadow-sm');
        });

        const targetDiv = document.getElementById(`tab-${tabName}`);
        const targetNav = document.getElementById(`nav-${tabName}`);

        if (targetDiv) targetDiv.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('bg-cubby-purple', 'text-white', 'shadow-md', 'shadow-purple-200', 'scale-105');
            targetNav.classList.remove('text-gray-600', 'hover:bg-gray-50', 'hover:shadow-sm');
        }
    };

    // 4. Sidebar Toggle
    let _sidebarCollapsed = false;

    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const btn = document.getElementById('sidebar-toggle-btn');
        if (!sidebar) return;

        _sidebarCollapsed = !_sidebarCollapsed;

        if (_sidebarCollapsed) {
            // Collapse to icon-only rail (w-16)
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-16');

            // Hide text labels inside nav links
            sidebar.querySelectorAll('nav a span, nav a').forEach(el => {
                if (el.tagName === 'A') {
                    el.classList.remove('gap-3', 'px-4');
                    el.classList.add('justify-center', 'px-0');
                }
            });
            sidebar.querySelectorAll('nav a > :not(i)').forEach(el => el.classList.add('hidden'));

            // Hide logo text
            const logoText = sidebar.querySelector('span.text-xl');
            if (logoText) logoText.classList.add('hidden');

            // Hide logout text
            const logoutText = sidebar.querySelector('button > :not(i)');
            if (logoutText) logoutText.classList.add('hidden');
            const logoutBtn = sidebar.querySelector('div.p-4 button');
            if (logoutBtn) {
                logoutBtn.classList.remove('gap-3');
                logoutBtn.classList.add('justify-center');
            }

            // Swap icon
            if (btn) btn.querySelector('i').className = 'fa-solid fa-chevron-right text-xl';

        } else {
            // Expand back to full width
            sidebar.classList.add('w-64');
            sidebar.classList.remove('w-16');

            sidebar.querySelectorAll('nav a').forEach(el => {
                el.classList.add('gap-3', 'px-4');
                el.classList.remove('justify-center', 'px-0');
            });
            sidebar.querySelectorAll('nav a > :not(i)').forEach(el => el.classList.remove('hidden'));

            const logoText = sidebar.querySelector('span.text-xl');
            if (logoText) logoText.classList.remove('hidden');

            const logoutText = sidebar.querySelector('div.p-4 button > :not(i)');
            if (logoutText) logoutText.classList.remove('hidden');
            const logoutBtn = sidebar.querySelector('div.p-4 button');
            if (logoutBtn) {
                logoutBtn.classList.add('gap-3');
                logoutBtn.classList.remove('justify-center');
            }

            // Restore icon
            if (btn) btn.querySelector('i').className = 'fa-solid fa-bars text-xl';
        }
    };
});

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