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
        await loadStats();

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

        // Calculate Stats
        const totalParents = users.filter(u => u.role === 'parent').length;
        this_totalKids = 0; // Local var logic fix
        let totalKids = 0;

        // Note: Appwrite Document structure might not have 'children' array hydrated yet if it's a relationship. 
        // For now, assuming direct array or using a separate count if we implement Children collection fetching.
        // The DataService.getAllUsers() fetches from 'Users' collection.
        // In refined schema, Children are in 'Children' collection.
        // So counting 'Children' collection is better.
        // But DataService.getAllUsers only gets 'Users'.
        // Let's assume 0 for kids or update DataService to fetch kids count.
        // TODO: Implement getStats() in DataService for better performance.

        // Update UI
        const elParents = document.getElementById('stat-parents');
        const elKids = document.getElementById('stat-kids');
        const elContent = document.getElementById('stat-videos');

        if (elParents) elParents.innerText = totalParents.toLocaleString();
        if (elKids) elKids.innerText = "-"; // Placeholder until getting kids collection
        if (elContent) elContent.innerText = "850"; // Mock for now

    } catch (error) {
        console.error("Stats Error:", error);
    }
}

// --- VIEW NAVIGATION ---

function switchView(viewName) {
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
            if (!link.classList.contains('text-sm')) {
                link.classList.remove('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
                link.classList.add('text-gray-400', 'hover:bg-gray-800');
            }
        }
    });
}

function switchDashboardMode(mode) {
    if (currentUser.role !== 'super_admin') {
        if (currentUser.role !== mode && currentUser.role !== 'admin') {
            alert("Restricted: Switch to Power User account to access all views.");
            return;
        }
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
    } catch (e) {
        console.error("Load Staff Error:", e);
        listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading staff list.</td></tr>';
    }
}

async function handleCreateStaff(e) {
    e.preventDefault();

    const fname = document.getElementById('staffFname').value;
    const lname = document.getElementById('staffLname').value;
    const email = document.getElementById('staffEmail').value;
    const pass = document.getElementById('staffPass').value;
    const role = document.getElementById('staffRole').value;

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


// --- EVENT LISTENERS ---

function setupEventListeners() {
    const staffForm = document.getElementById('createStaffForm');
    if (staffForm) staffForm.addEventListener('submit', handleCreateStaff);

    window.switchView = switchView;
    window.switchDashboardMode = switchDashboardMode;
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