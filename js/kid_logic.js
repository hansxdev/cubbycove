// Logic for kid/home_logged_in.html AND kid/games.html AND kid/chat.html

document.addEventListener('DOMContentLoaded', () => {
    // 1. Sidebar Logic (Shared)
    if (typeof initSidebar === 'function') {
        initSidebar();
    } else {
        console.warn('sidebar-logic.js not loaded');
    }
});