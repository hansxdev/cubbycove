// CUBBYCHAT LOGIC — Handles the real-time chat interface for kids.
let _currentChild = null;
let _buddyId = '';
let _buddyName = '';
let _buddyDocId = '';
let _conversationId = '';
let _pollInterval = null;
let _lastMessageTime = null;
let _knownMessageIds = new Set();
let _lastRenderedMsg = null;

// Report state
let _pendingReportMsgId = '';
let _pendingReportText = '';
let _pendingViolationType = '';

const POLL_MS = 2000;
const GROUP_MS = 60000;

// List of restricted English words used as a safety fallback.
const BAD_WORDS = ['stupid', 'ugly', 'hate', 'dumb', 'idiot', 'kill', 'die', 'shut up'];
// List of restricted Tagalog words for local dialect filtering.
const TAGALOG_BAD_WORDS = [
    'putangina', 'tangina', 'puta', 'gago', 'tarantado', 'bobo',
    'ulol', 'pota', 'pucha', 'pokpok', 'hinayupak', 'hayop',
    'bwisit', 'leche', 'lintik', 'punyeta', 'kantot', 'iyot',
    'bayag', 'titi', 'pepe', 'puke', 'tanga'
];

// Analyzes message text for profanity using local lists and the Appwrite Gemini Function.
async function analyzeMessageWithAI(text) {
    const lowerText = text.toLowerCase();
    if (TAGALOG_BAD_WORDS.some(w => lowerText.includes(w))) return false;

    // Call the secure Appwrite Function instead of exposing the API key
    try {
        const { functions, FUNCTION_GEMINI_FILTER } = window.AppwriteService;

        const execution = await functions.createExecution(
            FUNCTION_GEMINI_FILTER,
            JSON.stringify({ action: 'filter_message', text: text }),
            false,
            '/',
            'POST'
        );

        if (!execution.responseBody) {
            throw new Error('Empty response from Appwrite Function.');
        }

        const responseData = JSON.parse(execution.responseBody);

        if (!responseData.success) {
            console.error("Gemini Appwrite Function Error:", responseData.error);
            return !BAD_WORDS.some(w => lowerText.includes(w));
        }

        // Debug log for the reason
        console.log("Gemini Moderation:", responseData.result);

        return responseData.result.isSafe;

    } catch (e) {
        console.warn("Appwrite Function failed, falling back to local list:", e.message);
        return !BAD_WORDS.some(w => lowerText.includes(w));
    }
}

// Retrieves a DOM element by its unique identifier.
const $ = id => document.getElementById(id);

