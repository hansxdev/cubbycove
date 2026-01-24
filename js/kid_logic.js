// Logic for kid/home_logged_in.html AND kid/games.html AND kid/chat.html

document.addEventListener('DOMContentLoaded', () => {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('main-content');
    const body = document.body;

    // 1. Sidebar Toggle Logic
    function toggleMenu() {
        const isDesktop = window.innerWidth >= 1024;
        
        if (isDesktop) {
            // Desktop: Toggle margin and visibility class
            const isVisible = sidebar.classList.contains('lg:translate-x-0');
            if (isVisible) {
                // Close
                sidebar.classList.remove('lg:translate-x-0');
                sidebar.classList.add('-translate-x-full');
                if(mainContent) mainContent.classList.remove('lg:ml-64');
            } else {
                // Open
                sidebar.classList.add('lg:translate-x-0');
                sidebar.classList.remove('-translate-x-full');
                if(mainContent) mainContent.classList.add('lg:ml-64');
            }
        } else {
            // Mobile: Toggle overlay
            const isHidden = sidebar.classList.contains('-translate-x-full');
            if (isHidden) {
                // Open
                sidebar.classList.remove('-translate-x-full');
                if(overlay) overlay.classList.remove('hidden');
                body.style.overflow = 'hidden';
            } else {
                // Close
                sidebar.classList.add('-translate-x-full');
                if(overlay) overlay.classList.add('hidden');
                body.style.overflow = 'auto';
            }
        }
    }

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    // 2. Resize Reset
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            // Force open sidebar on resize to desktop if it wasn't explicitly closed by user logic 
            // (Simpler: just ensure default state is restored)
            if (!sidebar.classList.contains('lg:translate-x-0')) {
                sidebar.classList.add('lg:translate-x-0');
                sidebar.classList.remove('-translate-x-full');
                if(mainContent) mainContent.classList.add('lg:ml-64');
            }
            if(overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        } else {
            // Force hide on mobile resize
            sidebar.classList.remove('lg:translate-x-0');
            sidebar.classList.add('-translate-x-full');
            if(mainContent) mainContent.classList.remove('lg:ml-64'); 
            if(overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        }
    });
});