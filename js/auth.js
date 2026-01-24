// Logic for login.html & staff_access.html

// 1. Tab Switching Logic (For login.html only)
function switchTab(role) {
    const tabKid = document.getElementById('tab-kid');
    const tabParent = document.getElementById('tab-parent');
    const formKid = document.getElementById('form-kid');
    const formParent = document.getElementById('form-parent');

    // Only run if elements exist (avoids errors on staff_access.html)
    if (!tabKid || !tabParent) return;

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

// 2. Mock Login Functions
function handleParentLogin() {
    const email = document.getElementById('parentEmail') ? document.getElementById('parentEmail').value : null;
    
    // Mock Success
    const btn = document.querySelector('#form-parent button');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';
    
    setTimeout(() => {
        window.location.href = 'parent/dashboard.html';
    }, 1500);
}

function handleKidLogin() {
    const user = document.getElementById('kidUsername') ? document.getElementById('kidUsername').value : null;
    
    // Mock Success
    const btn = document.querySelector('#form-kid button');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    
    setTimeout(() => {
        window.location.href = 'kid/home_logged_in.html';
    }, 1500);
}

// 3. Staff Login Handler
window.handleStaffLogin = function(email, password) {
    if (!email || !password) {
        alert("Please enter credentials.");
        return;
    }

    const btn = document.querySelector('form button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    btn.disabled = true;

    // Mock Logic for demonstration
    setTimeout(() => {
        if (email.toLowerCase().includes("admin")) {
            window.location.href = 'staff/admin_dashboard.html';
        } else if (email.toLowerCase().includes("assistant")) {
            window.location.href = 'staff/assistant_panel.html';
        } else {
            alert("Invalid Credentials. Try 'admin@cubbycove.com' or 'assistant@cubbycove.com'");
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 1500);
}