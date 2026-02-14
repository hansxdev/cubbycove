// Logic for staff/assistant_panel.html

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Tab Switching Logic
    window.showTab = function(tabName) {
        // Hide all tabs
        ['verification', 'moderation', 'content'].forEach(t => {
            const tab = document.getElementById(`tab-${t}`);
            if (tab) tab.classList.add('hidden');
            
            const nav = document.getElementById(`nav-${t}`);
            if (nav) {
                nav.classList.remove('bg-purple-50', 'text-cubby-purple', 'border-cubby-purple');
                nav.classList.add('text-gray-500', 'border-transparent');
            }
        });

        // Show selected tab
        const selectedTab = document.getElementById(`tab-${tabName}`);
        if (selectedTab) selectedTab.classList.remove('hidden');

        // Update Nav Style
        const activeNav = document.getElementById(`nav-${tabName}`);
        if (activeNav) {
            activeNav.classList.add('bg-purple-50', 'text-cubby-purple', 'border-cubby-purple');
            activeNav.classList.remove('text-gray-500', 'border-transparent');
        }

        // Update Title
        const titles = {
            'verification': 'Pending Verifications',
            'moderation': 'Chat Reports',
            'content': 'Video Content Review'
        };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.innerText = titles[tabName];
    };

    // 2. Verification Actions
    window.approveItem = function(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => {
                card.style.display = 'none';
                checkEmptyState();
                console.log(`Approved Parent Verification: ${cardId}`);
            }, 500);
        }
    };

    window.rejectItem = function(cardId) {
        if(confirm("Reject this ID? The parent will be notified to re-upload.")) {
            const card = document.getElementById(cardId);
            if (card) {
                card.classList.add('opacity-0', 'transition-opacity', 'duration-500');
                setTimeout(() => {
                    card.style.display = 'none';
                    checkEmptyState();
                    console.log(`Rejected Parent Verification: ${cardId}`);
                }, 500);
            }
        }
    };

    function checkEmptyState() {
        const cards = document.querySelectorAll('#tab-verification .dashboard-card');
        let allHidden = true;
        cards.forEach(card => {
            if (card.style.display !== 'none') allHidden = false;
        });

        const emptyState = document.getElementById('verify-empty');
        if (allHidden && emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.classList.add('flex');
        }
    }

    // 3. Moderation Actions (Chat)
    window.dismissItem = function(cardId) {
        const card = document.getElementById(cardId);
        if (card) card.remove();
    };

    window.warnUser = function(cardId) {
        alert("Warning sent to user.");
        const card = document.getElementById(cardId);
        if (card) card.remove();
    };

    window.banUser = function(cardId) {
        if(confirm("Permanently ban this user from chat?")) {
            alert("User banned.");
            const card = document.getElementById(cardId);
            if (card) card.remove();
        }
    };

    // 4. Content Review Actions (Creator Videos)
    window.approveContent = function(cardId) {
        const card = document.getElementById(cardId);
        if (card) {
            card.style.transition = 'opacity 0.3s ease';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                // In real app: API call to update status to 'Published'
                console.log(`Approved Content: ${cardId}`);
            }, 300);
            alert("Video Approved! It is now live on CubbyCove.");
        }
    };

    window.rejectContent = function(cardId) {
        if(confirm("Reject this video? Creator will be notified.")) {
            const card = document.getElementById(cardId);
            if (card) {
                card.style.transition = 'opacity 0.3s ease';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.remove();
                    // In real app: API call to update status to 'Rejected'
                    console.log(`Rejected Content: ${cardId}`);
                }, 300);
            }
        }
    };
});