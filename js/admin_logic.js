// Logic for staff/admin_dashboard.html

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
    setupEventListeners();
    setupKeyboardShortcuts();
});

async function initAdminDashboard() {
    try {
        // 1. Check Auth (Async)
        currentUser = await DataService.getCurrentUser();

        // BACK BUTTON GUARD
        window.history.pushState(null, "", window.location.href);
        window.onpopstate = function () {
            window.history.pushState(null, "", window.location.href);
        };

        window.handleLogout = async function () {
            await DataService.logout();
            window.location.href = '../staff_access.html';
        };

        // Redirect if not logged in or not staff
        if (!currentUser || !['admin', 'super_admin', 'assistant', 'creator'].includes(currentUser.role)) {
            window.location.href = '../staff_access.html'; // Better redirect to staff login
            return;
        }

        // 2. Setup Header
        const nameEl = document.getElementById('header-name');
        const roleEl = document.getElementById('header-role');
        const avatarEl = document.getElementById('header-avatar');

        if (nameEl) nameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        if (roleEl) roleEl.textContent = currentUser.role.replace('_', ' ');
        if (avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${currentUser.firstName}+${currentUser.lastName}&background=random`;

        // 3. Show Super Admin Features
        if (currentUser.role === 'super_admin') {
            const staffMenu = document.getElementById('menu-staff');
            const viewsMenu = document.getElementById('super-admin-views');

            if (staffMenu) staffMenu.classList.remove('hidden');
            if (viewsMenu) viewsMenu.classList.remove('hidden');
        }

        // 4. Load Initial Data
        await Promise.all([
            loadStats(),
            loadUserList(),
        ]);

        if (currentUser.role === 'super_admin') {
            await loadStaffList();
        }

    } catch (error) {
        console.error("Dashboard Init Error:", error);
        // window.location.href = '../staff_access.html';
    }
}

async function loadStats() {
    try {
        const users = await DataService.getAllUsers();
        const videos = await DataService.getVideos();

        // Calculate Stats
        const totalParents = users.filter(u => u.role === 'parent').length;
        // const totalKids = users.reduce((acc, u) => acc + (u.children ? u.children.length : 0), 0); // Rough estimate if children field exists
        const totalKids = 0; // Placeholder until children collection integration

        const totalApprovedVideos = videos.filter(v => v.status === 'approved').length;

        // Update UI
        const elParents = document.getElementById('stat-parents');
        const elKids = document.getElementById('stat-kids');
        const elContent = document.getElementById('stat-videos');

        if (elParents) elParents.innerText = totalParents.toLocaleString();
        if (elKids) elKids.innerText = totalKids > 0 ? totalKids : "-";
        if (elContent) elContent.innerText = totalApprovedVideos.toLocaleString();

    } catch (error) {
        console.error("Stats Error:", error);
    }
}

async function loadUserList() {
    const listBody = document.getElementById('user-list-body');
    if (!listBody) return;

    listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center"><i class="fa-solid fa-spinner fa-spin text-cubby-blue"></i> Loading users...</td></tr>';

    try {
        const users = await DataService.getAllUsers();
        // Filter regular users (parents/kids/banned) - exclude staff from this generic list usually, but let's show all non-staff
        // Or show all. Let's show parents and any other non-staff roles.
        const generalUsers = users.filter(u => !['admin', 'super_admin', 'assistant', 'creator'].includes(u.role));

        listBody.innerHTML = '';

        if (generalUsers.length === 0) {
            listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No users found.</td></tr>';
            return;
        }

        generalUsers.forEach(u => {
            let roleBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">${u.role}</span>`;
            if (u.role === 'parent') roleBadge = `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-bold">Parent</span>`;

            let statusClass = 'text-green-500';
            if (u.status === 'banned' || u.status === 'suspended') statusClass = 'text-red-500';
            else if (u.status === 'pending') statusClass = 'text-yellow-500';

            const html = `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-2 font-semibold">${u.firstName} ${u.lastName || ''}</td>
                    <td class="p-2">${roleBadge}</td>
                    <td class="p-2"><span class="${statusClass} font-bold text-xs capitalize">${u.status}</span></td>
                    <td class="p-2 text-right">
                        ${u.status !== 'banned' ?
                    `<button onclick="updateUserStatus('${u.$id}', 'banned')" class="text-red-400 hover:text-red-600 p-1" title="Ban User"><i class="fa-solid fa-ban"></i></button>` :
                    `<button onclick="updateUserStatus('${u.$id}', 'active')" class="text-green-400 hover:text-green-600 p-1" title="Unban"><i class="fa-solid fa-rotate-left"></i></button>`
                }
                    </td>
                </tr>
            `;
            listBody.insertAdjacentHTML('beforeend', html);
        });

    } catch (error) {
        console.error("Load User List Error:", error);
        listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading users.</td></tr>';
    }
}

