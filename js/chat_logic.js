/**
 * CUBBYCHAT LOGIC — kid/chat.html
 *
 * Features:
 *  • Reads URL params (buddyId, buddyName, buddyDocId) set by buddy_logic.js
 *  • Populates chat header + sidebar with real buddy info
 *  • Loads past Appwrite messages via DataService.getChatMessages()
 *  • Sends new messages via DataService.sendChatMessage()
 *  • Polls every 2 seconds for new messages (kids have no Appwrite Auth session,
 *    so Appwrite Realtime WebSocket cannot authenticate — polling is the reliable fix)
 *  • Client-side bad-word filter with safety toast
 */

// ── State ────────────────────────────────────────────────────────────────────
let _currentChild = null;
let _buddyId = '';      // childId of the buddy from URL param
let _buddyName = '';      // display name from URL param
let _buddyDocId = '';      // buddies doc ID from URL param
let _conversationId = '';      // stable "<idA>_<idB>" sorted string
let _pollInterval = null;    // setInterval handle for message polling
let _lastMessageTime = null;    // ISO string — only fetch messages newer than this
let _knownMessageIds = new Set(); // dedup guard so we never render the same msg twice
let _lastRenderedMsg = null;    // { fromChildId, sentAt } — used for grouping logic

const POLL_MS = 2000;  // check for new messages every 2 seconds
const GROUP_MS = 60000; // messages within 60s from same sender are grouped

// ── Bad-word list ─────────────────────────────────────────────────────────────
const BAD_WORDS = ['stupid', 'ugly', 'hate', 'dumb', 'idiot', 'kill', 'die', 'shut up'];

// ── Tiny DOM helper ───────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ══════════════════════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

    // 1. Child session guard
    const raw = sessionStorage.getItem('cubby_child_session');
    if (!raw) { window.location.href = '../login.html'; return; }
    _currentChild = JSON.parse(raw);

    // 2. Parse URL params
    const params = new URLSearchParams(window.location.search);
    _buddyId = params.get('buddyId') || '';
    _buddyName = params.get('buddyName') || '';
    _buddyDocId = params.get('buddyDocId') || '';

    // 3. Populate the sidebar buddy list
    loadChatBuddySidebar();

    // 4. No buddy selected — show picker UI
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

    // 5. Populate header
    updateChatHeader(_buddyId, _buddyName);

    // 6. Stable conversation ID
    _conversationId = DataService._buildConversationId(_currentChild.$id, _buddyId);

    // 7. Load history (initial full load)
    await loadMessageHistory();

    // 8. Start polling for new messages
    startPolling();

    // 9. Wire send button + Enter key
    $('send-btn').addEventListener('click', sendMessage);
    $('message-input').addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });

    // 10. Focus input
    $('message-input').focus();

    // 11. Sidebar search filter
    $('buddy-search')?.addEventListener('input', filterBuddySidebar);
});

