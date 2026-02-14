// Sidebar Logic
if (typeof initSidebar === 'function') {
    initSidebar();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof initSidebar === 'function') initSidebar();
    });
}

// Modal Logic
const loginModal = document.getElementById('login-modal');
const modalTitle = document.getElementById('modal-title');

function showLoginModal(featureName) {
    if (featureName) {
        modalTitle.innerText = featureName;
    } else {
        modalTitle.innerText = "Want to do more?";
    }
    if (loginModal) loginModal.classList.remove('hidden');
}

function closeLoginModal() {
    if (loginModal) loginModal.classList.add('hidden');
}