// Initializes the chat application state and event listeners on page load.
document.addEventListener('DOMContentLoaded', async () => {
    const raw = sessionStorage.getItem('cubby_child_session');
    if (!raw) { window.location.replace('../login.html'); return; }
    _currentChild = JSON.parse(raw);

    const params = new URLSearchParams(window.location.search);
    _buddyId = params.get('buddyId') || '';
    _buddyName = params.get('buddyName') || '';
    _buddyDocId = params.get('buddyDocId') || '';

    loadChatBuddySidebar();

    if (!_buddyId) {
        $('chat-loading').classList.add('hidden');
        const nbs = $('no-buddy-state');
        if (nbs) { nbs.classList.remove('hidden'); nbs.classList.add('flex'); }
        $('send-btn').disabled = true;
        $('message-input').disabled = true;
        $('message-input').placeholder = 'Pick a buddy first...';
        updateChatHeader('', '');
        return;
    }

    updateChatHeader(_buddyId, _buddyName);
    _conversationId = DataService._buildConversationId(_currentChild.$id, _buddyId);
    await loadMessageHistory();
    startPolling();

    $('send-btn').addEventListener('click', sendMessage);
    $('message-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    $('message-input').focus();
    $('buddy-search')?.addEventListener('input', filterBuddySidebar);
});

// Updates the chat header with the current buddy's avatar and name.
function updateChatHeader(buddyId, buddyName, avatarImage, avatarBgColor) {
    const avatarEl = $('chat-buddy-avatar');
    const nameEl = $('chat-buddy-name');
    const statusEl = $('chat-status-label');

    if (!buddyId) {
        if (nameEl) nameEl.textContent = 'No buddy selected';
        if (statusEl) statusEl.textContent = '';
        if (avatarEl) {
            avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=friend`;
            avatarEl.style.backgroundColor = '';
            avatarEl.classList.remove('object-contain', 'p-1');
            avatarEl.classList.add('object-cover');
        }
        return;
    }

    if (avatarEl) {
        if (avatarImage) {
            avatarEl.src = avatarImage;
            avatarEl.style.backgroundColor = avatarBgColor || '#e5e7eb';
            avatarEl.classList.add('object-contain', 'p-1');
            avatarEl.classList.remove('object-cover');
        } else {
            avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddyName)}`;
            avatarEl.style.backgroundColor = '';
            avatarEl.classList.remove('object-contain', 'p-1');
            avatarEl.classList.add('object-cover');
        }
    }

    if (nameEl) nameEl.textContent = buddyName || 'Your Buddy';
    if (statusEl) statusEl.textContent = 'Online';
}

// Loads and renders the list of buddies in the sidebar.
async function loadChatBuddySidebar() {
    const container = $('chat-buddy-list');
    if (!container || !_currentChild) return;
    try {
        const buddies = await DataService.getBuddies(_currentChild.$id);
        if (buddies.length === 0) {
            container.innerHTML = `<div class="text-center py-6 px-4"><i class="fa-solid fa-user-group text-gray-200 text-3xl mb-2"></i><p class="text-xs text-gray-400 font-semibold">No buddies yet!</p></div>`;
            return;
        }
        container.innerHTML = buddies.map(buddy => {
            const isActive = buddy.childId === _buddyId;

            if (isActive) {
                // Update header with actual loaded avatar if active
                updateChatHeader(buddy.childId, buddy.username, buddy.avatarImage, buddy.avatarBgColor);
            }

            let avatarHtml = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddy.username)}" class="w-10 h-10 rounded-full bg-white border border-gray-200">`;
            if (buddy.avatarImage) {
                const bgStr = buddy.avatarBgColor ? `style="background-color: ${buddy.avatarBgColor}"` : 'bg-gray-200';
                avatarHtml = `<img src="${buddy.avatarImage}" ${bgStr} class="w-10 h-10 rounded-full border border-gray-200 object-contain p-0.5">`;
            }

            return `
            <a href="chat.html?buddyId=${encodeURIComponent(buddy.childId)}&buddyName=${encodeURIComponent(buddy.username)}&buddyDocId=${encodeURIComponent(buddy.buddyDocId)}"
               class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all buddy-item ${isActive ? 'bg-cubby-green/10' : 'hover:bg-gray-50'}"
               data-name="${buddy.username.toLowerCase()}">
                ${avatarHtml}
                <div class="flex-1 min-w-0 info">
                    <h4 class="font-bold ${isActive ? 'text-cubby-green' : 'text-gray-800'} truncate text-sm">${buddy.username}</h4>
                    <p class="text-xs text-gray-400 truncate">${isActive ? 'Chatting now' : 'Tap to chat'}</p>
                </div>
            </a>`;
        }).join('');
    } catch (e) {
        console.warn('loadChatBuddySidebar error:', e.message);
    }
}

// Filters the visible buddies in the sidebar based on user search input.
function filterBuddySidebar(e) {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.buddy-item').forEach(el => {
        el.style.display = (el.dataset.name || '').includes(q) ? '' : 'none';
    });
}

