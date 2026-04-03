function initSidebar() {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('main-content');
    const topNav = document.getElementById('top-nav');
    const body = document.body;

    if (!menuBtn || !sidebar) return;

    // Initialize Logo Paths
    const logoLong = document.getElementById('logo-long');
    const logoClosed = document.getElementById('logo-closed');

    if (logoLong && logoClosed) {
        let imgPath = 'images/';
        const path = window.location.pathname;
        if (path.includes('/kid/') || path.includes('/parent/') || path.includes('/staff/') || path.includes('/creator/')) {
            imgPath = '../images/';
        }
        logoLong.src = imgPath + 'longlogo.png';
        logoClosed.src = imgPath + 'closedlogo.png';
    }

    function updateLogo(isClosed) {
        const logoLong = document.getElementById('logo-long');
        const logoClosed = document.getElementById('logo-closed');
        const logoContainer = document.getElementById('logo-container');

        if (logoLong && logoClosed) {
            if (isClosed) {
                // Show Closed, Hide Long
                logoLong.classList.add('opacity-0', 'scale-50');
                logoLong.classList.remove('opacity-100', 'scale-100');

                logoClosed.classList.add('opacity-100', 'scale-100');
                logoClosed.classList.remove('opacity-0', 'scale-50');
            } else {
                // Show Long, Hide Closed
                logoLong.classList.add('opacity-100', 'scale-100');
                logoLong.classList.remove('opacity-0', 'scale-50');

                logoClosed.classList.add('opacity-0', 'scale-50');
                logoClosed.classList.remove('opacity-100', 'scale-100');
            }
        }
    }

    function toggleMenu() {
        const isDesktop = window.innerWidth >= 1024;

        if (isDesktop) {
            // Desktop: Toggle Width (Mini vs Full)
            const isFullWidth = sidebar.classList.contains('w-[17.5rem]');

            const labels = sidebar.querySelectorAll('.sidebar-label');
            const headers = sidebar.querySelectorAll('.sidebar-header');
            const promos = sidebar.querySelectorAll('.sidebar-promo');
            const links = sidebar.querySelectorAll('.sidebar-link');
            const status = sidebar.querySelectorAll('.sidebar-status');
            const hideMini = sidebar.querySelectorAll('.sidebar-hide-mini');

            if (isFullWidth) {
                // COLLAPSE
                sidebar.classList.remove('w-[17.5rem]');
                sidebar.classList.add('w-[6rem]'); // Minimizing to 6rem width

                if (mainContent && mainContent.classList.contains('lg:ml-[17.5rem]')) {
                    mainContent.classList.remove('lg:ml-[17.5rem]');
                    mainContent.classList.add('lg:ml-[6rem]');
                }

                if (topNav && topNav.classList.contains('lg:left-[18.25rem]')) {
                    topNav.classList.remove('lg:left-[18.25rem]');
                    topNav.classList.add('lg:left-[6.75rem]');
                }

                // Animate Labels Out
                labels.forEach(el => {
                    el.classList.add('w-0', 'opacity-0', 'translate-x-[-10px]');
                });

                // Hide Headers & Promos (Collapse Height)
                [...headers, ...promos].forEach(el => {
                    el.classList.add('max-h-0', 'opacity-0', 'mt-0', 'mb-0', 'p-0', 'border-0');
                    // Handle HRs if needed or just let them stay? 
                    // HRs usually have margin, so we might want to hide them too or give them a class.
                    // For now, let's just accept HRs might look weird or just hide promos.
                });

                // Completely hide specific sections (like friends list container)
                hideMini.forEach(el => {
                    el.classList.add('max-h-0', 'opacity-0', 'p-0', 'border-0', 'mt-0', 'mb-0');
                });

                // Center Icons by removing gap and padding
                links.forEach(el => {
                    el.classList.remove('gap-4', 'px-4');
                    el.classList.add('justify-center', 'px-0');
                });

                // Hide status dots
                status.forEach(el => el.classList.add('opacity-0', 'w-0'));

                updateLogo(true);
            } else {
                // EXPAND
                sidebar.classList.remove('w-[6rem]');
                sidebar.classList.add('w-[17.5rem]');

                if (mainContent && mainContent.classList.contains('lg:ml-[6rem]')) {
                    mainContent.classList.remove('lg:ml-[6rem]');
                    mainContent.classList.add('lg:ml-[17.5rem]');
                }

                if (topNav && topNav.classList.contains('lg:left-[6.75rem]')) {
                    topNav.classList.remove('lg:left-[6.75rem]');
                    topNav.classList.add('lg:left-[18.25rem]');
                }

                // Animate Labels In
                labels.forEach(el => {
                    el.classList.remove('w-0', 'opacity-0', 'translate-x-[-10px]');
                });

                // Show Headers & Promos
                [...headers, ...promos].forEach(el => {
                    el.classList.remove('max-h-0', 'opacity-0', 'mt-0', 'mb-0', 'p-0', 'border-0');
                });

                // Show hidden mini sections
                hideMini.forEach(el => {
                    el.classList.remove('max-h-0', 'opacity-0', 'p-0', 'border-0', 'mt-0', 'mb-0');
                });

                // Restore Links
                links.forEach(el => {
                    el.classList.remove('justify-center', 'px-0');
                    el.classList.add('gap-4', 'px-4');
                });

                // Show status dots
                status.forEach(el => el.classList.remove('opacity-0', 'w-0'));

                updateLogo(false);
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
            // Desktop Reset: Ensure visible and full width
            sidebar.classList.remove('-translate-x-full'); // Remove mobile hiding

            // Just ensure it's in a valid state (Full)
            if (!sidebar.classList.contains('w-[17.5rem]') && !sidebar.classList.contains('w-[6rem]')) {
                sidebar.classList.add('w-[17.5rem]');
            }

            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        } else {
            // Mobile Reset: Hide sidebar
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('w-[6rem]');
            sidebar.classList.add('w-[17.5rem]');

            // Clean up mini-sidebar artifacts
            const labels = sidebar.querySelectorAll('.sidebar-label');
            const headers = sidebar.querySelectorAll('.sidebar-header');
            const promos = sidebar.querySelectorAll('.sidebar-promo');
            const links = sidebar.querySelectorAll('.sidebar-link');
            const status = sidebar.querySelectorAll('.sidebar-status');
            const hideMini = sidebar.querySelectorAll('.sidebar-hide-mini');

            labels.forEach(el => el.classList.remove('w-0', 'opacity-0', 'translate-x-[-10px]'));
            [...headers, ...promos].forEach(el => el.classList.remove('max-h-0', 'opacity-0', 'mt-0', 'mb-0', 'p-0', 'border-0'));
            hideMini.forEach(el => el.classList.remove('max-h-0', 'opacity-0', 'p-0', 'border-0', 'mt-0', 'mb-0'));
            links.forEach(el => {
                el.classList.remove('justify-center', 'px-0');
                el.classList.add('gap-4', 'px-4');
            });
            status.forEach(el => el.classList.remove('opacity-0', 'w-0'));

            if (mainContent) {
                mainContent.classList.remove('lg:ml-[6rem]');
                mainContent.classList.add('lg:ml-[17.5rem]');
            }
            if (topNav) {
                topNav.classList.remove('lg:left-[6.75rem]');
                topNav.classList.add('lg:left-[18.25rem]');
            }

            updateLogo(false);

            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        }
    });
}

document.addEventListener('DOMContentLoaded', initSidebar);