async function updateUserStatus(userId, status) {
    if (confirm(`Change user status to ${status}?`)) {
        try {
            await DataService.updateUserStatus(userId, status);
            loadUserList(); // Refresh list
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
}

// --- VIEW NAVIGATION ---

function switchView(tabName) {
    if (tabName === 'staff' && (!currentUser || currentUser.role !== 'super_admin')) {
        alert("Access Denied: Super Admin only.");
        return;
    }

    // Hide all tabs
    document.querySelectorAll('main > div[id^="tab-"]').forEach(div => div.classList.add('hidden'));

    // Reset all nav
    document.querySelectorAll('nav a.nav-item').forEach(a => {
        a.classList.remove('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
        a.classList.add('text-gray-400', 'hover:bg-gray-800', 'hover:text-white', 'border-transparent', 'border-l-4');
    });

    // Show target tab
    const targetDiv = document.getElementById(`tab-${tabName}`);
    const targetNav = document.getElementById(`nav-${tabName}`);

    if (targetDiv) targetDiv.classList.remove('hidden');
    if (targetNav) {
        targetNav.classList.add('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
        targetNav.classList.remove('text-gray-400', 'hover:bg-gray-800', 'hover:text-white', 'border-transparent');
    }

    // Refresh data if needed
    if (tabName === 'staff') loadStaffList();
    if (tabName === 'users') loadUserList();
}

function switchDashboardMode(mode) {
    // Basic role check
    if (['super_admin', 'admin'].includes(currentUser.role)) {
        // Allowed to switch
    } else if (currentUser.role !== mode) {
        alert("Restricted access.");
        return;
    }

    if (mode === 'assistant') window.location.href = 'assistant_panel.html';
    if (mode === 'creator') window.location.href = '../creator/creator.html';
    if (mode === 'admin') location.reload();
}

// --- STAFF MANAGEMENT ---

async function loadStaffList() {
    const listBody = document.getElementById('staff-list-body');
    if (!listBody) return;

    try {
        const users = await DataService.getAllUsers();
        // Filter for staff
        const staff = users.filter(u => ['admin', 'assistant', 'creator', 'super_admin'].includes(u.role));

        listBody.innerHTML = '';

        staff.forEach(s => {
            const isMe = s.email === currentUser.email;
            let statusClass = 'text-green-500';
            if (s.status === 'banned') statusClass = 'text-red-500';

            const html = `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="p-2 font-semibold">
                        ${s.firstName} ${s.lastName} 
                        ${isMe ? '<span class="text-xs text-blue-500">(You)</span>' : ''}
                    </td>
                    <td class="p-2"><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase">${s.role}</span></td>
                    <td class="p-2 text-gray-500">${s.email}</td>
                    <td class="p-2"><span class="${statusClass} font-bold text-xs capitalize">${s.status}</span></td>
                </tr>
            `;
            listBody.insertAdjacentHTML('beforeend', html);
        });
    } catch (e) {
        console.error("Load Staff Error:", e);
        // listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading staff list.</td></tr>';
    }
}

async function handleCreateStaff(e) {
    e.preventDefault();

    // 1. Rate Limiting (Throttle)
    const rateCheck = SecurityUtils.checkRateLimit('staff_create', 15);
    if (!rateCheck.allowed) {
        alert(`You are creating staff too quickly. Please wait ${rateCheck.waitTime} seconds.`);
        return;
    }

    const fname = document.getElementById('staffFname').value;
    const lname = document.getElementById('staffLname').value;
    const email = document.getElementById('staffEmail').value;
    const pass = document.getElementById('staffPass').value;
    const role = document.getElementById('staffRole').value;

    // 2. Validate Password
    const passCheck = SecurityUtils.validatePassword(pass);
    if (!passCheck.isValid) {
        alert(passCheck.error); // Show strict complexity errors
        return;
    }

    const btn = document.querySelector('#createStaffForm button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;

    try {
        await DataService.createStaffAccount(currentUser.email, {
            firstName: fname,
            lastName: lname,
            email: email,
            password: pass,
            role: role
        });

        // Record Action on Success
        SecurityUtils.recordAction('staff_create');

        alert(`New ${role} created: ${email}`);
        document.getElementById('createStaffForm').reset();
        await loadStaffList();

    } catch (error) {
        alert("Error: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


async function handleAddVideo(e) {
    e.preventDefault();
    const idInput = document.getElementById('videoId').value;
    const title = document.getElementById('videoTitle').value;
    const category = document.querySelector('#addVideoForm select').value;

    if (!idInput || !title) {
        alert("Please fill in all fields");
        return;
    }

    // Parser (simple)
    let finalId = idInput;
    if (idInput.includes('v=')) finalId = idInput.split('v=')[1].split('&')[0];
    else if (idInput.includes('youtu.be/')) finalId = idInput.split('youtu.be/')[1];

    // Normalizing to full URL is best so parsers can rely on standard formats
    const finalUrl = `https://www.youtube.com/watch?v=${finalId}`;

    try {
        await DataService.addVideo({
            title: title,
            url: finalUrl,
            category: category,
            creatorEmail: currentUser.email // Admin as creator
        });
        alert("Video added!");
        document.getElementById('addVideoForm').reset();
        await loadStats(); // Refresh stats
    } catch (e) {
        alert("Error: " + e.message);
    }
}


// --- EVENT LISTENERS ---

function setupEventListeners() {
    const staffForm = document.getElementById('createStaffForm');
    if (staffForm) staffForm.addEventListener('submit', handleCreateStaff);
    const videoForm = document.getElementById('addVideoForm');
    if (videoForm) videoForm.addEventListener('submit', handleAddVideo);

    // Make global for onclick handlers
    window.switchView = switchView;
    window.switchDashboardMode = switchDashboardMode;
    window.updateUserStatus = updateUserStatus; // Expose for user table
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (currentUser && currentUser.role === 'super_admin') {
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                switchView('staff');
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                switchView('dashboard');
            }
        }
    });
}