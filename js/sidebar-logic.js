function initSidebar() {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('main-content');
    const topNav = document.getElementById('top-nav');
    const body = document.body;

    if (!sidebar) return;

    // Hide hamburger menu button on desktop since we're using hover logic now
    if (menuBtn) {
        menuBtn.classList.remove('lg:flex', 'lg:bg-white/40', 'lg:backdrop-blur-md', 'lg:w-11', 'lg:h-11', 'lg:items-center', 'lg:justify-center', 'lg:border', 'lg:border-white/50', 'lg:shadow-sm', 'lg:text-indigo-900/60', 'lg:hover:text-indigo-900', 'lg:hover:bg-white/60', 'lg:hover:scale-105');
        menuBtn.classList.add('lg:hidden');
    }

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

    function setExpandedStyles() {
        const labels = sidebar.querySelectorAll('.sidebar-label');
        const headers = sidebar.querySelectorAll('.sidebar-header');
        const promos = sidebar.querySelectorAll('.sidebar-promo');
        const links = sidebar.querySelectorAll('.sidebar-link');
        const status = sidebar.querySelectorAll('.sidebar-status');
        const hideMini = sidebar.querySelectorAll('.sidebar-hide-mini');

        labels.forEach(el => el.classList.remove('w-0', 'opacity-0', 'translate-x-[-10px]', 'hidden'));
        [...headers, ...promos].forEach(el => el.classList.remove('max-h-0', 'opacity-0', 'mt-0', 'mb-0', 'p-0', 'border-0', 'overflow-hidden'));
        hideMini.forEach(el => el.classList.remove('max-h-0', 'opacity-0', 'p-0', 'border-0', 'mt-0', 'mb-0', 'overflow-hidden'));
        
        sidebar.querySelectorAll('.space-y-4').forEach(el => {
            el.classList.remove('mx-1.5');
            el.classList.add('mx-6');
        });

        links.forEach(el => {
            el.classList.remove('justify-center', 'px-0', 'aspect-square', 'w-[4.5rem]', 'mx-auto');
            el.classList.add('gap-3', 'pr-4', 'pl-1.5');
        });

        status.forEach(el => el.classList.remove('opacity-0', 'w-0'));
    }

    function collapseDesktop() {
        if (!sidebar.classList.contains('w-[17.5rem]') && !sidebar.classList.contains('w-full')) return;

        sidebar.classList.remove('w-[17.5rem]');
        sidebar.classList.add('w-[6rem]');

        if (mainContent) {
            mainContent.classList.remove('lg:ml-[17.5rem]', 'lg:ml-64');
            mainContent.classList.add('lg:ml-[6rem]');
            // Crucial: remove position absolute overlapping so it pushes
            mainContent.classList.remove('absolute', 'w-full'); 
        }

        if (topNav) {
            topNav.classList.remove('lg:left-[18.25rem]');
            topNav.classList.add('lg:left-[6.75rem]');
        }

        // Animate Labels Out
        sidebar.querySelectorAll('.sidebar-label').forEach(el => {
            el.classList.add('w-0', 'opacity-0', 'translate-x-[-10px]', 'hidden');
        });

        // Hide Headers & Promos (Collapse Height)
        [...sidebar.querySelectorAll('.sidebar-header'), ...sidebar.querySelectorAll('.sidebar-promo')].forEach(el => {
            el.classList.add('max-h-0', 'opacity-0', 'mt-0', 'mb-0', 'p-0', 'border-0', 'overflow-hidden');
        });

        sidebar.querySelectorAll('.sidebar-hide-mini').forEach(el => {
            el.classList.add('max-h-0', 'opacity-0', 'p-0', 'border-0', 'mt-0', 'mb-0', 'overflow-hidden');
        });

        sidebar.querySelectorAll('.space-y-4').forEach(el => {
            el.classList.remove('mx-6');
            el.classList.add('mx-1.5');
        });

        sidebar.querySelectorAll('.sidebar-link').forEach(el => {
            el.classList.remove('gap-3', 'pr-4', 'pl-1.5');
            el.classList.add('justify-center', 'px-0', 'aspect-square', 'w-[4.5rem]', 'mx-auto');
        });

        sidebar.querySelectorAll('.sidebar-status').forEach(el => el.classList.add('opacity-0', 'w-0'));

        updateLogo(true);
    }

    function expandDesktop() {
        if (sidebar.classList.contains('w-[17.5rem]')) return;

        sidebar.classList.remove('w-[6rem]');
        sidebar.classList.add('w-[17.5rem]');

        // When expanding on hover, we don't want to push the main content, 
        // we want the sidebar to float over. 
        if (mainContent) {
            mainContent.classList.remove('lg:ml-[17.5rem]');
            mainContent.classList.add('lg:ml-[6rem]'); 
        }

        if (topNav) {
            topNav.classList.remove('lg:left-[18.25rem]');
            topNav.classList.add('lg:left-[6.75rem]');
        }

        setExpandedStyles();
        updateLogo(false);
    }

    function toggleMobileMenu() {
        const isHidden = sidebar.classList.contains('-translate-x-full');
        if (isHidden) {
            // Open
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
            body.style.overflow = 'hidden';
            setExpandedStyles();
            updateLogo(false);
        } else {
            // Close
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        }
    }

    if (menuBtn) menuBtn.addEventListener('click', toggleMobileMenu);
    if (overlay) overlay.addEventListener('click', toggleMobileMenu);

    // Initial state on load
    if (window.innerWidth >= 1024) {
        // Run setTimeout slightly so it doesn't fight DOMContentLoaded weirdly, or just run sync
        collapseDesktop();
    }

    // Hover listeners for desktop expanding/collapsing
    sidebar.addEventListener('mouseenter', () => {
        if (window.innerWidth >= 1024) {
            expandDesktop();
        }
    });

    sidebar.addEventListener('mouseleave', () => {
        if (window.innerWidth >= 1024) {
            collapseDesktop();
        }
    });

    // Resize Reset
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) {
            // Desktop Reset: Ensure visible and collapsed
            sidebar.classList.remove('-translate-x-full');
            collapseDesktop();

            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        } else {
            // Mobile Reset: Hide sidebar
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('w-[6rem]');
            sidebar.classList.add('w-[17.5rem]');

            setExpandedStyles();
            updateLogo(false);

            if (mainContent) {
                mainContent.classList.remove('lg:ml-[6rem]');
                mainContent.classList.add('lg:ml-[17.5rem]');
            }
            if (topNav) {
                topNav.classList.remove('lg:left-[6.75rem]');
                topNav.classList.add('lg:left-[18.25rem]');
            }

            if (overlay) overlay.classList.add('hidden');
            body.style.overflow = 'auto';
        }
    });
}

document.addEventListener('DOMContentLoaded', initSidebar);

