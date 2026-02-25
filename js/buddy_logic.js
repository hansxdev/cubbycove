/**
 * BUDDY LOGIC — kid/home_logged_in.html
 * Handles the live buddy list, incoming requests panel, and Add Buddy modal.
 */

let _currentChild = null;
let _foundBuddyTarget = null; // the child doc found by search
let _buddyPollInterval = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Load child session from sessionStorage
    const session = sessionStorage.getItem('cubby_child_session');
    if (!session) return; // Not logged in as kid — buddy UI won't load

    _currentChild = JSON.parse(session);

    // Ensure this child has a kidId
    try {
        const kidId = await DataService.ensureKidId(_currentChild.$id);
        _currentChild.kidId = kidId;
        // Update session so it's consistent
        sessionStorage.setItem('cubby_child_session', JSON.stringify(_currentChild));
    } catch (e) {
        console.warn('Could not ensure kidId:', e.message);
    }

    await refreshBuddyUI();

    // Poll for new buddy requests every 15 seconds
    _buddyPollInterval = setInterval(refreshBuddyUI, 15000);
});

// ── Main refresh ─────────────────────────────────────────────────────────────

async function refreshBuddyUI() {
    if (!_currentChild) return;

    const [buddies, incoming] = await Promise.all([
        DataService.getBuddies(_currentChild.$id),
        DataService.getIncomingBuddyRequests(_currentChild.$id)
    ]);

    renderBuddyList(buddies);
    renderIncomingRequests(incoming);
}

// ── Render buddy list ─────────────────────────────────────────────────────────

