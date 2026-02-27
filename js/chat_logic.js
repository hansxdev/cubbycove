/**
 * CUBBYCHAT LOGIC — kid/chat.html
 *
 * Features:
 *  • Reads URL params (buddyId, buddyName, buddyDocId) set by buddy_logic.js
 *  • Populates the chat header + sidebar with real buddy info
 *  • Loads past Appwrite messages via DataService.getChatMessages()
 *  • Sends new messages via DataService.sendChatMessage()
 *  • Listens for incoming messages via Appwrite Realtime (DataService.subscribeToChatMessages)
 *  • Client-side bad-word filter with safety toast
 */

// ── State ────────────────────────────────────────────────────────────────────
let _currentChild = null;
let _buddyId = null;       // childId of the buddy in the URL
let _buddyName = '';       // display name
let _buddyDocId = '';      // buddies collection doc ID (for unfriend if needed)
let _conversationId = '';  // stable conv ID derived from both child IDs
let _unsubscribeChat = null; // Appwrite Realtime unsubscribe fn
let _knownMessageIds = new Set(); // prevent duplicate rendering

// ── Bad-word list (shared, conservative) ─────────────────────────────────────
const BAD_WORDS = ['stupid', 'ugly', 'hate', 'dumb', 'idiot', 'kill', 'die', 'shut up'];

// ── DOM shorthand helpers ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Get current child session
    const session = sessionStorage.getItem('cubby_child_session');
    if (!session) {
        window.location.href = '../login.html';
        return;
    }
    _currentChild = JSON.parse(session);

    // 2. Read URL params
    const params = new URLSearchParams(window.location.search);
    _buddyId = params.get('buddyId') || '';
    _buddyName = params.get('buddyName') || '';
    _buddyDocId = params.get('buddyDocId') || '';

    // 3. Load buddy list in sidebar
    loadChatBuddySidebar();

    // 4. If no buddy selected, show picker state
    if (!_buddyId) {
        $('chat-loading').classList.add('hidden');
        $('no-buddy-state').classList.remove('hidden');
        $('no-buddy-state').classList.add('flex');
        $('send-btn').disabled = true;
        $('message-input').disabled = true;
        $('message-input').placeholder = 'Pick a buddy first...';
        updateChatHeader('', '');
        return;
    }

    // 5. Update chat header with buddy info
    updateChatHeader(_buddyId, _buddyName);

    // 6. Build conversation ID
    _conversationId = DataService._buildConversationId(_currentChild.$id, _buddyId);

    // 7. Load history
    await loadMessageHistory();

    // 8. Subscribe to real-time messages
    setupRealtimeChat();

    // 9. Wire up send button + enter key
    $('send-btn').addEventListener('click', sendMessage);
    $('message-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });

    // 10. Focus
    $('message-input').focus();

    // 11. Sidebar search filter
    $('buddy-search')?.addEventListener('input', filterBuddySidebar);
});

// ── Header update ─────────────────────────────────────────────────────────────
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

// ── Load buddy sidebar in chat ────────────────────────────────────────────────
async function loadChatBuddySidebar() {
    const container = $('chat-buddy-list');
    if (!container || !_currentChild) return;

    try {
        const buddies = await DataService.getBuddies(_currentChild.$id);

        if (buddies.length === 0) {
            container.innerHTML = `
                <div class="text-center py-6 px-4">
                    <i class="fa-solid fa-user-group text-gray-200 text-3xl mb-2"></i>
                    <p class="text-xs text-gray-400 font-semibold">No buddies yet!</p>
                    <a href="home_logged_in.html" class="text-xs text-cubby-blue font-bold hover:underline mt-1 block">Add some!</a>
                </div>`;
            return;
        }

        container.innerHTML = buddies.map(buddy => {
            const isActive = buddy.childId === _buddyId;
            return `
            <a href="chat.html?buddyId=${encodeURIComponent(buddy.childId)}&buddyName=${encodeURIComponent(buddy.username)}&buddyDocId=${encodeURIComponent(buddy.buddyDocId)}"
               class="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all sidebar-link buddy-item ${isActive ? 'bg-cubby-green/10' : 'hover:bg-gray-50'}"
               data-name="${buddy.username.toLowerCase()}">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(buddy.username)}"
                    class="w-10 h-10 rounded-full bg-white border border-gray-200">
                <div class="flex-1 min-w-0 sidebar-label whitespace-nowrap overflow-hidden transition-all duration-300">
                    <h4 class="font-bold ${isActive ? 'text-cubby-green' : 'text-gray-800'} truncate text-sm">${buddy.username}</h4>
                    ${isActive ? '<p class="text-xs text-cubby-green font-semibold">Chatting now</p>' : '<p class="text-xs text-gray-400 truncate">Tap to chat</p>'}
                </div>
                ${isActive ? '<span class="w-2 h-2 bg-cubby-green rounded-full shrink-0"></span>' : ''}
            </a>`;
        }).join('');

    } catch (e) {
        console.warn('Could not load buddy sidebar:', e.message);
        container.innerHTML = '<p class="text-xs text-gray-400 p-4">Could not load buddies.</p>';
    }
}

function filterBuddySidebar(e) {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.buddy-item').forEach(el => {
        const name = el.dataset.name || '';
        el.style.display = name.includes(q) ? '' : 'none';
    });
}

