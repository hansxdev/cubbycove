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

// WARNING: Hardcoding API keys in the client-side is insecure. 
// For production use, it is highly recommended to move this to an Appwrite Function.
const GEMINI_API_KEY = "[ENCRYPTION_KEY]"; // Replace with your actual Gemini API key

// Analyzes message text for profanity using local lists and the Gemini API.
async function analyzeMessageWithAI(text) {
    const lowerText = text.toLowerCase();
    if (TAGALOG_BAD_WORDS.some(w => lowerText.includes(w))) return false;

    // Use Gemini API directly via REST since we have no Node backend or bundler
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are a strict content moderator for a platform used by elementary school students. 
Check the following message for profanity, cyberbullying, or inappropriate content.

Message: "${text}"

Return a JSON object with exactly two fields:
1. "isSafe" (boolean): true if the message is completely safe, false if it contains profanity or bullying.
2. "reason" (string): a very brief reason for your decision.`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status}`);
        }

        const data = await response.json();

        // Extract the generated text from Gemini's response
        const responseText = data.candidates[0].content.parts[0].text;
        const evaluation = JSON.parse(responseText);

        // Debug log for the reason
        console.log("Gemini Moderation:", evaluation);

        return evaluation.isSafe;

    } catch (e) {
        console.warn("Gemini API failed, falling back to local list:", e.message);
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
function updateChatHeader(buddyId, buddyName) {
    const avatarEl = $('chat-buddy-avatar');
    const nameEl = $('chat-buddy-name');
    const statusEl = $('chat-status-label');

    if (!buddyId) {
        if (nameEl) nameEl.textContent = 'No buddy selected';
        if (statusEl) statusEl.textContent = '';
        return;
    }
    if (avatarEl) avatarEl.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddyName)}`;
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
            return `
            <a href="chat.html?buddyId=${encodeURIComponent(buddy.childId)}&buddyName=${encodeURIComponent(buddy.username)}&buddyDocId=${encodeURIComponent(buddy.buddyDocId)}"
               class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all buddy-item ${isActive ? 'bg-cubby-green/10' : 'hover:bg-gray-50'}"
               data-name="${buddy.username.toLowerCase()}">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddy.username)}" class="w-10 h-10 rounded-full bg-white border border-gray-200">
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
        const avatarHtml = isGrouped ? '<div class="w-8 shrink-0"></div>' : `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.fromUsername || _buddyName)}" class="w-8 h-8 rounded-full bg-white border border-gray-200 shrink-0">`;
        div.innerHTML = `${avatarHtml}<div class="max-w-[75%] bg-white rounded-2xl ${bubbleClass} rounded-bl-none px-4 py-2 shadow-sm text-gray-800 text-sm relative group break-words overflow-wrap-anywhere">${escapeHtml(msg.text)}<button onclick="reportChatMessage('${msg.$id}', '${escapeHtml(msg.text.replace(/'/g, "\\'"))}')" class="absolute -right-8 top-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-flag"></i></button></div>`;
    }
    container.appendChild(div);
    _lastRenderedMsg = { fromChildId: msg.fromChildId, sentAt: msg.sentAt };
}

// Processes and sends a user's text message after passing a safety check.
async function sendMessage() {
    const input = $('message-input');
    const sendBtn = $('send-btn');
    const text = input.value.trim();
    if (!text || !_conversationId || !_currentChild) return;

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

// Submits a message report to the administrative moderation team.
window.reportChatMessage = async function (msgId, text) {
    if (confirm("Do you want to report this message to the safety team?")) {
        try {
            await DataService.reportMessage(msgId, _conversationId, _currentChild.$id, _buddyId, text);
            showSafetyWarning("Message reported to safety team. Thank you! 🛡️");
        } catch (e) {
            showSafetyWarning("Failed to report message. Try again later.");
        }
    }
}

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