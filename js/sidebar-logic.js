function initSidebar() {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('main-content');
    const body = document.body;

    if (!menuBtn || !sidebar) return;

    function toggleMenu() {
        const isDesktop = window.innerWidth >= 1024;

        if (isDesktop) {
            // Desktop: Toggle margin and visibility class
            const isVisible = sidebar.classList.contains('lg:translate-x-0');
            if (isVisible) {
                // Close
                sidebar.classList.remove('lg:translate-x-0');
                sidebar.classList.add('-translate-x-full');
                if (mainContent) mainContent.classList.remove('lg:ml-64');
            } else {
                // Open
                sidebar.classList.add('lg:translate-x-0');
                sidebar.classList.remove('-translate-x-full');
                if (mainContent) mainContent.classList.add('lg:ml-64');
            }
        } else {
            // Mobile: Toggle overlay
            const isHidden = sidebar.classList.contains('-translate-x-full');
            if (isHidden) {
                // Open
                sidebar.classList.remove('-translate-x-full');
                if (overlay) overlay.classList.remove('hidden');
                body.style.overflow = 'hidden';
            } else {
                // Close
                sidebar.classList.add('-translate-x-full');
                if (overlay) overlay.classList.add('hidden');
                body.style.overflow = 'auto';
            }
        }
    }

    menuBtn.addEventListener('click', toggleMenu);
    if (overlay) overlay.addEventListener('click', toggleMenu);

    // Resize Reset
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            if (!sidebar.classList.contains('lg:translate-x-0')) {
                sidebar.classList.add('lg:translate-x-0');
                sidebar.classList.remove('-translate-x-full');
                if (mainContent) mainContent.classList.add('lg:ml-64');
            }
            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        } else {
            sidebar.classList.remove('lg:translate-x-0');
            sidebar.classList.add('-translate-x-full');
            if (mainContent) mainContent.classList.remove('lg:ml-64');
            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        }
    });
}