function renderBuddyList(buddies) {
    const container = document.getElementById('buddy-list');
    if (!container) return;

    if (buddies.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6">
                <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <i class="fa-solid fa-user-group text-gray-300 text-xl"></i>
                </div>
                <p class="text-xs text-gray-400 font-semibold">No buddies yet</p>
                <button onclick="openAddBuddyModal()"
                    class="mt-2 text-xs text-cubby-blue font-bold hover:underline">Add Buddies!</button>
            </div>
        `;
        return;
    }

    container.innerHTML = buddies.map(buddy => `
        <a href="chat.html"
            class="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors group">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddy.username)}"
                class="w-8 h-8 rounded-full bg-gray-200 border border-white shadow-sm shrink-0">
            <span class="font-bold text-gray-700 group-hover:text-cubby-blue text-sm truncate">${buddy.username}</span>
            <span class="w-2 h-2 bg-green-400 rounded-full ml-auto shrink-0"></span>
        </a>
    `).join('');
}

// ── Render incoming requests ──────────────────────────────────────────────────

function renderIncomingRequests(requests) {
    const section = document.getElementById('buddy-requests-section');
    const list = document.getElementById('buddy-requests-list');
    const countBadge = document.getElementById('buddy-req-count');

    if (!section || !list) return;

    if (requests.length === 0) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    if (countBadge) countBadge.textContent = requests.length;

    list.innerHTML = requests.map(req => `
        <div class="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-3">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(req.fromUsername)}"
                class="w-9 h-9 rounded-full border border-gray-200 shrink-0">
            <div class="flex-1 min-w-0">
                <p class="font-bold text-gray-800 text-sm truncate">${req.fromUsername}</p>
                <p class="text-xs text-gray-400">wants to be your buddy!</p>
            </div>
            <div class="flex gap-1.5 shrink-0">
                <button onclick="declineBuddyReq('${req.$id}')"
                    class="text-xs text-gray-400 hover:text-red-500 font-bold border border-gray-200 px-2 py-1 rounded-lg hover:border-red-300 transition-colors">
                    No
                </button>
                <button onclick="acceptBuddyReq('${req.$id}', this)"
                    class="text-xs text-white bg-cubby-green hover:bg-green-500 font-bold px-2.5 py-1 rounded-lg transition-colors shadow-sm">
                    Yes!
                </button>
            </div>
        </div>
    `).join('');
}

// ── Toggle request list ───────────────────────────────────────────────────────

window.toggleBuddyRequests = function () {
    const list = document.getElementById('buddy-requests-list');
    if (list) list.classList.toggle('hidden');
};

// ── Accept / Decline ──────────────────────────────────────────────────────────

window.acceptBuddyReq = async function (buddyDocId, btn) {
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        await DataService.acceptBuddyRequest(buddyDocId, _currentChild);
        await refreshBuddyUI();
    } catch (e) {
        alert('Could not accept: ' + e.message);
        if (btn) { btn.textContent = 'Yes!'; btn.disabled = false; }
    }
};

window.declineBuddyReq = async function (buddyDocId) {
    try {
        await DataService.declineBuddyRequest(buddyDocId);
        await refreshBuddyUI();
    } catch (e) {
        alert('Could not decline: ' + e.message);
    }
};

// ── Add Buddy Modal ───────────────────────────────────────────────────────────

window.openAddBuddyModal = function () {
    const modal = document.getElementById('add-buddy-modal');
    if (!modal) return;

    // Show the current kid's ID
    const kidIdEl = document.getElementById('my-kid-id');
    if (kidIdEl) kidIdEl.textContent = _currentChild?.kidId || 'Not set yet';

    // Reset UI
    document.getElementById('buddy-search-input').value = '';
    document.getElementById('buddy-search-result').classList.add('hidden');
    document.getElementById('buddy-search-empty').classList.add('hidden');
    _foundBuddyTarget = null;

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('buddy-search-input')?.focus(), 100);
};

window.closeAddBuddyModal = function () {
    const modal = document.getElementById('add-buddy-modal');
    if (modal) modal.classList.add('hidden');
    _foundBuddyTarget = null;
};

window.copyKidId = function () {
    const id = _currentChild?.kidId;
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
        const btn = document.querySelector('[onclick="copyKidId()"]');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-check text-xs text-green-500"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-copy text-xs"></i>'; }, 1500);
        }
    });
};

window.searchBuddy = async function () {
    const input = document.getElementById('buddy-search-input');
    const resultBox = document.getElementById('buddy-search-result');
    const emptyBox = document.getElementById('buddy-search-empty');
    const searchBtn = document.getElementById('buddy-search-btn');

    const q = input?.value?.trim();
    if (!q) return;

    // Loading state
    searchBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    searchBtn.disabled = true;
    resultBox.classList.add('hidden');
    emptyBox.classList.add('hidden');

    try {
        const found = await DataService.searchChildByUsernameOrKidId(q);

        if (!found) {
            emptyBox.classList.remove('hidden');
            _foundBuddyTarget = null;
        } else {
            _foundBuddyTarget = found;
            document.getElementById('buddy-result-avatar').src =
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(found.username || found.name)}`;
            document.getElementById('buddy-result-name').textContent = found.username || found.name;
            document.getElementById('buddy-result-kidid').textContent = found.kidId || 'No ID yet';
            document.getElementById('buddy-send-btn').innerHTML = 'Add!';
            document.getElementById('buddy-send-btn').disabled = false;
            resultBox.classList.remove('hidden');
        }
    } catch (e) {
        alert('Search failed: ' + e.message);
    } finally {
        searchBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
        searchBtn.disabled = false;
    }
};

window.sendBuddyRequest = async function () {
    if (!_foundBuddyTarget || !_currentChild) return;

    const sendBtn = document.getElementById('buddy-send-btn');
    sendBtn.textContent = '⏳';
    sendBtn.disabled = true;

    // Build a fromChild object (DataService needs username/kidId)
    const fromChild = {
        $id: _currentChild.$id,
        username: _currentChild.username || _currentChild.name,
        kidId: _currentChild.kidId || ''
    };

    try {
        await DataService.sendBuddyRequest(fromChild, _foundBuddyTarget);
        sendBtn.innerHTML = '<i class="fa-solid fa-check"></i> Sent!';
        sendBtn.className = 'bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-sm';
        setTimeout(closeAddBuddyModal, 1500);
    } catch (e) {
        alert(e.message);
        sendBtn.textContent = 'Add!';
        sendBtn.disabled = false;
    }
};
