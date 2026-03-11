// Logic for staff/admin_dashboard.html

// ─── EmailJS Configuration ────────────────────────────────────────────────
// Sign up at https://www.emailjs.com, create a service + template, then fill in:
const EMAILJS_PUBLIC_KEY = 'bu5PysfqwXeXaEOhU';      // Account → API Keys
const EMAILJS_SERVICE_ID = 'service_4sdis7b';      // Email Services tab
const EMAILJS_TEMPLATE_ID = 'template_ioda61h';     // Email Templates tab
// ─── Template variables your EmailJS template should use: ─────────────────
//  {{to_name}}    — staff member's full name
//  {{to_email}}   — staff member's email (EmailJS "To Email" field)
//  {{role}}       — their assigned role
//  {{staff_id}}   — their generated #STF-XXXXXX id
//  {{claim_link}} — link to staff_claim.html
// ──────────────────────────────────────────────────────────────────────────


let currentUser = null;
let currentPeriod = 'day'; // 'day' | 'week' | 'month'

// Chart instances
let chartReg = null, chartLogin = null, chartReports = null, chartPremium = null;

// Cached analytics data
let _analyticsCache = { registrations: [], logins: [], reports: [], premium: [] };

// Users Table State
let usersData = [], usersPage = 1;
const USERS_PER_PAGE = 10;
let userFilter = 'All', userSearchQuery = '';

// Staff Table State
let staffData = [], staffPage = 1;
const STAFF_PER_PAGE = 5;
let staffSearchQuery = '';

// Video Upload State
let selectedVideoFile = null;

// Report map (for violation picker)
const _reportMap = new Map();
let _vpReportId = '', _vpReportedId = '', _vpReporterId = '', _vpMsgText = '';

document.addEventListener('DOMContentLoaded', () => {
    initAdminDashboard();
    setupEventListeners();
    setupKeyboardShortcuts();
});

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function initAdminDashboard() {
    try {
        currentUser = await DataService.getCurrentUser();

        window.history.pushState(null, '', window.location.href);
        window.onpopstate = () => window.history.pushState(null, '', window.location.href);

        window.handleLogout = async function () {
            await DataService.logout();
            window.location.href = '../staff_access.html';
        };

        if (!currentUser || !['admin', 'super_admin', 'assistant', 'creator'].includes(currentUser.role)) {
            window.location.href = '../staff_access.html';
            return;
        }

        const nameEl = document.getElementById('header-name');
        const roleEl = document.getElementById('header-role');
        const avatarEl = document.getElementById('header-avatar');

        if (nameEl) nameEl.textContent = `${currentUser.firstName} ${currentUser.lastName}`;
        if (roleEl) roleEl.textContent = currentUser.role.replace('_', ' ');

        try {
            const acct = await window.AppwriteService.account.get();
            if (avatarEl) {
                if (acct.prefs && acct.prefs.profilePictureUrl) {
                    avatarEl.src = acct.prefs.profilePictureUrl;
                } else {
                    avatarEl.src = `https://ui-avatars.com/api/?name=${currentUser.firstName}+${currentUser.lastName}&background=random`;
                }
            }
        } catch (e) { }

        if (currentUser.role === 'super_admin') {
            const staffMenu = document.getElementById('menu-staff');
            const viewsMenu = document.getElementById('super-admin-views');
            if (staffMenu) staffMenu.classList.remove('hidden');
            if (viewsMenu) viewsMenu.classList.remove('hidden');
        }

        await Promise.all([loadStats(), loadUserList()]);
        if (currentUser.role === 'super_admin') await loadStaffList();

        await loadDashboardCharts(currentPeriod);
        initRealtimeSubscriptions();

    } catch (error) {
        console.error('Dashboard Init Error:', error);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// STATS (top cards)
// ─────────────────────────────────────────────────────────────────────────

async function loadStats() {
    try {
        const [users, videos, children, reportsList] = await Promise.all([
            DataService.getAllUsers(),
            DataService.getVideos(),
            DataService.getAllChildren(),
            DataService.getThreatLogs('pending')
        ]);
        const totalParents = users.filter(u => u.role === 'parent').length;
        const totalKids = children.length;
        const totalApproved = videos.filter(v => v.status === 'approved').length;
        const totalReports = reportsList.length;

        const el = id => document.getElementById(id);
        if (el('stat-parents')) el('stat-parents').innerText = totalParents.toLocaleString();
        if (el('stat-kids')) el('stat-kids').innerText = totalKids.toLocaleString();
        if (el('stat-videos')) el('stat-videos').innerText = totalApproved.toLocaleString();
        if (el('stat-reports')) el('stat-reports').innerText = totalReports.toLocaleString();
    } catch (e) { console.error('Stats Error:', e); }
}

// ─────────────────────────────────────────────────────────────────────────
// CHART ANALYTICS
// ─────────────────────────────────────────────────────────────────────────

window.setChartPeriod = function (period) {
    currentPeriod = period;
    ['day', 'week', 'month'].forEach(p => {
        const btn = document.getElementById(`period-${p}`);
        if (!btn) return;
        if (p === period) {
            btn.classList.add('bg-cubby-blue', 'text-white');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('bg-cubby-blue', 'text-white');
            btn.classList.add('text-gray-500');
        }
    });
    loadDashboardCharts(period);
};

async function loadDashboardCharts(period = 'day') {
    try {
        const { databases, DB_ID, COLLECTIONS } = DataService._getServices();
        const { Query } = Appwrite;

        const now = new Date();
        let buckets = [], bucketMs;

        if (period === 'day') {
            buckets = Array.from({ length: 24 }, (_, i) => {
                const d = new Date(now);
                d.setHours(now.getHours() - (23 - i), 0, 0, 0);
                return { label: d.getHours() + ':00', start: d.getTime(), end: d.getTime() + 3600000 };
            });
        } else if (period === 'week') {
            buckets = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(now);
                d.setDate(now.getDate() - (6 - i));
                d.setHours(0, 0, 0, 0);
                return { label: d.toLocaleDateString('en', { weekday: 'short' }), start: d.getTime(), end: d.getTime() + 86400000 };
            });
        } else {
            buckets = Array.from({ length: 30 }, (_, i) => {
                const d = new Date(now);
                d.setDate(now.getDate() - (29 - i));
                d.setHours(0, 0, 0, 0);
                return { label: `${d.getMonth() + 1}/${d.getDate()}`, start: d.getTime(), end: d.getTime() + 86400000 };
            });
        }

        const since = new Date(buckets[0].start).toISOString();

        // Fetch raw data
        const [allUsers, loginReqs, threatLogs] = await Promise.all([
            databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.orderDesc('createdAt'), Query.limit(500)]).then(r => r.documents),
            databases.listDocuments(DB_ID, 'login_requests', [Query.orderDesc('requestedAt'), Query.limit(500)]).then(r => r.documents).catch(() => []),
            databases.listDocuments(DB_ID, COLLECTIONS.THREAT_LOGS, [Query.orderDesc('timestamp'), Query.limit(500)]).then(r => r.documents).catch(() => [])
        ]);

        const parents = allUsers.filter(u => u.role === 'parent');
        const premiumParents = parents.filter(u => u.isPremium === true);

        // Group into buckets
        const bucket = (docs, dateField) => buckets.map(b =>
            docs.filter(d => {
                const t = new Date(d[dateField] || d.$createdAt || d.timestamp || d.requestedAt || 0).getTime();
                return t >= b.start && t < b.end;
            }).length
        );

        const regData = bucket(parents, 'createdAt');
        const loginData = bucket(loginReqs, 'requestedAt');
        const reportData = bucket(threatLogs, 'timestamp');
        const premiumData = bucket(premiumParents, 'createdAt');

        _analyticsCache = { registrations: regData, logins: loginData, reports: reportData, premium: premiumData, labels: buckets.map(b => b.label) };

        // Update totals
        const sum = arr => arr.reduce((a, b) => a + b, 0);
        const el = id => document.getElementById(id);
        if (el('chart-reg-total')) el('chart-reg-total').innerText = sum(regData);
        if (el('chart-login-total')) el('chart-login-total').innerText = sum(loginData);
        if (el('chart-reports-total')) el('chart-reports-total').innerText = sum(reportData);
        if (el('chart-premium-total')) el('chart-premium-total').innerText = sum(premiumData);

        const labels = buckets.map(b => b.label);

        const chartDef = (id, data, color, label) => {
            const canvas = document.getElementById(id);
            if (!canvas) return null;
            const ctx = canvas.getContext('2d');
            const existing = Chart.getChart(canvas);
            if (existing) existing.destroy();
            const isDark = document.body.classList.contains('dark-mode');
            const gridColor = isDark ? '#374151' : '#f3f4f6';
            const tickColor = isDark ? '#9CA3AF' : '#6B7280';
            return new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label,
                        data,
                        backgroundColor: color + '33',
                        borderColor: color,
                        borderWidth: 2,
                        borderRadius: 4,
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 10 }, maxTicksLimit: 8 } },
                        y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: tickColor, precision: 0, font: { size: 10 } } }
                    }
                }
            });
        };

        chartReg = chartDef('chartRegistrations', regData, '#4CC9F0', 'Registrations');
        chartLogin = chartDef('chartLogins', loginData, '#7209B7', 'Logins');
        chartReports = chartDef('chartReports', reportData, '#ef4444', 'Reports');
        chartPremium = chartDef('chartPremium', premiumData, '#f59e0b', 'Premium');

    } catch (e) {
        console.error('Chart load error:', e);
    }
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────

