// Logic for login.html

// 1. Tab Switching Logic
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

// 2. Mock Login Functions (Placeholder for Firebase)
function handleParentLogin() {
    const email = document.getElementById('parentEmail').value;
    const password = document.getElementById('parentPassword').value;

    if (!email || !password) {
        alert("Please fill in all fields.");
        return;
    }

    // Mock Success
    // In real implementation: Verify with Firebase here
    const btn = document.querySelector('#form-parent button');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';
    
    setTimeout(() => {
        // Redirect to the Parent Dashboard
        window.location.href = 'parent/dashboard.html';
    }, 1500);
}

function handleKidLogin() {
    const user = document.getElementById('kidUsername').value;
    const email = document.getElementById('guardianEmail').value;

    if (!user || !email) {
        alert("Please fill in all fields.");
        return;
    }

    // Mock Success
    const btn = document.querySelector('#form-kid button');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    
    setTimeout(() => {
        // Redirect to the Logged-in Kid Home
        window.location.href = 'kid/home_logged_in.html';
    }, 1500);
}