// Fetches and displays the previous message history for the current conversation.
async function loadMessageHistory() {
    const loadingEl = $('chat-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    const container = $('chat-messages');
    try {
        const messages = await DataService.getChatMessages(_conversationId, 50);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (messages.length === 0) {
            container.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-center" id="empty-chat-msg"><h3 class="font-extrabold text-gray-700 text-lg mb-1">Say hi to ${escapeHtml(_buddyName)}! 👋</h3></div>`;
            return;
        }
        container.innerHTML = '';
        _lastRenderedMsg = null;
        messages.forEach(msg => {
            _knownMessageIds.add(msg.$id);
            renderMessage(msg);
        });
        _lastMessageTime = messages[messages.length - 1].sentAt;
        scrollToBottom();
    } catch (e) {
        console.error('loadMessageHistory error:', e.message);
    }
}

// Begins the recurring poll for new incoming chat messages.
function startPolling() {
    stopPolling();
    _pollInterval = setInterval(pollNewMessages, POLL_MS);
}

// Stops the recurring poll for new chat messages.
function stopPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

// Checks the server for new messages that haven't been rendered yet.
async function pollNewMessages() {
    if (!_conversationId) return;
    try {
        const messages = await DataService.getChatMessages(_conversationId, 25);
        let addedAny = false;
        messages.forEach(msg => {
            if (_knownMessageIds.has(msg.$id)) return;
            _knownMessageIds.add(msg.$id);
            const emptyCard = $('empty-chat-msg');
            if (emptyCard) emptyCard.remove();
            renderMessage(msg);
            addedAny = true;
            if (!_lastMessageTime || msg.sentAt > _lastMessageTime) _lastMessageTime = msg.sentAt;
        });
        if (addedAny) scrollToBottom();
    } catch (e) {
        console.warn('[CubbyChat] Poll error:', e.message);
    }
}

// Renders a single message bubble into the chat message container.
function renderMessage(msg) {
    if (!msg || !msg.text) return;
    const isMe = msg.fromChildId === _currentChild.$id;
    const container = $('chat-messages');
    const prev = _lastRenderedMsg;
    const gapMs = prev && msg.sentAt && prev.sentAt ? (new Date(msg.sentAt) - new Date(prev.sentAt)) : Infinity;
    const isGrouped = prev && prev.fromChildId === msg.fromChildId && gapMs < GROUP_MS;

    if (!prev || gapMs >= GROUP_MS) {
        const sep = document.createElement('div');
        sep.className = 'text-center my-3';
        sep.innerHTML = `<span class="bg-gray-100 text-gray-400 text-[10px] font-bold px-3 py-1 rounded-full">${formatTime(msg.sentAt)}</span>`;
        container.appendChild(sep);
    }

    const div = document.createElement('div');
    const bubbleClass = isGrouped ? (isMe ? 'rounded-tr-sm' : 'rounded-tl-sm') : '';
    div.className = `flex ${isMe ? 'justify-end' : 'gap-2 items-end'} mt-1 message-enter`;

    if (isMe) {
        div.innerHTML = `<div class="max-w-[75%] bg-cubby-green rounded-2xl ${bubbleClass} rounded-br-none px-4 py-2 text-white text-sm font-medium break-words overflow-wrap-anywhere">${escapeHtml(msg.text)}</div>`;
    } else {
        const safeText = escapeHtml(msg.text);
        const safeTextAttr = msg.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
        const avatarHtml = isGrouped ? '<div class="w-8 shrink-0"></div>' : `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.fromUsername || _buddyName)}" class="w-8 h-8 rounded-full bg-white border border-gray-200 shrink-0">`;
        div.innerHTML = `${avatarHtml}<div class="max-w-[75%] bg-white rounded-2xl ${bubbleClass} rounded-bl-none px-4 py-2 shadow-sm text-gray-800 text-sm relative group break-words overflow-wrap-anywhere">${safeText}<button onclick="openReportModal('${msg.$id}', '${safeTextAttr}')" class="absolute -right-8 top-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Report this message"><i class="fa-solid fa-flag"></i></button></div>`;
    }
    container.appendChild(div);
    _lastRenderedMsg = { fromChildId: msg.fromChildId, sentAt: msg.sentAt };
}

// Processes and sends a user's text message after passing a safety check and mute check.
async function sendMessage() {
    const input = $('message-input');
    const sendBtn = $('send-btn');
    const text = input.value.trim();
    if (!text || !_conversationId || !_currentChild) return;

    // ── MUTE CHECK ──────────────────────────────────────────────
    try {
        const muteStatus = await DataService.isChildMuted(_currentChild.$id);
        if (muteStatus.muted) {
            const durEl = $('mute-duration-text');
            if (durEl) durEl.textContent = muteStatus.durationStr;
            $('mute-modal').classList.remove('hidden');
            return;
        }
    } catch (e) {
        console.warn('mute check error:', e.message);
    }
    // ─────────────────────────────────────────────────────────────

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';

    if (!(await analyzeMessageWithAI(text))) {
        showSafetyWarning();
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    const tempId = 'temp_' + Date.now();
    _knownMessageIds.add(tempId);
    renderMessage({ $id: tempId, fromChildId: _currentChild.$id, fromUsername: _currentChild.username, text, sentAt: new Date().toISOString() });
    scrollToBottom();

    try {
        const saved = await DataService.sendChatMessage(_conversationId, _currentChild.$id, _currentChild.username || _currentChild.name, text);
        if (saved?.$id) _knownMessageIds.add(saved.$id);
    } catch (e) {
        showSafetyWarning('Could not send. Check your connection.');
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
        input.focus();
    }
}

// Displays a brief visual alert when a safety violation or error occurs.
function showSafetyWarning(msg) {
    const toast = $('safety-toast');
    if (!toast) return;
    toast.querySelector('span').textContent = msg || "That message isn't nice! Please be kind. 💛";
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ── REPORT MODAL FLOW ──────────────────────────────────────────────────────────

/** Step 1: Open the report modal for a specific message. */
window.openReportModal = function (msgId, text) {
    _pendingReportMsgId = msgId;
    _pendingReportText = text;
    _pendingViolationType = '';

    // Reset radio buttons
    document.querySelectorAll('input[name="violation"]').forEach(r => r.checked = false);

    const preview = $('report-message-preview');
    if (preview) preview.textContent = `"${text.slice(0, 120)}${text.length > 120 ? '…' : ''}"`;

    $('report-modal').classList.remove('hidden');
};

/** Step 2: User picks violation type and clicks "Submit Report" → show confirmation modal. */
window.submitReportViolationType = function () {
    const selected = document.querySelector('input[name="violation"]:checked');
    if (!selected) {
        alert('Please select a violation type before reporting.');
        return;
    }
    _pendingViolationType = selected.value;

    // Close report modal, open confirm modal
    $('report-modal').classList.add('hidden');
    const cvt = $('confirm-violation-text');
    if (cvt) cvt.textContent = `Violation: ${_pendingViolationType}`;
    $('confirm-report-modal').classList.remove('hidden');
};

/** Step 3: User confirms → actually submit the report. */
window.finalizeReport = async function () {
    const btn = $('finalize-report-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Reporting…'; }

    try {
        await DataService.reportMessage(
            _pendingReportMsgId,
            _conversationId,
            _currentChild.$id,   // reporter = me
            _buddyId,                // reported = the buddy (child ID, NOT the buddies-doc ID)
            _pendingReportText,
            _pendingViolationType
        );
        $('confirm-report-modal').classList.add('hidden');
        showSafetyWarning('Message reported to safety team. Thank you! 🛡️');
    } catch (e) {
        $('confirm-report-modal').classList.add('hidden');
        showSafetyWarning('Failed to report. Please try again later.');
        console.error('finalizeReport error:', e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Yes, Report!'; }
    }
};

window.closeReportModal = function () {
    $('report-modal').classList.add('hidden');
};
window.closeConfirmReportModal = function () {
    $('confirm-report-modal').classList.add('hidden');
};

// Keep old entry point working (called from the nav flag button if wired up elsewhere)
window.reportChatMessage = window.openReportModal;

// ──────────────────────────────────────────────────────────────────────────────

// Forces the chat message container to scroll to the most recent message.
function scrollToBottom() {
    const c = $('chat-messages');
    if (c) c.scrollTop = c.scrollHeight;
}

// Converts raw text into a safe HTML string to prevent script injection.
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Formats an ISO date string into a localized time format for display.
function formatTime(isoStr) {
    return isoStr ? new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

// Safely terminates message polling when the user navigates away from the page.
window.addEventListener('beforeunload', stopPolling);
window.addEventListener('pagehide', stopPolling);