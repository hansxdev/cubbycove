// CUBBYCHAT LOGIC — Handles the real-time chat interface for kids.
// _currentChild is declared in buddy_logic.js or kid_logic.js
let _buddyId = '';
let _buddyName = '';
let _buddyDocId = '';
let _conversationId = '';
let _unsubscribeChat = null;
let _lastMessageTime = null;
let _knownMessageIds = new Set();
let _lastRenderedMsg = null;
let _isSending = false; // Guard against double-send (e.g., two AI APIs resolving)

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

    const promptText = `You are a strict content moderator for a platform used by elementary school students. 
Check the following message for profanity, cyberbullying, or inappropriate content.

Message: "${text}"

Return a JSON object with exactly two fields:
1. "isSafe" (boolean): true if the message is completely safe, false if it contains profanity or bullying.
2. "reason" (string): a very brief reason for your decision.`;

    // Call the secure Appwrite Function instead of exposing the API key
    try {
        const { functions, FUNCTION_GEMINI_FILTER } = window.AppwriteService;

        const execution = await functions.createExecution(
            FUNCTION_GEMINI_FILTER,
            JSON.stringify({ prompt: promptText }),
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

        // Gemini returns the markdown JSON string in responseData.result
        const evaluationStr = responseData.result.replace(/```json|```/g, '').trim();
        const evaluation = JSON.parse(evaluationStr);

        // Debug log for the reason
        console.log("Gemini Moderation:", evaluation);

        return evaluation.isSafe;

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
    
    // UI toggle logic applied via TDD:
    const nbs = $('no-buddy-state');
    if (nbs) { nbs.classList.add('hidden'); nbs.classList.remove('flex'); }
    const msgs = $('chat-messages');
    if (msgs) { msgs.classList.remove('hidden'); msgs.classList.add('flex'); }
    
    // Explicitly enable typing
    const sendBtn = $('send-btn');
    if (sendBtn) sendBtn.disabled = false;
    const msgInput = $('message-input');
    if (msgInput) { msgInput.disabled = false; msgInput.placeholder = 'Write a message...'; }

    await loadMessageHistory();
    startRealtimeChat();

    $('send-btn').addEventListener('click', sendMessage);
    $('message-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    $('message-input').focus();
    $('buddy-search')?.addEventListener('input', filterBuddySidebar);
    
    $('emoji-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        _toggleEmojiPicker();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// EMOJI PICKER — Floating Kid-Friendly Grid
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI_LIST = [
    '😊','😂','🥰','😎','🤩','😜','😇','🤗','😋','🥳',
    '👍','👏','🙌','🤝','💪','✌️','🤞','🙏','💯','🔥',
    '❤️','💖','💕','🌟','⭐','✨','🎉','🎊','🎈','🏆',
    '🐶','🐱','🦁','🐸','🐥','🐙','🦋','🌈','🌸','🍕',
    '🍦','🍭','🍬','🎮','🚀','🌙','☀️','🌊','🍀','🎵',
];

let _emojiPickerOpen = false;

function _toggleEmojiPicker() {
    const existing = document.getElementById('cubby-emoji-picker');
    if (existing) {
        existing.remove();
        _emojiPickerOpen = false;
        return;
    }
    _emojiPickerOpen = true;
    _openEmojiPicker();
}

function _openEmojiPicker() {
    const btn = $('emoji-btn');
    const input = $('message-input');
    if (!btn || !input) return;

    const picker = document.createElement('div');
    picker.id = 'cubby-emoji-picker';

    // Position it above the emoji button
    const btnRect = btn.getBoundingClientRect();
    picker.style.cssText = `
        position: fixed;
        bottom: ${window.innerHeight - btnRect.top + 8}px;
        left: ${btnRect.left - 60}px;
        z-index: 9999;
        background: white;
        border: 3px solid #e5e7eb;
        border-radius: 20px;
        padding: 12px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.15), 0 4px 0 #e5e7eb;
        display: grid;
        grid-template-columns: repeat(10, 1fr);
        gap: 4px;
        width: 320px;
        max-width: 90vw;
        animation: emojiPickerPop 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    `;

    if (!document.getElementById('emoji-picker-style')) {
        const style = document.createElement('style');
        style.id = 'emoji-picker-style';
        style.textContent = `
            @keyframes emojiPickerPop {
                from { transform: scale(0.85) translateY(8px); opacity: 0; }
                to   { transform: scale(1) translateY(0);     opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    EMOJI_LIST.forEach(emoji => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = emoji;
        btn.style.cssText = `
            font-size: 20px;
            line-height: 1;
            padding: 6px;
            border: none;
            background: transparent;
            cursor: pointer;
            border-radius: 8px;
            transition: background 0.1s, transform 0.1s;
        `;
        btn.addEventListener('mouseenter', () => { btn.style.background = '#f3f4f6'; btn.style.transform = 'scale(1.3)'; });
        btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.transform = 'scale(1)'; });
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Insert emoji at cursor position in the message input
            const msgInput = $('message-input');
            if (msgInput) {
                const start = msgInput.selectionStart;
                const end = msgInput.selectionEnd;
                const text = msgInput.value;
                msgInput.value = text.slice(0, start) + emoji + text.slice(end);
                msgInput.selectionStart = msgInput.selectionEnd = start + emoji.length;
                msgInput.focus();
                // Trigger auto-resize
                msgInput.dispatchEvent(new Event('input'));
            }
            // Close picker after selection
            picker.remove();
            _emojiPickerOpen = false;
        });
        picker.appendChild(btn);
    });

    document.body.appendChild(picker);

    // Close picker on outside click
    const closeOnOutside = (e) => {
        if (!picker.contains(e.target) && e.target !== $('emoji-btn')) {
            picker.remove();
            _emojiPickerOpen = false;
            document.removeEventListener('click', closeOnOutside);
        }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 10);
}

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
               class="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all buddy-item rounded-2xl ${isActive ? 'bg-[#e3ae7d] border-[3px] border-[#9c6a38] shadow-[0_4px_0_#9c6a38] translate-y-[-2px]' : 'hover:bg-[#d2a373] border-[3px] border-transparent'}"
               data-name="${buddy.username.toLowerCase()}">
                ${avatarHtml}
                <div class="flex-1 min-w-0 info mt-1">
                    <h4 class="${isActive ? 'text-[#3b2414] font-black' : 'text-[#5c3a21] font-bold'} truncate text-sm leading-tight">${escapeHtml(buddy.username)}</h4>
                    <p class="text-xs ${isActive ? 'text-[#3b2414] font-bold opacity-80' : 'text-[#8c5a2c]'} truncate drop-shadow-sm">${isActive ? 'Chatting now' : 'Tap to chat'}</p>
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

// Begins the push-based subscription for new incoming chat messages.
function startRealtimeChat() {
    stopRealtimeChat();
    const { COLLECTIONS } = AppwriteService;
    _unsubscribeChat = DataService.subscribeToCollection(COLLECTIONS.CHAT_MESSAGES, response => {
        // Appwrite Realtime response contains: events[], payload{}
        const isCreate = response.events.some(e => e.includes('.create'));
        if (isCreate) {
            const msg = response.payload;
            // Verify message is for this conversation and not already rendered
            if (msg.conversationId === _conversationId && !_knownMessageIds.has(msg.$id)) {
                _knownMessageIds.add(msg.$id);
                const emptyCard = $('empty-chat-msg');
                if (emptyCard) emptyCard.remove();
                renderMessage(msg);
                scrollToBottom();
            }
        }
    });
}

// Terminates the Realtime subscription.
function stopRealtimeChat() {
    if (_unsubscribeChat) {
        _unsubscribeChat(); // client.subscribe returns an unsubscribe function
        _unsubscribeChat = null;
    }
}

// Deprecated: pollNewMessages is no longer used but kept for logic reference if needed
// function pollNewMessages() { ... }

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
    if (_isSending) return; // Prevent double-send from duplicate AI API resolutions
    _isSending = true;

    // ── MUTE CHECK ──────────────────────────────────────────────
    try {
        const muteStatus = await DataService.isChildMuted(_currentChild.$id);
        if (muteStatus.muted) {
            const durEl = $('mute-duration-text');
            if (durEl) durEl.textContent = muteStatus.durationStr;
            $('mute-modal').classList.remove('hidden');
            // Reset the send guard before early return — otherwise the lock stays
            // set permanently and the next send sees _isSending = true even though
            // nothing is actually in-flight, causing the first real send to be missed.
            _isSending = false;
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
        // Log the social interaction so the parent's Activity tab shows it
        DataService.logActivity(
            _currentChild.$id,
            'message_sent',
            `Sent a message to ${_buddyName || 'a buddy'}`,
            { buddyId: _buddyId, conversationId: _conversationId }
        ).catch(() => {});
    } catch (e) {
        showSafetyWarning('Could not send. Check your connection.');
    } finally {
        _isSending = false;
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
        // Log a safety event so the parent activity tab shows it
        DataService.logActivity(
            _currentChild.$id,
            'safety_threat',
            `Reported a ${_pendingViolationType || 'safety'} issue in chat with ${_buddyName || 'a buddy'}`,
            { buddyId: _buddyId, violationType: _pendingViolationType }
        ).catch(() => {});
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

// Formats an ISO date string into a smart localized timestamp:
// - Today's messages: "Today · 3:42 PM"
// - Yesterday's messages: "Yesterday · 9:15 AM"
// - Older messages: "Mon, Jan 6 · 2:30 PM"
function formatTime(isoStr) {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today \u00b7 ${timeStr}`;
    if (isYesterday) return `Yesterday \u00b7 ${timeStr}`;
    const dayStr = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    return `${dayStr} \u00b7 ${timeStr}`;
}

// Safely terminates message polling when the user navigates away from the page.
window.addEventListener('beforeunload', stopRealtimeChat);
window.addEventListener('pagehide', stopRealtimeChat); // stopPolling was removed; realtime is the active transport

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT — State
// ─────────────────────────────────────────────────────────────────────────────
let _activeGroupId   = '';
let _activeGroupName = '';
let _isGroupMode     = false; // true when viewing a group chat instead of a buddy chat
let _pendingLeaveGroupId   = '';
let _pendingLeaveGroupName = '';

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT — Sidebar
// ─────────────────────────────────────────────────────────────────────────────

/** Loads all groups the current child is in and renders them in the sidebar. */
async function loadGroupSidebar() {
    const container = $('chat-group-list');
    if (!container || !_currentChild) return;
    try {
        const groups = await DataService.getGroupChats(_currentChild.$id);
        if (!groups.length) {
            container.innerHTML = `<p class="text-xs text-[#bda389] font-bold text-center py-3">No groups yet.<br>Create one above! 🏕️</p>`;
            return;
        }
        container.innerHTML = groups.map(g => {
            const isActive = g.$id === _activeGroupId;
            return `
            <div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${isActive ? 'bg-[#e3ae7d] border-[3px] border-[#9c6a38] shadow-[0_4px_0_#9c6a38] -translate-y-0.5' : 'bg-white border-[3px] border-[#f2cdab] hover:border-[#d6ad85]'}"
                onclick="openGroupChat('${g.$id}', '${escapeHtml(g.name)}', ${(g.memberIds || []).length})">
                <div class="w-9 h-9 rounded-full bg-[#9c6a38] flex items-center justify-center shrink-0">
                    <i class="fa-solid fa-people-group text-white text-xs"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-black text-[#3d2510] truncate">${escapeHtml(g.name)}</p>
                    <p class="text-[10px] text-[#8a5b2f] font-bold">${(g.memberIds || []).length} members</p>
                </div>
                <button onclick="event.stopPropagation(); openLeaveGroupModal('${g.$id}', '${escapeHtml(g.name)}')"
                    class="text-[#bda389] hover:text-red-400 transition-colors text-xs ml-1 shrink-0" title="Leave group">
                    <i class="fa-solid fa-right-from-bracket"></i>
                </button>
            </div>`;
        }).join('');
    } catch (e) {
        console.warn('[Group Sidebar] Error:', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT — Open / Close
// ─────────────────────────────────────────────────────────────────────────────

/** Switches the main chat area into group mode for the given group. */
async function openGroupChat(groupId, groupName, memberCount) {
    _activeGroupId   = groupId;
    _activeGroupName = groupName;
    _isGroupMode     = true;
    _buddyId         = '';   // Clear buddy mode
    _conversationId  = `group_${groupId}`;

    // Update header
    const avatarEl = $('chat-buddy-avatar');
    if (avatarEl) {
        avatarEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${groupId}`;
        avatarEl.style.backgroundColor = '#9c6a38';
    }
    const nameEl = $('chat-buddy-name');
    if (nameEl) nameEl.textContent = groupName;
    const statusEl = $('chat-status-label');
    if (statusEl) statusEl.textContent = `${memberCount} members`;

    // Show chat area
    const nbs = $('no-buddy-state');
    if (nbs) { nbs.classList.add('hidden'); nbs.classList.remove('flex'); }
    const msgs = $('chat-messages');
    if (msgs) { msgs.classList.remove('hidden'); msgs.classList.add('flex'); }

    const sendBtn = $('send-btn');
    if (sendBtn) sendBtn.disabled = false;
    const msgInput = $('message-input');
    if (msgInput) { msgInput.disabled = false; msgInput.placeholder = `Say something to ${groupName}...`; }

    // Load messages
    const loadingEl = $('chat-loading');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (msgs) msgs.innerHTML = '';
    msgs.appendChild(loadingEl || (() => {
        const d = document.createElement('div'); d.id = 'chat-loading'; return d;
    })());

    _knownMessageIds.clear();
    _lastRenderedMsg = null;
    try {
        const messages = await DataService.getGroupChatMessages(groupId, 50);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (!messages.length) {
            msgs.innerHTML = `<div class="flex flex-col items-center justify-center py-12 text-center"><h3 class="font-extrabold text-gray-700 text-lg mb-1">Be the first to say hi! 👋</h3></div>`;
        } else {
            msgs.innerHTML = '';
            _lastRenderedMsg = null;
            messages.forEach(msg => {
                _knownMessageIds.add(msg.$id);
                renderGroupMessage(msg);
            });
            _lastMessageTime = messages[messages.length - 1].sentAt;
            scrollToBottom();
        }
    } catch (e) {
        if (loadingEl) loadingEl.classList.add('hidden');
        console.error('[Group Chat] Load error:', e.message);
    }

    // Start realtime for group messages
    stopRealtimeChat();
    startGroupRealtimeChat(groupId);

    // Re-render sidebar to highlight active group
    loadGroupSidebar();
}

/** Subscribes to realtime events for a specific group's messages. */
function startGroupRealtimeChat(groupId) {
    const { COLLECTIONS } = AppwriteService;
    _unsubscribeChat = DataService.subscribeToCollection(COLLECTIONS.CHAT_MESSAGES, response => {
        const isCreate = response.events.some(e => e.includes('.create'));
        if (isCreate) {
            const msg = response.payload;
            if (msg.groupId === groupId && !_knownMessageIds.has(msg.$id)) {
                _knownMessageIds.add(msg.$id);
                const emptyCard = $('empty-chat-msg');
                if (emptyCard) emptyCard.remove();
                renderGroupMessage(msg);
                scrollToBottom();
            }
        }
    });
}

/** Renders a group message bubble, showing sender name above each run. */
function renderGroupMessage(msg) {
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
    div.className = `flex ${isMe ? 'justify-end' : 'gap-2 items-end'} mt-1 message-enter`;

    if (isMe) {
        div.innerHTML = `<div class="max-w-[75%] bg-cubby-green rounded-2xl rounded-br-none px-4 py-2 text-white text-sm font-medium break-words">${escapeHtml(msg.text)}</div>`;
    } else {
        const safeText = escapeHtml(msg.text);
        const sender  = escapeHtml(msg.fromUsername || 'Friend');
        const avatarHtml = isGrouped
            ? `<div class="w-8 shrink-0"></div>`
            : `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sender)}" class="w-8 h-8 rounded-full bg-white border border-gray-200 shrink-0">`;
        const senderLabel = isGrouped ? '' : `<p class="text-[10px] font-black text-[#9c6a38] mb-0.5 ml-1">${sender}</p>`;
        div.innerHTML = `${avatarHtml}<div class="max-w-[75%]">${senderLabel}<div class="bg-white rounded-2xl rounded-bl-none px-4 py-2 shadow-sm text-gray-800 text-sm break-words">${safeText}</div></div>`;
    }
    container.appendChild(div);
    _lastRenderedMsg = { fromChildId: msg.fromChildId, sentAt: msg.sentAt };
}

// Override sendMessage to support group mode
const _originalSendMessage = sendMessage;
window._sendGroupIntercepted = async function () {
    if (!_isGroupMode || !_activeGroupId) {
        return _originalSendMessage();
    }
    const input = $('message-input');
    const sendBtn = $('send-btn');
    const text = input.value.trim();
    if (!text || _isSending) return;
    _isSending = true;

    try {
        const muteStatus = await DataService.isChildMuted(_currentChild.$id);
        if (muteStatus.muted) {
            const durEl = $('mute-duration-text');
            if (durEl) durEl.textContent = muteStatus.durationStr;
            $('mute-modal').classList.remove('hidden');
            _isSending = false;
            return;
        }
    } catch (e) { /* ignore */ }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-sm"></i>';

    if (!(await analyzeMessageWithAI(text))) {
        showSafetyWarning();
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
        _isSending = false;
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    const tempId = 'temp_' + Date.now();
    _knownMessageIds.add(tempId);
    renderGroupMessage({ $id: tempId, fromChildId: _currentChild.$id, fromUsername: _currentChild.username, groupId: _activeGroupId, text, sentAt: new Date().toISOString() });
    scrollToBottom();

    try {
        const saved = await DataService.sendGroupMessage(_activeGroupId, _currentChild.$id, _currentChild.username || _currentChild.name, text);
        if (saved?.$id) _knownMessageIds.add(saved.$id);
        DataService.logActivity(_currentChild.$id, 'message_sent', `Sent a message in group ${_activeGroupName}`, { groupId: _activeGroupId }).catch(() => {});
    } catch (e) {
        showSafetyWarning('Could not send. Check your connection.');
    } finally {
        _isSending = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fa-solid fa-paper-plane text-sm"></i>';
        input.focus();
    }
};

// Patch send button to use group-aware version
document.addEventListener('DOMContentLoaded', () => {
    const realSend = () => _isGroupMode ? window._sendGroupIntercepted() : sendMessage();
    const sb = $('send-btn');
    if (sb) {
        sb.removeEventListener('click', sendMessage);
        sb.addEventListener('click', realSend);
    }
    const inp = $('message-input');
    if (inp) {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); realSend(); }
        });
    }
    // Load group sidebar after buddy sidebar loads
    setTimeout(loadGroupSidebar, 1500);
}, { once: true });

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT — Create Group Modal
// ─────────────────────────────────────────────────────────────────────────────

window.openCreateGroupModal = async function () {
    $('create-group-modal').classList.remove('hidden');
    $('new-group-name').value = '';
    $('group-member-count').textContent = '';

    const picker = $('group-buddy-picker');
    picker.innerHTML = `<p class="text-xs text-[#bda389] font-bold">Loading your buddies...</p>`;

    try {
        const buddies = await DataService.getBuddies(_currentChild.$id);
        if (!buddies.length) {
            picker.innerHTML = `<p class="text-xs text-[#bda389] font-bold text-center">You have no buddies yet! Add some first.</p>`;
            return;
        }
        picker.innerHTML = buddies.map(b => `
            <label class="flex items-center gap-3 p-2 rounded-xl hover:bg-[#f2cdab] cursor-pointer transition-all">
                <input type="checkbox" value="${b.childId}" class="group-buddy-check accent-[#9c6a38] w-4 h-4" onchange="updateGroupMemberCount()">
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(b.username)}" class="w-7 h-7 rounded-full">
                <span class="text-sm font-bold text-[#3d2510]">${escapeHtml(b.username)}</span>
            </label>`).join('');
    } catch (e) {
        picker.innerHTML = `<p class="text-xs text-red-400 font-bold">Could not load buddies. Try again.</p>`;
    }
};

window.closeCreateGroupModal = function () {
    $('create-group-modal').classList.add('hidden');
};

window.updateGroupMemberCount = function () {
    const checked = document.querySelectorAll('.group-buddy-check:checked').length;
    const countEl = $('group-member-count');
    if (countEl) countEl.textContent = checked > 0 ? `${checked} buddy selected (+ you = ${checked + 1} members)` : '';
    // Enforce max 9 buddies
    const all = document.querySelectorAll('.group-buddy-check');
    all.forEach(cb => { if (!cb.checked) cb.disabled = checked >= 9; });
};

window.handleCreateGroup = async function () {
    const name = $('new-group-name').value.trim();
    if (!name) { alert('Please give your group a name!'); return; }

    const selectedIds = [...document.querySelectorAll('.group-buddy-check:checked')].map(cb => cb.value);
    if (!selectedIds.length) { alert('Pick at least one buddy to invite!'); return; }

    const btn = $('create-group-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Creating...';

    try {
        const group = await DataService.createGroupChat(name, _currentChild, selectedIds);
        closeCreateGroupModal();
        await loadGroupSidebar();
        openGroupChat(group.$id, group.name, (group.memberIds || []).length);
    } catch (e) {
        alert(e.message || 'Could not create group.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Create Group!';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUP CHAT — Leave Group
// ─────────────────────────────────────────────────────────────────────────────

window.openLeaveGroupModal = function (groupId, groupName) {
    _pendingLeaveGroupId   = groupId;
    _pendingLeaveGroupName = groupName;
    const nameEl = $('leave-group-name');
    if (nameEl) nameEl.textContent = groupName;
    $('leave-group-modal').classList.remove('hidden');
};

window.handleLeaveGroup = async function () {
    const btn = $('confirm-leave-group-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Leaving...'; }
    try {
        await DataService.leaveGroupChat(_pendingLeaveGroupId, _currentChild);
        $('leave-group-modal').classList.add('hidden');
        // If currently viewing this group, go back to no-buddy state
        if (_activeGroupId === _pendingLeaveGroupId) {
            _activeGroupId = '';
            _isGroupMode = false;
            stopRealtimeChat();
            updateChatHeader('', '');
            const nbs = $('no-buddy-state');
            if (nbs) { nbs.classList.remove('hidden'); nbs.classList.add('flex'); }
            const msgs = $('chat-messages');
            if (msgs) { msgs.classList.add('hidden'); msgs.classList.remove('flex'); }
        }
        loadGroupSidebar();
    } catch (e) {
        alert(e.message || 'Could not leave the group.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Yes, Leave'; }
    }
};