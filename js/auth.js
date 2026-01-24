function switchTab(role) {
            const tabKid = document.getElementById('tab-kid');
            const tabParent = document.getElementById('tab-parent');
            const formKid = document.getElementById('form-kid');
            const formParent = document.getElementById('form-parent');

            if (role === 'kid') {
                // Activate Kid Tab
                tabKid.classList.add('bg-white', 'shadow-sm', 'text-cubby-purple');
                tabKid.classList.remove('text-gray-500');
                
                tabParent.classList.remove('bg-white', 'shadow-sm', 'text-cubby-purple');
                tabParent.classList.add('text-gray-500');

                // Show Kid Form
                formKid.classList.remove('hidden');
                formParent.classList.add('hidden');
            } else {
                // Activate Parent Tab
                tabParent.classList.add('bg-white', 'shadow-sm', 'text-cubby-purple');
                tabParent.classList.remove('text-gray-500');
                
                tabKid.classList.remove('bg-white', 'shadow-sm', 'text-cubby-purple');
                tabKid.classList.add('text-gray-500');

                // Show Parent Form
                formParent.classList.remove('hidden');
                formKid.classList.add('hidden');
            }
        }

        // Mock Login for Demo (Replace with firebase logic later)
        function mockLogin(role) {
            if(role === 'parent') {
                alert("Redirecting to Parent Dashboard...");
                window.location.href = 'parent/dashboard.html';
            }
        }
