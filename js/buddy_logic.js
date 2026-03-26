/**
 * BUDDY LOGIC — kid/home_logged_in.html
 * Handles the live buddy list, incoming requests panel, and Add Buddy modal.
 */

let _currentChild = null;
let _foundBuddyTarget = null; // the child doc found by search
let _unsubscribeBuddies = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Load child session from sessionStorage
    const session = sessionStorage.getItem('cubby_child_session');
    if (!session) return; // Not logged in as kid — buddy UI won't load

    _currentChild = JSON.parse(session);

    // Try to retrieve the kid's ID (the backend parent dashboard generates it)
    try {
        const profile = await DataService.getChildProfileReadOnly(_currentChild.$id);
        if (profile && profile.kidId) {
            _currentChild.kidId = profile.kidId;
            sessionStorage.setItem('cubby_child_session', JSON.stringify(_currentChild));
        }
    } catch (e) {
        // Safe to ignore if permissions block it, the ID will just say 'Not set yet'
        console.debug('Could not directly fetch kid profile (expected if no read-access):', e.message);
    }

    await refreshBuddyUI();

    // Push-based updates for buddy requests and list changes
    startBuddyRealtime();
});

// Begins the Realtime subscription for buddy events.
function startBuddyRealtime() {
    stopBuddyRealtime();
    const { COLLECTIONS } = AppwriteService;
    _unsubscribeBuddies = DataService.subscribeToCollection(COLLECTIONS.BUDDIES, response => {
        const payload = response.payload;
        // Only refresh if the event involves the current child
        if (payload.toChildId === _currentChild?.$id || payload.fromChildId === _currentChild?.$id) {
            refreshBuddyUI();
        }
    });
}

// Terminates the Realtime subscription.
function stopBuddyRealtime() {
    if (_unsubscribeBuddies) {
        _unsubscribeBuddies();
        _unsubscribeBuddies = null;
    }
}

// Safely terminates Realtime when the user navigates away.
window.addEventListener('beforeunload', stopBuddyRealtime);
window.addEventListener('pagehide', stopBuddyRealtime);

// ── Main refresh ─────────────────────────────────────────────────────────────

async function refreshBuddyUI() {
    if (!_currentChild) return;

    const [buddies, incoming] = await Promise.all([
        DataService.getBuddies(_currentChild.$id),
        DataService.getIncomingBuddyRequests(_currentChild.$id)
    ]);

    // Limit to the 3 most recently interacted with buddies
    const topBuddies = buddies.slice(0, 3);

    renderBuddyList(topBuddies);
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

    container.innerHTML = buddies.map(buddy => {
        let avatarHtml = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddy.username)}"
            class="w-8 h-8 rounded-full bg-gray-200 border border-white shadow-sm shrink-0">`;

        if (buddy.avatarImage) {
            const bgStr = buddy.avatarBgColor ? `style="background-color: ${buddy.avatarBgColor}"` : 'bg-gray-200';
            avatarHtml = `<img src="${buddy.avatarImage}" ${bgStr} class="w-8 h-8 rounded-full border border-white shadow-sm shrink-0 object-contain p-0.5">`;
        }

        return `
        <div class="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded-xl transition-colors group relative"
             title="Chat with ${buddy.username}">
            <button onclick="event.stopPropagation(); viewBuddyProfile('${buddy.childId}', '${encodeURIComponent(buddy.username)}')"
                class="shrink-0 text-gray-300 hover:text-cubby-blue text-xs p-1 rounded-lg hover:bg-blue-50 transition-colors"
                title="View Profile">
                <i class="fa-solid fa-user-circle"></i>
            </button>
            <a href="chat.html?buddyId=${encodeURIComponent(buddy.childId)}&buddyName=${encodeURIComponent(buddy.username)}&buddyDocId=${encodeURIComponent(buddy.buddyDocId)}"
               class="flex items-center gap-2 flex-1 min-w-0">
                ${avatarHtml}
                <span class="font-bold text-gray-700 group-hover:text-cubby-blue text-sm truncate">${buddy.username}</span>
            </a>
            <button onclick="unfriendBuddy('${buddy.buddyDocId}', '${encodeURIComponent(buddy.username)}')"
                class="opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0 text-gray-300 hover:text-red-500 text-xs p-1 rounded-lg hover:bg-red-50"
                title="Unfriend ${buddy.username}">
                <i class="fa-solid fa-user-xmark"></i>
            </button>
        </div>
    `}).join('');
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
        // Log as activity
        DataService.logActivity(_currentChild.$id, 'buddy_add', `Accepted a new buddy!`, { buddyDocId });
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

    // Build a fromChild object (DataService needs username/kidId/parentId)
    const fromChild = {
        $id: _currentChild.$id,
        username: _currentChild.username || _currentChild.name,
        kidId: _currentChild.kidId || '',
        parentId: _currentChild.parentId || ''
    };

    try {
        await DataService.sendBuddyRequest(fromChild, _foundBuddyTarget);
        sendBtn.innerHTML = '<i class="fa-solid fa-check"></i> Sent!';
        sendBtn.className = 'bg-green-500 text-white font-bold px-4 py-2 rounded-xl text-sm';
        // Log buddy request as activity
        DataService.logActivity(_currentChild.$id, 'buddy_add', `Sent a buddy request to ${_foundBuddyTarget.username || _foundBuddyTarget.name}`, { targetId: _foundBuddyTarget.$id });
        setTimeout(closeAddBuddyModal, 1500);
    } catch (e) {
        alert(e.message);
        sendBtn.textContent = 'Add!';
        sendBtn.disabled = false;
    }
};

/**
 * Unfriend — remove an accepted buddy relationship.
 */
window.unfriendBuddy = async function (buddyDocId, encodedUsername) {
    const username = decodeURIComponent(encodedUsername);
    if (!confirm(`Remove ${username} from your buddies?`)) return;
    try {
        await DataService.removeBuddy(buddyDocId);
        await refreshBuddyUI();
    } catch (e) {
        alert('Could not unfriend: ' + e.message);
    }
};

// ── Buddy Profile View ────────────────────────────────────────────────────────

window.viewBuddyProfile = async function (childId, encodedUsername) {
    const modal = document.getElementById('buddy-profile-modal');
    if (!modal) return;

    const username = decodeURIComponent(encodedUsername);

    // Set defaults while loading
    document.getElementById('buddy-display-name').textContent = username;
    document.getElementById('buddy-username').textContent = '@' + username;
    document.getElementById('buddy-bio').textContent = 'No bio yet';
    document.getElementById('buddy-cover').style.background = '#3b82f6';
    const avatarView = document.getElementById('buddy-avatar-view');
    avatarView.style.background = '#60a5fa';
    avatarView.textContent = '🐻';

    modal.classList.remove('hidden');

    // Try to fetch buddy's profile and prefs
    try {
        const profile = await DataService.getChildProfileReadOnly(childId);
        if (profile) {
            const prefs = profile.prefs || {};
            if (prefs.displayName) document.getElementById('buddy-display-name').textContent = prefs.displayName;
            if (prefs.bio) document.getElementById('buddy-bio').textContent = prefs.bio;
            if (prefs.coverColor) document.getElementById('buddy-cover').style.background = prefs.coverColor;
            if (prefs.avatarBgColor) avatarView.style.background = prefs.avatarBgColor;
            if (prefs.avatarIcon) avatarView.textContent = prefs.avatarIcon;
        }
    } catch (e) {
        console.debug('Could not fetch buddy profile prefs:', e.message);
    }
};

window.closeBuddyProfileModal = function () {
    document.getElementById('buddy-profile-modal')?.classList.add('hidden');
};
