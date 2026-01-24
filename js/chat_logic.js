// Logic for kid/chat.html

document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const safetyToast = document.getElementById('safety-toast');

    // Simple "Bad Words" List for Demo
    const badWords = ['stupid', 'ugly', 'hate', 'dumb', 'idiot'];

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        // 1. Check Safety (Filtering)
        const hasBadWord = badWords.some(word => text.toLowerCase().includes(word));

        if (hasBadWord) {
            showSafetyWarning();
            return;
        }

        // 2. Add Message Bubble (Me)
        addMessageBubble(text, 'me');

        // 3. Clear Input
        messageInput.value = '';
        
        // 4. Simulate Reply (after 1.5s)
        setTimeout(() => {
            const replies = ["Cool!", "That's funny 😂", "Okay!", "See you soon!"];
            const randomReply = replies[Math.floor(Math.random() * replies.length)];
            addMessageBubble(randomReply, 'friend');
        }, 1500);
    }

    function addMessageBubble(text, sender) {
        const div = document.createElement('div');
        div.className = sender === 'me' ? 'flex gap-3 justify-end message-enter' : 'flex gap-3 message-enter';
        
        if (sender === 'me') {
            div.innerHTML = `
                <div class="max-w-[75%] bg-cubby-green p-3 rounded-2xl rounded-br-none shadow-md text-white text-sm leading-relaxed font-medium">
                    ${escapeHtml(text)}
                </div>
            `;
        } else {
            div.innerHTML = `
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Annie" class="w-8 h-8 rounded-full bg-white border border-gray-200 self-end mb-1">
                <div class="max-w-[75%] bg-white p-3 rounded-2xl rounded-bl-none shadow-sm text-gray-800 text-sm leading-relaxed">
                    ${escapeHtml(text)}
                </div>
            `;
        }

        chatMessages.appendChild(div);
        scrollToBottom();
    }

    function showSafetyWarning() {
        safetyToast.classList.remove('hidden');
        setTimeout(() => {
            safetyToast.classList.add('hidden');
        }, 3000);
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Helper to prevent HTML injection
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Event Listeners
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Initial Scroll
    scrollToBottom();
});