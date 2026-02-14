// Logic for staff/admin_dashboard.html

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
    setupEventListeners();
    setupKeyboardShortcuts();
});

function initAdminDashboard() {
    // 1. Check Auth
    currentUser = DataService.getCurrentUser();

    // BACK BUTTON GUARD
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = function () {
        window.history.pushState(null, "", window.location.href);
    };

    window.handleLogout = function () {
        DataService.logout();
        window.location.href = '../staff_access.html';
    };

    // Redirect if not logged in or not staff
    if (!currentUser || !['admin', 'super_admin', 'assistant'].includes(currentUser.role)) {
        window.location.href = '../login.html';
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
    loadStats();
    if (currentUser.role === 'super_admin') {
        loadStaffList();
    }
}

function loadStats() {
    const users = DataService.getAllUsers();

    // Calculate Stats
    const totalParents = users.filter(u => u.role === 'parent').length;
    let totalKids = 0;
    users.filter(u => u.role === 'parent').forEach(p => {
        if (p.children) totalKids += p.children.length;
    });

    // Update UI
    const elParents = document.getElementById('stat-parents');
    const elKids = document.getElementById('stat-kids');
    const elContent = document.getElementById('stat-videos');

    if (elParents) elParents.innerText = totalParents.toLocaleString();
    if (elKids) elKids.innerText = totalKids.toLocaleString();
    if (elContent) elContent.innerText = "850"; // Mock for now
}

// --- VIEW NAVIGATION ---

function switchView(viewName) {
    // Hide all sections first (if we had more)
    // For now assuming we just toggle visibility of main dashboard vs staff section
    // Actually, the structure in HTML has `staff-section` separate from the main dashboard grid?
    // Let's look at HTML structure... 
    // The "Dashboard Content" is inside `main`. 
    // The stats cards + split view are direct children of `main`.
    // The staff section is also a direct child of `main`.

    const statsRow = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-4');
    const splitViewRow = document.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
    const staffSection = document.getElementById('staff-section');

    if (viewName === 'dashboard') {
        if (statsRow) statsRow.classList.remove('hidden');
        if (splitViewRow) splitViewRow.classList.remove('hidden');
        if (staffSection) staffSection.classList.add('hidden');

        setActiveNavLink('Dashboard');
    } else if (viewName === 'staff') {
        if (currentUser.role !== 'super_admin') {
            alert("Access Denied: Super Admin only.");
            return;
        }
        if (statsRow) statsRow.classList.add('hidden');
        if (splitViewRow) splitViewRow.classList.add('hidden');
        if (staffSection) staffSection.classList.remove('hidden');

        setActiveNavLink('Manage Staff');
    }
}

function setActiveNavLink(text) {
    const links = document.querySelectorAll('nav a');
    links.forEach(link => {
        if (link.innerText.includes(text)) {
            link.classList.add('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
            link.classList.remove('text-gray-400', 'hover:bg-gray-800');
        } else {
            if (!link.classList.contains('text-sm')) { // Skip "Views" links
                link.classList.remove('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
                link.classList.add('text-gray-400', 'hover:bg-gray-800');
            }
        }
    });
}

function switchDashboardMode(mode) {
    if (currentUser.role !== 'super_admin') {
        // Only allow viewing if super admin, OR if user IS that role
        if (currentUser.role !== mode && currentUser.role !== 'admin') { // Admin can view assistant? Maybe.
            alert("Restricted: Switch to Power User account to access all views.");
            return;
        }
    }

    if (mode === 'assistant') window.location.href = 'assistant_panel.html';
    if (mode === 'creator') window.location.href = '../creator/creator.html';
    if (mode === 'admin') location.reload(); // We are already here
}

// --- STAFF MANAGEMENT ---

function loadStaffList() {
    const listBody = document.getElementById('staff-list-body');
    if (!listBody) return;

    const users = DataService.getAllUsers();
    const staff = users.filter(u => ['admin', 'assistant', 'creator', 'super_admin'].includes(u.role));

    listBody.innerHTML = '';

    staff.forEach(s => {
        const isMe = s.email === currentUser.email;
        const html = `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="p-2 font-semibold">
                    ${s.firstName} ${s.lastName} 
                    ${isMe ? '<span class="text-xs text-blue-500">(You)</span>' : ''}
                </td>
                <td class="p-2"><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase">${s.role}</span></td>
                <td class="p-2 text-gray-500">${s.email}</td>
                <td class="p-2"><span class="text-green-500 font-bold text-xs">${s.status}</span></td>
            </tr>
        `;
        listBody.insertAdjacentHTML('beforeend', html);
    });
}

function handleCreateStaff(e) {
    e.preventDefault();

    const fname = document.getElementById('staffFname').value;
    const lname = document.getElementById('staffLname').value;
    const email = document.getElementById('staffEmail').value;
    const pass = document.getElementById('staffPass').value;
    const role = document.getElementById('staffRole').value;

    try {
        DataService.createStaffAccount(currentUser.email, {
            firstName: fname,
            lastName: lname,
            email: email,
            password: pass,
            role: role
        });

        alert(`New ${role} created: ${email}`);
        document.getElementById('createStaffForm').reset();
        loadStaffList();
    } catch (error) {
        alert("Error: " + error.message);
    }
}


// --- EVENT LISTENERS ---

function setupEventListeners() {
    // Staff Create Form
    const staffForm = document.getElementById('createStaffForm');
    if (staffForm) staffForm.addEventListener('submit', handleCreateStaff);

    // Expose Functions globally for onclick handlers in HTML
    window.switchView = switchView;
    window.switchDashboardMode = switchDashboardMode;
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Only if Super Admin
        if (currentUser && currentUser.role === 'super_admin') {

            // Ctrl + Shift + S => Staff View
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                switchView('staff');
            }

            // Ctrl + Shift + D => Dashboard View
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                switchView('dashboard');
            }

            // Ctrl + 1 => Admin View
            if (e.ctrlKey && e.key === '1') {
                // Already here
                console.log("Admin View Shortcut");
            }
        }
    });
}