window.exportCSV = function () {
    const { labels, registrations, logins, reports, premium } = _analyticsCache;
    if (!labels || !labels.length) { alert('No chart data loaded yet.'); return; }

    const rows = [['Period', 'Registrations', 'Logins', 'Chat Reports', 'Premium Purchases']];
    labels.forEach((lbl, i) => rows.push([lbl, registrations[i] || 0, logins[i] || 0, reports[i] || 0, premium[i] || 0]));

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cubbycove_analytics_${currentPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

window.exportPDF = async function () {
    if (!window.jspdf) { alert('PDF library not loaded.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const { labels, registrations, logins, reports, premium } = _analyticsCache;

    doc.setFontSize(16);
    doc.text('CubbyCove Analytics Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Period: ${currentPeriod} — Generated: ${new Date().toLocaleString()}`, 14, 22);

    // Add chart images
    const chartIds = ['chartRegistrations', 'chartLogins', 'chartReports', 'chartPremium'];
    const titles = ['Account Registrations', 'Login Activity', 'Chat Reports', 'Premium Purchases'];
    let x = 14, y = 30;
    for (let i = 0; i < chartIds.length; i++) {
        const canvas = document.getElementById(chartIds[i]);
        if (canvas) {
            const img = canvas.toDataURL('image/png');
            doc.setFontSize(9);
            doc.text(titles[i], x, y - 1);
            doc.addImage(img, 'PNG', x, y, 125, 55);
            if (i === 1) { x = 14; y += 65; } else { x += 135; }
        }
    }

    // Data table
    y += 10;
    doc.setFontSize(10);
    doc.text('Data Table', 14, y);
    y += 6;
    doc.setFontSize(8);
    const headers = ['Period', 'Registrations', 'Logins', 'Chat Reports', 'Premium'];
    const colX = [14, 60, 100, 140, 185];
    headers.forEach((h, i) => { doc.setFont(undefined, 'bold'); doc.text(h, colX[i], y); });
    doc.setFont(undefined, 'normal');
    y += 5;
    (labels || []).slice(0, 20).forEach((lbl, idx) => {
        [lbl, registrations[idx] || 0, logins[idx] || 0, reports[idx] || 0, premium[idx] || 0].forEach((v, i) => {
            doc.text(String(v), colX[i], y);
        });
        y += 5;
        if (y > 190) { doc.addPage(); y = 15; }
    });

    doc.save(`cubbycove_analytics_${currentPeriod}_${new Date().toISOString().slice(0, 10)}.pdf`);
};

// ─────────────────────────────────────────────────────────────────────────
// VIEW NAVIGATION
// ─────────────────────────────────────────────────────────────────────────

const TAB_TITLES = {
    dashboard: 'Dashboard', users: 'User Management', content: 'Add Content',
    verification: 'Parent Verification', moderation: 'Chat Reports',
    'video-review': 'Video Review', staff: 'Manage Staff'
};

function switchView(tabName) {
    if (tabName === 'staff' && (!currentUser || currentUser.role !== 'super_admin')) {
        alert('Access Denied: Super Admin only.');
        return;
    }

    document.querySelectorAll('main > div[id^="tab-"]').forEach(div => div.classList.add('hidden'));
    document.querySelectorAll('nav a.nav-item').forEach(a => {
        a.classList.remove('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
        a.classList.add('text-gray-400', 'hover:bg-gray-800', 'hover:text-white', 'border-transparent', 'border-l-4');
    });

    const targetDiv = document.getElementById(`tab-${tabName}`);
    const targetNav = document.getElementById(`nav-${tabName}`);

    if (targetDiv) targetDiv.classList.remove('hidden');
    if (targetNav) {
        targetNav.classList.add('bg-cubby-blue/20', 'text-cubby-blue', 'border-l-4', 'border-cubby-blue');
        targetNav.classList.remove('text-gray-400', 'hover:bg-gray-800', 'hover:text-white', 'border-transparent');
    }

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = TAB_TITLES[tabName] || tabName;

    if (tabName === 'staff') loadStaffList();
    if (tabName === 'users') loadUserList();
    if (tabName === 'verification') loadPendingParents();
    if (tabName === 'moderation') loadChatReports();
    if (tabName === 'video-review') loadPendingVideos();
    if (tabName === 'dashboard') loadDashboardCharts(currentPeriod);
}

function switchDashboardMode(mode) {
    if (!['super_admin', 'admin'].includes(currentUser.role) && currentUser.role !== mode) {
        alert('Restricted access.');
        return;
    }
    if (mode === 'assistant') window.location.href = 'assistant_panel.html';
    if (mode === 'creator') window.location.href = '../creator/creator.html';
    if (mode === 'admin') location.reload();
}

// ─────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────

async function fetchAllUsersData() {
    try {
        const [users, children] = await Promise.all([DataService.getAllUsers(), DataService.getAllChildren()]);
        const generalUsers = users.filter(u => !['admin', 'super_admin', 'assistant', 'creator'].includes(u.role));
        const childList = children.map(c => ({ $id: c.$id, firstName: c.username || c.name, lastName: '', role: 'child', status: 'active' }));
        usersData = [...generalUsers, ...childList];
        renderUsersList();
    } catch (e) { console.error('Load users error:', e); }
}

async function loadUserList() { await fetchAllUsersData(); }

function renderUsersList() {
    const listBody = document.getElementById('user-list-body');
    if (!listBody) return;
    let filtered = usersData;
    if (userSearchQuery) {
        const q = userSearchQuery.toLowerCase();
        filtered = filtered.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
    }
    if (userFilter !== 'All') {
        const f = userFilter.toLowerCase();
        if (f === 'parent' || f === 'child') filtered = filtered.filter(u => u.role.toLowerCase() === f);
        else if (f === 'accepted') filtered = filtered.filter(u => u.status === 'active');
        else if (f === 'rejected') filtered = filtered.filter(u => u.status === 'rejected' || u.status === 'banned');
    }
    const total = filtered.length;
    const totalPages = Math.ceil(total / USERS_PER_PAGE) || 1;
    if (usersPage > totalPages) usersPage = totalPages;
    if (usersPage < 1) usersPage = 1;
    const startIdx = (usersPage - 1) * USERS_PER_PAGE;
    const endIdx = Math.min(startIdx + USERS_PER_PAGE, total);
    const pageData = filtered.slice(startIdx, endIdx);

    const info = document.getElementById('user-page-info');
    if (info) info.innerText = `Showing ${total === 0 ? 0 : startIdx + 1} to ${endIdx} of ${total}`;

    const btnPrev = document.getElementById('btn-prev-users');
    const btnNext = document.getElementById('btn-next-users');
    if (btnPrev) btnPrev.disabled = usersPage === 1;
    if (btnNext) btnNext.disabled = usersPage === totalPages;

    listBody.innerHTML = '';
    if (!pageData.length) { listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No users found.</td></tr>'; return; }

    pageData.forEach(u => {
        let roleBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold capitalize">${u.role}</span>`;
        if (u.role === 'parent') roleBadge = `<span class="bg-purple-100 text-purple-600 px-2 py-0.5 rounded text-xs font-bold">Parent</span>`;
        else if (u.role === 'child') roleBadge = `<span class="bg-green-100 text-green-600 px-2 py-0.5 rounded text-xs font-bold">Child</span>`;
        let statusClass = 'text-green-500';
        if (['banned', 'suspended', 'rejected'].includes(u.status)) statusClass = 'text-red-500';
        else if (u.status === 'pending') statusClass = 'text-yellow-500';
        const action = u.role === 'child' ? `<span class="text-xs text-gray-400">Child</span>` :
            (u.status !== 'banned'
                ? `<button onclick="updateUserStatus('${u.$id}','banned')" class="text-red-400 hover:text-red-600 p-1" title="Ban"><i class="fa-solid fa-ban"></i></button>`
                : `<button onclick="updateUserStatus('${u.$id}','active')" class="text-green-400 hover:text-green-600 p-1" title="Unban"><i class="fa-solid fa-rotate-left"></i></button>`);
        listBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="p-2 font-semibold">${u.firstName} ${u.lastName || ''}</td>
                <td class="p-2">${roleBadge}</td>
                <td class="p-2"><span class="${statusClass} font-bold text-xs capitalize">${u.status}</span></td>
                <td class="p-2 text-right">${action}</td>
            </tr>`);
    });
}

async function updateUserStatus(userId, status) {
    if (confirm(`Change user status to ${status}?`)) {
        try { await DataService.updateUserStatus(userId, status); loadUserList(); }
        catch (e) { alert('Error: ' + e.message); }
    }
}

// ─────────────────────────────────────────────────────────────────────────
// PARENT VERIFICATION (ported from assistant_logic.js)
// ─────────────────────────────────────────────────────────────────────────

async function loadPendingParents() {
    const container = document.getElementById('tab-verification');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';
    try {
        const allUsers = await DataService.getAllUsers();
        const pendingParents = allUsers.filter(u => u.role === 'parent' && u.status === 'pending');
        container.innerHTML = '';
        if (!pendingParents.length) {
            container.innerHTML = `<div class="text-center p-12 bg-white rounded-xl shadow-sm">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500 text-2xl"><i class="fa-solid fa-check"></i></div>
                <h3 class="text-lg font-bold text-gray-800">All Cleared!</h3>
                <p class="text-gray-500">No pending parent registrations.</p></div>`;
            updateAdminBadge('verification', 0); return;
        }
        updateAdminBadge('verification', pendingParents.length);
        for (const parent of pendingParents) {
            container.insertAdjacentHTML('beforeend', `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4" id="user-${parent.$id}">
                    <div class="bg-gray-50 px-6 py-3 border-b flex justify-between items-center">
                        <span class="font-bold text-gray-700 text-sm">${parent.firstName} ${parent.lastName}</span>
                        <span class="text-xs text-gray-400"><i class="fa-regular fa-envelope"></i> ${parent.email}</span>
                    </div>
                    <div class="p-6">
                        <div class="flex flex-col md:flex-row gap-8 items-center justify-center mb-6">
                            <div class="text-center w-full md:w-1/2">
                                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Uploaded ID</p>
                                <div class="rounded-lg bg-gray-100 border w-full h-48 flex items-center justify-center overflow-hidden" id="id-container-${parent.$id}">
                                    ${parent.idDocumentId ? '<i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i>' : '<div class="text-gray-400 flex flex-col items-center"><i class="fa-solid fa-id-card text-3xl mb-2"></i><span>No ID Uploaded</span></div>'}
                                </div>
                            </div>
                            <div class="text-center w-full md:w-1/2">
                                <p class="text-xs font-bold text-gray-400 uppercase mb-2">Live Photo / Avatar</p>
                                <div class="rounded-lg bg-gray-100 border w-full h-48 flex items-center justify-center overflow-hidden" id="face-container-${parent.$id}">
                                    <i class="fa-solid fa-spinner fa-spin text-gray-400 text-2xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="text-sm text-gray-600 bg-gray-50 p-4 rounded-lg border mb-6">
                            <p class="mb-1"><strong>Name:</strong> ${parent.firstName} ${parent.middleName || ''} ${parent.lastName}</p>
                            <p class="mb-1"><strong>Email:</strong> ${parent.email}</p>
                            <p><strong>Joined:</strong> ${new Date(parent.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div class="flex gap-4">
                            <button onclick="updateParentStatus('${parent.$id}','rejected')" class="flex-1 py-3 border-2 border-red-100 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"><i class="fa-solid fa-xmark mr-1"></i> Reject</button>
                            <button onclick="updateParentStatus('${parent.$id}','active')" class="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors"><i class="fa-solid fa-check mr-1"></i> Approve</button>
                        </div>
                    </div>
                </div>`);
            _loadVerificationImages(parent);
        }
    } catch (e) {
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error: ${e.message}</div>`;
    }
}

async function _loadVerificationImages(parent) {
    const svc = window.AppwriteService;
    if (!svc) return;
    const endpoint = (svc.client?.config?.endpoint || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
    const projectId = svc.client?.config?.project || '69904f4900396667cf4c';
    const bucketId = svc.BUCKET_PARENT_DOCS || 'parent_docs';

    const fetchImage = async (fileId, jwt) => {
        const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
        const res = await fetch(url, { headers: { 'X-Appwrite-Project': projectId, 'X-Appwrite-JWT': jwt } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return URL.createObjectURL(await res.blob());
    };

    let jwt = '';
    try { const j = await svc.account.createJWT(); jwt = j.jwt; } catch (e) { /* ignore */ }

    const faceEl = document.getElementById(`face-container-${parent.$id}`);
    if (faceEl) {
        if (parent.faceId && !parent.faceId.startsWith('mock_') && parent.faceId !== 'deleted') {
            try { faceEl.innerHTML = `<img src="${await fetchImage(parent.faceId, jwt)}" class="w-full h-full object-cover">`; }
            catch { faceEl.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(parent.firstName)}" class="w-full h-full object-cover">`; }
        } else {
            faceEl.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(parent.firstName)}" class="w-full h-full object-cover">`;
        }
    }

    const idEl = document.getElementById(`id-container-${parent.$id}`);
    if (idEl && parent.idDocumentId && parent.idDocumentId !== 'deleted') {
        try { idEl.innerHTML = `<img src="${await fetchImage(parent.idDocumentId, jwt)}" class="w-full h-full object-cover">`; }
        catch { idEl.innerHTML = `<div class="text-gray-400 flex flex-col items-center"><i class="fa-solid fa-id-card text-3xl mb-2"></i><span>Could not load ID</span></div>`; }
    }
}

async function updateParentStatus(userId, status) {
    const action = status === 'active' ? 'Approve' : 'Reject';
    showConfirm(`${action} this parent? Their verification photos will be deleted after.`, async () => {
        try {
            await DataService.updateUserStatus(userId, status);
            await DataService.cleanupParentVerificationFiles(userId);
            loadPendingParents();
            loadStats();
        } catch (e) { alert('Error: ' + e.message); }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// CHAT MODERATION (ported from assistant_logic.js)
// ─────────────────────────────────────────────────────────────────────────

async function loadChatReports() {
    const container = document.getElementById('tab-moderation');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';
    try {
        const reports = await DataService.getThreatLogs('pending');
        container.innerHTML = '';
        if (!reports.length) {
            container.innerHTML = `<div class="text-center p-12 bg-white rounded-xl shadow-sm">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-500 text-2xl"><i class="fa-solid fa-shield-halved"></i></div>
                <h3 class="text-lg font-bold">Safe &amp; Sound!</h3>
                <p class="text-gray-500">No chat reports pending review.</p></div>`;
            updateAdminBadge('moderation', 0); return;
        }
        updateAdminBadge('moderation', reports.length);

        const looksLikeId = s => s && s.length >= 16 && /^[a-zA-Z0-9]+$/.test(s) && !s.includes(' ');
        const { databases, DB_ID, COLLECTIONS } = DataService._getServices();
        const { Query } = Appwrite;

        const enriched = await Promise.all(reports.map(async report => {
            const r = { ...report };
            const needsName = !r.reportedChildName || looksLikeId(r.reportedChildName);
            const needsEmail = !r.reportedParentEmail || r.reportedParentEmail === 'N/A';
            const lookupId = r.reportedChildId || r.childId;
            if ((needsName || needsEmail) && lookupId) {
                try {
                    const child = await databases.getDocument(DB_ID, COLLECTIONS.CHILDREN, lookupId);
                    if (needsName) r.reportedChildName = child.username || child.name || lookupId;
                    if (needsEmail && child.parentId) {
                        try {
                            const p = await databases.getDocument(DB_ID, COLLECTIONS.USERS, child.parentId);
                            if (p.email) r.reportedParentEmail = p.email;
                        } catch {
                            try {
                                const pl = await databases.listDocuments(DB_ID, COLLECTIONS.USERS, [Query.equal('$id', child.parentId), Query.limit(1)]);
                                if (pl.documents.length) r.reportedParentEmail = pl.documents[0].email || '';
                            } catch { /* ignore */ }
                        }
                    }
                } catch { /* ignore */ }
            }
            return r;
        }));

        _reportMap.clear();
        enriched.forEach(r => _reportMap.set(r.$id, r));

        enriched.forEach(report => {
            const badge = report.violationType
                ? `<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">${report.violationType}</span>`
                : `<span class="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">Reported</span>`;
            container.insertAdjacentHTML('beforeend', `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4" id="report-${report.$id}">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="font-bold text-gray-800">Chat Report</h3>${badge}
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div class="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p class="text-[10px] font-bold text-blue-400 uppercase mb-1">Reporter (Victim) Child</p>
                            <p class="font-bold text-gray-800 text-sm">${report.reporterChildName || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">${report.reporterParentEmail || 'N/A'}</p>
                        </div>
                        <div class="bg-red-50 border border-red-100 rounded-xl p-3">
                            <p class="text-[10px] font-bold text-red-400 uppercase mb-1">Reported (Sender) Child</p>
                            <p class="font-bold text-gray-800 text-sm">${report.reportedChildName || 'Unknown'}</p>
                            <p class="text-xs text-gray-500">${report.reportedParentEmail || 'N/A'}</p>
                        </div>
                    </div>
                    <div class="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                        <p class="text-[10px] font-bold text-red-400 uppercase mb-1">Reported Message</p>
                        <p class="text-sm text-red-800 font-semibold break-words">&ldquo;${(report.messageContent || report.content || 'No content').replace(/</g, '&lt;').replace(/>/g, '&gt;')}&rdquo;</p>
                    </div>
                    <div class="flex gap-3 border-t border-gray-100 pt-4">
                        <button onclick="handleDenyReport('${report.$id}')" class="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 text-sm"><i class="fa-solid fa-xmark mr-1"></i> Deny</button>
                        <button onclick="openViolationPicker('${report.$id}')" class="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm"><i class="fa-solid fa-gavel mr-1"></i> Confirm Violation</button>
                    </div>
                </div>`);
        });
    } catch (e) {
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error: ${e.message}</div>`;
    }
}

window.openViolationPicker = function (reportId) {
    const report = _reportMap.get(reportId);
    if (!report) { alert('Report data not found. Please reload.'); return; }
    _vpReportId = report.$id;
    _vpReportedId = report.reportedChildId || report.childId || '';
    _vpReporterId = report.reporterChildId || '';
    _vpMsgText = report.messageContent || report.content || '';
    document.querySelectorAll('input[name="mute-duration"]').forEach(r => r.checked = false);
    const modal = document.getElementById('violation-picker-modal');
    if (modal) modal.classList.remove('hidden');
};

window.submitViolationPicker = function () {
    const sel = document.querySelector('input[name="mute-duration"]:checked');
    if (!sel) { alert('Please choose a mute duration.'); return; }
    const { value: durationMs, dataset: { label: durationLabel } } = sel;
    document.getElementById('violation-picker-modal').classList.add('hidden');
    showConfirm(`Mute this child for ${durationLabel} and notify both parents?`, async () => {
        try {
            await DataService.banChildFromChat(_vpReportedId, parseInt(durationMs));
            await DataService.alertParentsOfReport(_vpReportedId, _vpReporterId, _vpMsgText, durationLabel);
            await DataService.updateThreatLog(_vpReportId, 'resolved', `muted:${durationLabel}`);
            loadChatReports(); loadStats();
            alert('Violation confirmed. Child muted and parents notified.');
        } catch (e) { alert('Error: ' + e.message); }
    });
};

window.handleDenyReport = function (reportId) {
    showConfirm('Deny this report? No action will be taken.', async () => {
        try {
            await DataService.updateThreatLog(reportId, 'resolved', 'dismissed');
            loadChatReports(); loadStats();
        } catch (e) { alert('Error: ' + e.message); }
    });
};

// ─────────────────────────────────────────────────────────────────────────
// VIDEO REVIEW (ported from assistant_logic.js)
// ─────────────────────────────────────────────────────────────────────────

async function loadPendingVideos() {
    const container = document.getElementById('tab-video-review');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-10"><i class="fa-solid fa-spinner fa-spin text-cubby-blue text-4xl"></i></div>';
    try {
        const pendingVideos = await DataService.getVideos('pending');
        container.innerHTML = '';
        if (!pendingVideos.length) {
            container.innerHTML = `<div class="text-center p-12 bg-white rounded-xl shadow-sm">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 text-2xl"><i class="fa-solid fa-film"></i></div>
                <h3 class="text-lg font-bold">All caught up!</h3>
                <p class="text-gray-500">No videos pending review.</p></div>`;
            updateAdminBadge('video-review', 0); return;
        }
        updateAdminBadge('video-review', pendingVideos.length);
        pendingVideos.forEach(video => {
            const ytMatch = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
            let playerHtml = '';
            if (ytMatch) {
                playerHtml = `<iframe class="w-full h-full" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>`;
            } else {
                playerHtml = `<video src="${(video.url || '').replace(/"/g, '&quot;')}" class="w-full h-full object-cover" controls preload="metadata"></video>`;
            }
            container.insertAdjacentHTML('beforeend', `
                <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4" id="video-${video.$id}">
                    <div class="flex flex-col md:flex-row">
                        <div class="w-full md:w-1/3 bg-black h-48 md:h-auto">
                            ${playerHtml}
                        </div>
                        <div class="p-6 flex-1 flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <h3 class="font-bold text-lg text-gray-800">${video.title}</h3>
                                    <span class="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">${video.category}</span>
                                </div>
                                <p class="text-sm text-gray-600 mb-1">Uploaded by: <span class="text-cubby-purple font-bold">${video.creatorEmail || 'Unknown'}</span></p>
                                <p class="text-xs text-gray-500">Submitted: ${new Date(video.uploadedAt).toLocaleString()}</p>
                            </div>
                            <div class="mt-6 flex gap-3">
                                <button onclick="updateVideoStatus('${video.$id}','rejected')" class="px-4 py-2 border border-red-200 text-red-500 font-bold rounded-lg hover:bg-red-50 text-sm"><i class="fa-solid fa-ban mr-1"></i> Reject</button>
                                <button onclick="updateVideoStatus('${video.$id}','approved')" class="px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 text-sm"><i class="fa-solid fa-check mr-1"></i> Approve &amp; Publish</button>
                            </div>
                        </div>
                    </div>
                </div>`);
        });
    } catch (e) {
        container.innerHTML = `<div class="bg-red-50 text-red-500 p-4 rounded-lg">Error: ${e.message}</div>`;
    }
}

async function updateVideoStatus(videoId, status) {
    showConfirm(`${status === 'approved' ? 'Approve' : 'Reject'} this video?`, async () => {
        try { await DataService.updateVideoStatus(videoId, status); loadPendingVideos(); loadStats(); }
        catch (e) { alert('Error: ' + e.message); }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// BADGE HELPER
// ─────────────────────────────────────────────────────────────────────────

function updateAdminBadge(tab, count) {
    const badge = document.getElementById(`badge-${tab}`);
    if (!badge) return;
    badge.innerText = count;
    if (count === 0) badge.classList.add('hidden');
    else badge.classList.remove('hidden');
}

// ─────────────────────────────────────────────────────────────────────────
// STAFF MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

async function loadStaffList() {
    try {
        const users = await DataService.getAllUsers();
        staffData = users.filter(u => ['admin', 'assistant', 'creator', 'super_admin'].includes(u.role));
        renderStaffList();
    } catch (e) { console.error('Load Staff Error:', e); }
}

function renderStaffList() {
    const listBody = document.getElementById('staff-list-body');
    if (!listBody) return;
    let filtered = staffData;
    if (staffSearchQuery) {
        const q = staffSearchQuery.toLowerCase();
        filtered = filtered.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.role.toLowerCase().includes(q));
    }
    const total = filtered.length;
    const totalPages = Math.ceil(total / STAFF_PER_PAGE) || 1;
    if (staffPage > totalPages) staffPage = totalPages;
    if (staffPage < 1) staffPage = 1;
    const startIdx = (staffPage - 1) * STAFF_PER_PAGE;
    const endIdx = Math.min(startIdx + STAFF_PER_PAGE, total);
    const pageData = filtered.slice(startIdx, endIdx);

    const info = document.getElementById('staff-page-info');
    if (info) info.innerText = `Showing ${total === 0 ? 0 : startIdx + 1} to ${endIdx} of ${total}`;

    const btnPrev = document.getElementById('btn-prev-staff');
    const btnNext = document.getElementById('btn-next-staff');
    if (btnPrev) btnPrev.disabled = staffPage === 1;
    if (btnNext) btnNext.disabled = staffPage === totalPages;

    listBody.innerHTML = '';
    if (!pageData.length) { listBody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">No staff found.</td></tr>'; return; }

    pageData.forEach(s => {
        const isMe = s.email === currentUser.email;
        const statusClass = ['banned', 'archived'].includes(s.status) ? 'text-red-500' : 'text-green-500';
        listBody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-100 hover:bg-gray-50 ${isMe ? '' : 'cursor-pointer'}"
                ${isMe ? '' : `onclick="openManageStaffModal('${s.$id}','${s.firstName} ${s.lastName}','${s.role}','${s.email}','${s.status}')"`}>
                <td class="p-2 font-semibold">${s.firstName} ${s.lastName} ${isMe ? '<span class="text-xs text-blue-500">(You)</span>' : ''}</td>
                <td class="p-2"><span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold uppercase">${s.role}</span></td>
                <td class="p-2 text-gray-500">${s.email}</td>
                <td class="p-2"><span class="${statusClass} font-bold text-xs capitalize">${s.status}</span></td>
            </tr>`);
    });
}

let editingStaffId = null;

window.openManageStaffModal = function (id, name, role, email, status) {
    editingStaffId = id;
    document.getElementById('manage-staff-info').innerText = `${name} (${email})`;
    document.getElementById('manage-staff-role').value = role;
    const btnA = document.getElementById('archive-staff-btn');
    const btnU = document.getElementById('unarchive-staff-btn');
    const hint = document.getElementById('archive-staff-hint');
    if (status === 'archived') {
        btnA.classList.add('hidden'); btnU.classList.remove('hidden');
        if (hint) hint.innerText = 'Click unarchive to restore access.';
    } else {
        btnA.classList.remove('hidden'); btnU.classList.add('hidden');
        if (hint) hint.innerText = 'Archived accounts cannot log in.';
    }
    document.getElementById('manage-staff-modal').classList.remove('hidden');
};

window.closeManageStaffModal = function () {
    editingStaffId = null;
    document.getElementById('manage-staff-modal').classList.add('hidden');
};

window.submitStaffRoleChange = async function () {
    if (!editingStaffId) return;
    const newRole = document.getElementById('manage-staff-role').value;
    if (!confirm(`Change this staff's role to ${newRole}?`)) return;
    try {
        await DataService.updateUserRole(editingStaffId, newRole);
        alert('Role updated!'); closeManageStaffModal(); loadStaffList();
    } catch (e) { alert('Error: ' + e.message); }
};

window.archiveStaffAccount = async function () {
    if (!editingStaffId) return;
    if (!confirm('Archive this account? They will no longer be able to log in.')) return;
    try {
        await DataService.updateUserStatus(editingStaffId, 'archived');
        alert('Account archived!'); closeManageStaffModal(); loadStaffList();
    } catch (e) { alert('Error: ' + e.message); }
};

window.unarchiveStaffAccount = async function () {
    if (!editingStaffId) return;
    if (!confirm('Unarchive this account? They will regain access.')) return;
    try {
        await DataService.updateUserStatus(editingStaffId, 'active');
        alert('Account unarchived!'); closeManageStaffModal(); loadStaffList();
    } catch (e) { alert('Error: ' + e.message); }
};

// Stores pending staff data while the confirmation modal is open
let _pendingStaffData = null;

async function handleCreateStaff(e) {
    e.preventDefault();
    const rateCheck = SecurityUtils.checkRateLimit('staff_create', 15);
    if (!rateCheck.allowed) { alert(`Wait ${rateCheck.waitTime}s before creating another staff.`); return; }

    const fname = document.getElementById('staffFname').value.trim();
    const lname = document.getElementById('staffLname').value.trim();
    const email = document.getElementById('staffEmail').value.trim();
    const pass = document.getElementById('staffPass').value;
    const role = document.getElementById('staffRole').value;

    if (!fname || !lname || !email) { alert('Please fill in all fields.'); return; }

    const passCheck = SecurityUtils.validatePassword(pass);
    if (!passCheck.isValid) { alert(passCheck.error); return; }

    // Store and show confirmation modal
    _pendingStaffData = { firstName: fname, lastName: lname, email, password: pass, role };

    document.getElementById('confirm-staff-name').textContent = `${fname} ${lname}`;
    document.getElementById('confirm-staff-email').textContent = email;
    document.getElementById('confirm-staff-role').textContent = role.replace('_', ' ');
    document.getElementById('staff-confirm-modal').classList.remove('hidden');
}

window.confirmCreateStaff = async function () {
    if (!_pendingStaffData) return;
    document.getElementById('staff-confirm-modal').classList.add('hidden');

    const btn = document.querySelector('#createStaffForm button[type="submit"]');
    const orig = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...'; btn.disabled = true; }

    try {
        const doc = await DataService.createStaffAccount(currentUser.email, _pendingStaffData);
        SecurityUtils.recordAction('staff_create');

        const staffId = doc.staffId || 'N/A';
        const claimUrl = `${window.location.origin}/staff_claim.html`;

        // ── Send invitation email via EmailJS ────────────────────────────
        let emailSent = false;
        if (EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
            try {
                emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
                await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
                    to_name: `${_pendingStaffData.firstName} ${_pendingStaffData.lastName}`,
                    to_email: _pendingStaffData.email,
                    role: _pendingStaffData.role.replace('_', ' '),
                    staff_id: staffId,
                    claim_link: claimUrl
                });
                emailSent = true;
            } catch (emailErr) {
                console.warn('EmailJS send failed (non-fatal):', emailErr.message);
            }
        }

        // ── Success alert ─────────────────────────────────────────────────
        const emailNote = emailSent
            ? '📧 An invitation email has been sent.'
            : '⚠️ Email not sent — check your EmailJS configuration.';

        alert(`✅ Staff account created!\n\nName: ${_pendingStaffData.firstName} ${_pendingStaffData.lastName}\nEmail: ${_pendingStaffData.email}\nRole: ${_pendingStaffData.role}\nStaff ID: ${staffId}\n\n${emailNote}`);

        _pendingStaffData = null;
        document.getElementById('createStaffForm').reset();
        await loadStaffList();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        if (btn) { btn.innerHTML = orig; btn.disabled = false; }
    }
};

window.cancelCreateStaff = function () {
    _pendingStaffData = null;
    document.getElementById('staff-confirm-modal').classList.add('hidden');
};



async function handleAddVideo(e) {
    e.preventDefault();
    const idInput = document.getElementById('videoId').value;
    const title = document.getElementById('videoTitle').value;
    const category = document.querySelector('#addVideoForm select').value;
    if (!idInput && !selectedVideoFile) { alert('Please provide a YouTube ID/URL or upload a video file.'); return; }
    if (!title) { alert('Please enter a Video Title'); return; }

    const btn = document.querySelector('#addVideoForm button[type="submit"]');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...'; btn.disabled = true;
    try {
        let finalUrl = '';
        if (selectedVideoFile) {
            const svc = window.AppwriteService;
            const { ID } = Appwrite;
            try {
                const bucketId = 'parent_docs';
                const uploaded = await svc.storage.createFile(bucketId, ID.unique(), selectedVideoFile);
                const ep = (svc.client.config.endpoint || '').replace(/\/$/, '');
                const proj = svc.client.config.project || '';
                finalUrl = `${ep}/storage/buckets/${bucketId}/files/${uploaded.$id}/view?project=${proj}`;
            } catch { finalUrl = URL.createObjectURL(selectedVideoFile); }
        } else {
            let finalId = idInput;
            if (idInput.includes('v=')) finalId = idInput.split('v=')[1].split('&')[0];
            else if (idInput.includes('youtu.be/')) finalId = idInput.split('youtu.be/')[1];
            finalUrl = `https://www.youtube.com/watch?v=${finalId}`;
        }
        await DataService.addVideo({ title, url: finalUrl, category, creatorEmail: currentUser.email });
        alert('Video added!');
        document.getElementById('addVideoForm').reset();
        selectedVideoFile = null;
        document.getElementById('videoId').value = '';
        await loadStats();
    } catch (e) { alert('Error: ' + e.message); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────────────────────

function setupEventListeners() {
    const staffForm = document.getElementById('createStaffForm');
    if (staffForm) staffForm.addEventListener('submit', handleCreateStaff);
    const videoForm = document.getElementById('addVideoForm');
    if (videoForm) videoForm.addEventListener('submit', handleAddVideo);

    const localVideoInput = document.getElementById('localVideoUpload');
    if (localVideoInput) localVideoInput.addEventListener('change', e => {
        if (e.target.files?.length) {
            selectedVideoFile = e.target.files[0];
            const videoIdEl = document.getElementById('videoId');
            if (videoIdEl) videoIdEl.value = selectedVideoFile.name;
        }
    });

    const prevU = document.getElementById('btn-prev-users');
    const nextU = document.getElementById('btn-next-users');
    if (prevU) prevU.addEventListener('click', () => { usersPage--; renderUsersList(); });
    if (nextU) nextU.addEventListener('click', () => { usersPage++; renderUsersList(); });

    const searchU = document.getElementById('user-search-input');
    if (searchU) searchU.addEventListener('input', e => { userSearchQuery = e.target.value; usersPage = 1; renderUsersList(); });

    document.querySelectorAll('.user-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            document.querySelectorAll('.user-btn').forEach(b => { b.classList.remove('bg-cubby-blue', 'text-white'); b.classList.add('bg-gray-100', 'text-gray-600'); });
            e.target.classList.remove('bg-gray-100', 'text-gray-600'); e.target.classList.add('bg-cubby-blue', 'text-white');
            userFilter = e.target.getAttribute('data-filter'); usersPage = 1; renderUsersList();
        });
    });

    const prevS = document.getElementById('btn-prev-staff');
    const nextS = document.getElementById('btn-next-staff');
    if (prevS) prevS.addEventListener('click', () => { staffPage--; renderStaffList(); });
    if (nextS) nextS.addEventListener('click', () => { staffPage++; renderStaffList(); });

    const searchS = document.getElementById('staff-search-input');
    if (searchS) searchS.addEventListener('input', e => { staffSearchQuery = e.target.value; staffPage = 1; renderStaffList(); });

    window.switchView = switchView;
    window.switchDashboardMode = switchDashboardMode;
    window.updateUserStatus = updateUserStatus;
    window.updateParentStatus = updateParentStatus;
    window.updateVideoStatus = updateVideoStatus;
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (currentUser && currentUser.role === 'super_admin') {
            if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); switchView('staff'); }
            if (e.ctrlKey && e.shiftKey && e.key === 'D') { e.preventDefault(); switchView('dashboard'); }
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────
// REAL-TIME SUBSCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────

function initRealtimeSubscriptions() {
    const svc = window.AppwriteService;
    if (!svc || !svc.client) { console.warn('[Realtime] AppwriteService not ready.'); return; }
    const { client, DB_ID } = svc;

    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    const refreshStats = debounce(loadStats, 600);
    const refreshUsers = debounce(loadUserList, 600);
    const refreshCharts = debounce(() => loadDashboardCharts(currentPeriod), 1200);
    const refreshVerify = debounce(loadPendingParents, 600);
    const refreshReports = debounce(loadChatReports, 600);
    const refreshVideos = debounce(loadPendingVideos, 600);

    const isTabVisible = id => { const el = document.getElementById(id); return el && !el.classList.contains('hidden'); };

    client.subscribe(`databases.${DB_ID}.collections.users.documents`, () => {
        refreshStats(); refreshCharts();
        if (isTabVisible('tab-users')) refreshUsers();
        if (isTabVisible('tab-verification')) refreshVerify();
    });

    client.subscribe(`databases.${DB_ID}.collections.children.documents`, () => {
        refreshStats();
        if (isTabVisible('tab-users')) refreshUsers();
    });

    client.subscribe(`databases.${DB_ID}.collections.videos.documents`, () => {
        refreshStats();
        if (isTabVisible('tab-video-review')) refreshVideos();
    });

    client.subscribe(`databases.${DB_ID}.collections.threat_logs.documents`, () => {
        refreshStats(); refreshCharts();
        if (isTabVisible('tab-moderation')) refreshReports();
    });

    // login_requests → chart refresh
    try {
        client.subscribe(`databases.${DB_ID}.collections.login_requests.documents`, () => {
            refreshCharts();
        });
    } catch { /* collection may not exist */ }

    console.log('✅ [Realtime] Admin dashboard subscriptions active.');
}

// ─────────────────────────────────────────────────────────────────────────
// PROFILE SETTINGS MODAL
// ─────────────────────────────────────────────────────────────────────────

let _originalUsername = '';

window.openSettingsModal = function () {
    const modal = document.getElementById('settings-modal');
    if (!modal || !currentUser) return;

    const svc = window.AppwriteService;
    svc.account.get().then(acct => {
        const prefs = acct.prefs || {};

        // Grab existing avatar if present in DOM, fallback to current pref or dicebear
        let displayAvatarUrl = document.getElementById('header-avatar') ? document.getElementById('header-avatar').src : '';
        if (prefs.profilePictureUrl) {
            displayAvatarUrl = prefs.profilePictureUrl;
        }

        document.getElementById('settings-avatar').src = displayAvatarUrl;
        document.getElementById('settings-email').textContent = acct.email || currentUser.email;
        document.getElementById('settings-bio').value = prefs.bio || '';
        document.getElementById('settings-username').value = acct.name || '';
        _originalUsername = acct.name || '';
        document.getElementById('settings-darkmode').checked = prefs.darkMode === 'true';
        document.getElementById('settings-current-pass').value = '';
        document.getElementById('settings-new-pass').value = '';

        // Bio char count
        const bioEl = document.getElementById('settings-bio');
        document.getElementById('bio-char-count').textContent = bioEl.value.length;
        bioEl.oninput = () => { document.getElementById('bio-char-count').textContent = bioEl.value.length; };

        // Username cooldown message
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
                const fileUrl = `${svc.client.config.endpoint}/storage/buckets/${svc.BUCKET_PROFILE_PICS}/files/${uploadResult.$id}/view?project=${svc.client.config.project}`;

                updatedPrefs.profilePictureUrl = fileUrl;
                document.getElementById('settings-avatar').src = fileUrl; // Update preview
                if (document.getElementById('header-avatar')) document.getElementById('header-avatar').src = fileUrl;
            } catch (uploadError) {
                console.error("Profile picture upload failed:", uploadError);
                alert("Failed to upload profile picture. Please try again.");
                return; // Stop save process
            }
        }

        // Username cooldown check
        if (newUsername && newUsername !== _originalUsername) {
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

        // Password change
        if (currentPass && newPass) {
            if (newPass.length < 8) { alert('New password must be at least 8 characters.'); return; }
            await svc.account.updatePassword(newPass, currentPass);
            alert('Password updated successfully!');
        }

        // Apply dark mode
        if (darkMode) document.body.classList.add('dark-mode');
        else document.body.classList.remove('dark-mode');

        // Update header name
        const nameEl = document.getElementById('header-name');
        if (nameEl && newUsername) nameEl.textContent = `${newUsername}`;

        closeSettingsModal();
        alert('Settings saved!');
    } catch (e) {
        alert('Error saving settings: ' + e.message);
    }
};