const menuBtn = document.getElementById('menu-btn');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const mainContent = document.getElementById('main-content');
        const loginModal = document.getElementById('login-modal');
        const modalTitle = document.getElementById('modal-title');
        const body = document.body;

        // Toggle Sidebar Logic
        function toggleMenu() {
            const isDesktop = window.innerWidth >= 1024;
            
            if (isDesktop) {
                const isVisible = sidebar.classList.contains('lg:translate-x-0');
                if (isVisible) {
                    sidebar.classList.remove('lg:translate-x-0');
                    sidebar.classList.add('-translate-x-full');
                    mainContent.classList.remove('lg:ml-64');
                } else {
                    sidebar.classList.add('lg:translate-x-0');
                    sidebar.classList.remove('-translate-x-full');
                    mainContent.classList.add('lg:ml-64');
                }
            } else {
                const isHidden = sidebar.classList.contains('-translate-x-full');
                if (isHidden) {
                    sidebar.classList.remove('-translate-x-full');
                    overlay.classList.remove('hidden');
                    body.style.overflow = 'hidden';
                } else {
                    sidebar.classList.add('-translate-x-full');
                    overlay.classList.add('hidden');
                    body.style.overflow = 'auto';
                }
            }
        }

        // Modal Logic
        function showLoginModal(featureName) {
            if(featureName) {
                modalTitle.innerText = featureName;
            } else {
                modalTitle.innerText = "Want to do more?";
            }
            loginModal.classList.remove('hidden');
        }

        function closeLoginModal() {
            loginModal.classList.add('hidden');
        }

        // Event Listeners
        menuBtn.addEventListener('click', toggleMenu);
        overlay.addEventListener('click', toggleMenu);

        // Resize Reset
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 1024) {
                if (!sidebar.classList.contains('lg:translate-x-0')) {
                    sidebar.classList.add('lg:translate-x-0');
                    sidebar.classList.remove('-translate-x-full');
                    mainContent.classList.add('lg:ml-64');
                }
                overlay.classList.add('hidden');
                body.style.overflow = 'auto';
            } else {
                sidebar.classList.remove('lg:translate-x-0');
                sidebar.classList.add('-translate-x-full');
                mainContent.classList.remove('lg:ml-64'); 
                overlay.classList.add('hidden');
                body.style.overflow = 'auto';
            }
        });