// ── Load message history ──────────────────────────────────────────────────────
async function loadMessageHistory() {
    $('chat-loading').classList.remove('hidden');
    const container = $('chat-messages');

    try {
        const messages = await DataService.getChatMessages(_conversationId, 50);
        $('chat-loading').classList.add('hidden');

        if (messages.length === 0) {
            // Show welcome card
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center" id="empty-chat-msg">
                    <div class="w-16 h-16 bg-cubby-green/10 text-cubby-green rounded-full flex items-center justify-center text-3xl mb-3">
                        <i class="fa-solid fa-hand-sparkles"></i>
                    </div>
                    <h3 class="font-extrabold text-gray-700 text-lg mb-1">Say hi to ${escapeHtml(_buddyName)}! 👋</h3>
                    <p class="text-sm text-gray-400 max-w-xs">You two haven't chatted yet. Send the first message!</p>
                </div>`;
            return;
        }

        // Render existing messages
        container.innerHTML = '';
        messages.forEach(msg => renderMessage(msg));
        scrollToBottom();

    } catch (e) {
        $('chat-loading').innerHTML = `
            <div class="text-center text-red-400 text-sm py-8">
                <i class="fa-solid fa-circle-exclamation text-xl mb-2"></i>
                <p>Could not load messages. Are you connected to the internet?</p>
            </div>`;
        console.error('loadMessageHistory error:', e.message);
    }
}

// ── Appwrite Realtime subscription ────────────────────────────────────────────
function setupRealtimeChat() {
    if (!window.AppwriteService) return;
    const { DB_ID } = window.AppwriteService;

    // Unsubscribe any previous listener
    if (_unsubscribeChat) { try { _unsubscribeChat(); } catch (e) { } }

    _unsubscribeChat = DataService.subscribeToChatMessages(
        _conversationId,
        DB_ID,
        (newMsg) => {
            // Avoid duplicates (we already rendered optimistically on send)
            if (_knownMessageIds.has(newMsg.$id)) return;
            _knownMessageIds.add(newMsg.$id);

            // Remove the "say hi" card if present
            const emptyCard = $('empty-chat-msg');
            if (emptyCard) emptyCard.remove();

            renderMessage(newMsg);
            scrollToBottom();
        }
    );

    console.log('✅ [CubbyChat] Real-time subscription active');
}

// ── Render a single message ────────────────────────────────────────────────────
function renderMessage(msg) {
    const isMe = msg.fromChildId === _currentChild.$id;
    const container = $('chat-messages');

    const div = document.createElement('div');
    div.className = isMe ? 'flex gap-3 justify-end message-enter' : 'flex gap-3 message-enter';
    div.dataset.msgId = msg.$id || '';

    const timeStr = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    if (isMe) {
        div.innerHTML = `
            <div class="flex flex-col items-end gap-1 max-w-[75%]">
                <div class="bg-cubby-green p-3 rounded-2xl rounded-br-none shadow-md text-white text-sm leading-relaxed font-medium">
                    ${escapeHtml(msg.text)}
                </div>
                <span class="text-[10px] text-gray-400 mr-1">${timeStr}</span>
            </div>`;
    } else {
        div.innerHTML = `
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.fromUsername || _buddyName)}"
                class="w-8 h-8 rounded-full bg-white border border-gray-200 self-end mb-1 shrink-0">
            <div class="flex flex-col gap-1 max-w-[75%]">
                <div class="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm text-gray-800 text-sm leading-relaxed">
                    ${escapeHtml(msg.text)}
                </div>
                <span class="text-[10px] text-gray-400 ml-1">${timeStr}</span>
            </div>`;
    }

    container.appendChild(div);
}

// ── Send a message ────────────────────────────────────────────────────────────
async function sendMessage() {
    const input = $('message-input');
    const sendBtn = $('send-btn');
    const text = input.value.trim();

    if (!text || !_conversationId) return;
    if (!_currentChild) return;

    // Bad-word check
    const hasBadWord = BAD_WORDS.some(w => text.toLowerCase().includes(w));
    if (hasBadWord) {
        showSafetyWarning();
        return;
    }

    // Disable input briefly
    input.value = '';
    sendBtn.disabled = true;

    // Optimistic render (before persisting)
    const tempId = 'temp_' + Date.now();
    const tempMsg = {
        $id: tempId,
        conversationId: _conversationId,
        fromChildId: _currentChild.$id,
        fromUsername: _currentChild.username || _currentChild.name,
        text,
        sentAt: new Date().toISOString()
    };
    _knownMessageIds.add(tempId);

    // Remove the "say hi" card if present
    const emptyCard = $('empty-chat-msg');
    if (emptyCard) emptyCard.remove();

    renderMessage(tempMsg);
    scrollToBottom();

    try {
        const saved = await DataService.sendChatMessage(
            _conversationId,
            _currentChild.$id,
            _currentChild.username || _currentChild.name,
            text
        );
        // Track the real ID so the realtime event is deduplicated
        if (saved && saved.$id) _knownMessageIds.add(saved.$id);
    } catch (e) {
        console.error('sendMessage error:', e.message);
        // Show error in UI but keep the optimistic bubble
        showSafetyWarning('Could not send. Check your connection.');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showSafetyWarning(msg) {
    const toast = $('safety-toast');
    if (!toast) return;
    const span = toast.querySelector('span');
    if (span) span.textContent = msg || "That message isn't nice! Please be kind. 💛";
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function scrollToBottom() {
    const c = $('chat-messages');
    if (c) c.scrollTop = c.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (_unsubscribeChat) try { _unsubscribeChat(); } catch (e) { }
});