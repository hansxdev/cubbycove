// Logic for parent/dashboard.html AND parent/register_child.html

let currentScreenTimeMode = 'daily';

document.addEventListener('DOMContentLoaded', () => {

    // 1. Dashboard Logic
    const dashboardTitle = document.querySelector('h1');
    if (dashboardTitle && dashboardTitle.innerText.includes('Dashboard')) {
        console.log("Parent Dashboard Loaded");
        loadDashboardData();
    }

    // 2. Register Child Logic
    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) {
        console.log("Add Child Form Loaded");
        // No special init needed yet
    }

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
    renderKidsAndStats(user);

    // --- 2. Render Activity ---
    renderActivityLogs(user);

    // --- 3. Initial Screen Time Mode ---
    changeTimeMode('daily'); // Default
}

function renderKidsAndStats(user) {
    const kidsListEl = document.getElementById('kids-list-container');
    const activeStatEl = document.getElementById('stat-active-profiles');
    const riskStatEl = document.getElementById('stat-risk-detected');

    if (!user.children || user.children.length === 0) {
        // KEEP EMPTY STATE (Already in HTML)
        if (activeStatEl) activeStatEl.innerText = "0";
        if (riskStatEl) riskStatEl.innerText = "Safe";
        return;
    }

    // Clear Empty Details
    if (kidsListEl) kidsListEl.innerHTML = '';

    let activeCount = 0;
    let totalThreats = 0;

    user.children.forEach(child => {
        // Count Stats
        if (child.isOnline) activeCount++;
        if (child.threatsDetected) totalThreats += child.threatsDetected;

        // Render Card
        const statusColor = child.isOnline ? 'bg-green-500' : 'bg-gray-400';
        const statusText = child.isOnline ? 'Online' : 'Offline';
        const borderClass = child.isOnline ? 'border-cubby-green' : 'border-gray-100';

        const html = `
            <div class="flex items-center p-4 bg-gray-50 rounded-xl border ${borderClass} hover:border-cubby-purple transition-colors cursor-pointer group">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${child.avatar || child.name}"
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
    // In real app, we filter user.screenTimeLogs based on date range
    let timeText = "0m";
    if (mode === 'daily') timeText = "45m"; // Mock for Demo
    if (mode === 'weekly') timeText = "5h 12m"; // Mock for Demo
    if (mode === 'monthly') timeText = "22h"; // Mock for Demo

    // Allow overriding if no kids
    const user = DataService.getCurrentUser();
    if (!user || !user.children || user.children.length === 0) {
        timeText = "0m";
    }

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