// ══════════════════════════════════════════════════════════════════════════════
// CHAT HEADER
// ══════════════════════════════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════════════════════════════
// BUDDY SIDEBAR (inside chat page)
// ══════════════════════════════════════════════════════════════════════════════
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
                    ${isActive
                    ? '<p class="text-xs text-cubby-green font-semibold">Chatting now</p>'
                    : '<p class="text-xs text-gray-400 truncate">Tap to chat</p>'}
                </div>
                ${isActive ? '<span class="w-2 h-2 bg-cubby-green rounded-full shrink-0"></span>' : ''}
            </a>`;
        }).join('');

    } catch (e) {
        console.warn('loadChatBuddySidebar error:', e.message);
    }
}

function filterBuddySidebar(e) {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.buddy-item').forEach(el => {
        el.style.display = (el.dataset.name || '').includes(q) ? '' : 'none';
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// INITIAL HISTORY LOAD
// ══════════════════════════════════════════════════════════════════════════════
async function loadMessageHistory() {
    const loadingEl = $('chat-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    const container = $('chat-messages');

    try {
        const messages = await DataService.getChatMessages(_conversationId, 50);
        if (loadingEl) loadingEl.classList.add('hidden');

        if (messages.length === 0) {
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

        // Render all history messages
        container.innerHTML = '';
        _lastRenderedMsg = null; // reset grouping state for fresh render
        messages.forEach(msg => {
            _knownMessageIds.add(msg.$id);
            renderMessage(msg);
        });

        // Track the latest timestamp so polling knows where to start
        _lastMessageTime = messages[messages.length - 1].sentAt;

        scrollToBottom();

    } catch (e) {
        if (loadingEl) loadingEl.innerHTML = `
            <div class="text-center text-red-400 text-sm py-8">
                <i class="fa-solid fa-circle-exclamation text-xl mb-2 block"></i>
                Could not load messages. Check your connection.
            </div>`;
        console.error('loadMessageHistory error:', e.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// POLLING — replaces Appwrite Realtime (works without an auth session)
// ══════════════════════════════════════════════════════════════════════════════
function startPolling() {
    stopPolling(); // clear any stale interval first
    _pollInterval = setInterval(pollNewMessages, POLL_MS);
    console.log(`✅ [CubbyChat] Polling every ${POLL_MS}ms for new messages`);
}

function stopPolling() {
    if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}

async function pollNewMessages() {
    if (!_conversationId) return;

    try {
        // Fetch the most recent batch; we'll filter client-side by ID
        const messages = await DataService.getChatMessages(_conversationId, 25);

        let addedAny = false;
        messages.forEach(msg => {
            if (_knownMessageIds.has(msg.$id)) return; // already rendered
            _knownMessageIds.add(msg.$id);

            // Remove the "say hi" placeholder if still showing
            const emptyCard = $('empty-chat-msg');
            if (emptyCard) emptyCard.remove();

            renderMessage(msg);
            addedAny = true;

            // Update last-seen timestamp
            if (!_lastMessageTime || msg.sentAt > _lastMessageTime) {
                _lastMessageTime = msg.sentAt;
            }
        });

        if (addedAny) scrollToBottom();

    } catch (e) {
        // Silent — don't spam the user, just wait for next poll
        console.warn('[CubbyChat] Poll error:', e.message);
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// RENDER A SINGLE MESSAGE (with grouping & time separators)
// ══════════════════════════════════════════════════════════════════════════════
function renderMessage(msg) {
    if (!msg || !msg.text) return;

    const isMe = msg.fromChildId === _currentChild.$id;
    const container = $('chat-messages');

    // ── Grouping decision ────────────────────────────────────────────────────
    const prev = _lastRenderedMsg;
    const sameSender = prev && prev.fromChildId === msg.fromChildId;
    const gapMs = prev && msg.sentAt && prev.sentAt
        ? (new Date(msg.sentAt) - new Date(prev.sentAt))
        : Infinity;
    const isGrouped = sameSender && gapMs < GROUP_MS;

    // ── Time separator ───────────────────────────────────────────────────────
    // Show on very first message OR when >= 1 min passes between any two messages
    if (!prev || gapMs >= GROUP_MS) {
        const sep = document.createElement('div');
        sep.className = 'text-center my-3';
        sep.innerHTML = `<span class="bg-gray-100 text-gray-400 text-[10px] font-bold px-3 py-1 rounded-full">
            ${formatTime(msg.sentAt)}
        </span>`;
        container.appendChild(sep);
    }

    // ── Build bubble ─────────────────────────────────────────────────────────
    const div = document.createElement('div');
    div.dataset.msgId = msg.$id || '';

    // Vertical margin: tight inside a group, small gap at group start
    const marginTop = isGrouped ? 'mt-0.5' : 'mt-1';

    if (isMe) {
        // My messages — right aligned, green bubble
        // Connected corner: top-right (when grouped the connecting edge flattens)
        const bubble = isGrouped
            ? 'rounded-tl-2xl rounded-bl-2xl rounded-tr-sm rounded-br-none'
            : 'rounded-2xl rounded-br-none';

        div.className = `flex justify-end ${marginTop} message-enter`;
        div.innerHTML = `
            <div class="max-w-[75%] bg-cubby-green ${bubble} px-4 py-2 shadow-sm text-white text-sm leading-relaxed font-medium">
                ${escapeHtml(msg.text)}
            </div>`;

    } else {
        // Buddy messages — left aligned, white bubble
        // Connected corner: top-left (when grouped)
        const bubble = isGrouped
            ? 'rounded-tr-2xl rounded-br-2xl rounded-tl-sm rounded-bl-none'
            : 'rounded-2xl rounded-bl-none';

        div.className = `flex gap-2 items-end ${marginTop} message-enter`;

        if (isGrouped) {
            // No repeated avatar — use an invisible spacer to keep alignment
            div.innerHTML = `
                <div class="w-8 shrink-0"></div>
                <div class="max-w-[75%] bg-white ${bubble} px-4 py-2 shadow-sm text-gray-800 text-sm leading-relaxed">
                    ${escapeHtml(msg.text)}
                </div>`;
        } else {
            div.innerHTML = `
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(msg.fromUsername || _buddyName)}"
                    class="w-8 h-8 rounded-full bg-white border border-gray-200 shrink-0">
                <div class="max-w-[75%] bg-white ${bubble} px-4 py-2 shadow-sm text-gray-800 text-sm leading-relaxed">
                    ${escapeHtml(msg.text)}
                </div>`;
        }
    }

    container.appendChild(div);

    // Update grouping tracker
    _lastRenderedMsg = { fromChildId: msg.fromChildId, sentAt: msg.sentAt };
}

// ══════════════════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ══════════════════════════════════════════════════════════════════════════════
async function sendMessage() {
    const input = $('message-input');
    const sendBtn = $('send-btn');
    const text = input.value.trim();

    if (!text || !_conversationId || !_currentChild) return;

    // Bad-word check
    if (BAD_WORDS.some(w => text.toLowerCase().includes(w))) {
        showSafetyWarning();
        return;
    }

    // Clear input immediately for snappy UX
    input.value = '';
    sendBtn.disabled = true;

    // Optimistic render — show the message right away, before DB save
    const tempId = 'temp_' + Date.now();
    const tempMsg = {
        $id: tempId,
        conversationId: _conversationId,
        fromChildId: _currentChild.$id,
        fromUsername: _currentChild.username || _currentChild.name,
        text,
        sentAt: new Date().toISOString()
    };
    _knownMessageIds.add(tempId); // mark so pollNewMessages skips this temp bubble

    // Remove placeholder if showing
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
        // Register the real DB id so the next poll doesn't render a duplicate
        if (saved && saved.$id) {
            _knownMessageIds.add(saved.$id);
            _lastMessageTime = saved.sentAt || tempMsg.sentAt;
        }
    } catch (e) {
        console.error('sendMessage error:', e.message);
        showSafetyWarning('Could not send. Check your connection.');
    } finally {
        sendBtn.disabled = false;
        input.focus();
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════
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

function formatTime(isoStr) {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Stop polling when the user leaves the page (saves resources)
window.addEventListener('beforeunload', stopPolling);
window.addEventListener('pagehide', stopPolling);