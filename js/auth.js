// Logic for login.html & staff_access.html

// 1. Tab Switching Logic (For login.html only)
function switchTab(role) {
    const tabKid = document.getElementById('tab-kid');
    const tabParent = document.getElementById('tab-parent');
    const formKid = document.getElementById('form-kid');
    const formParent = document.getElementById('form-parent');

    if (!tabKid || !tabParent) return;

    if (role === 'kid') {
        tabKid.classList.add('bg-white', 'shadow-sm', 'text-cubby-purple');
        tabKid.classList.remove('text-gray-500');
        tabParent.classList.remove('bg-white', 'shadow-sm', 'text-cubby-purple');
        tabParent.classList.add('text-gray-500');
        formKid.classList.remove('hidden');
        formParent.classList.add('hidden');
    } else {
        tabParent.classList.add('bg-white', 'shadow-sm', 'text-cubby-purple');
        tabParent.classList.remove('text-gray-500');
        tabKid.classList.remove('bg-white', 'shadow-sm', 'text-cubby-purple');
        tabKid.classList.add('text-gray-500');
        formParent.classList.remove('hidden');
        formKid.classList.add('hidden');
    }
}

// 2. Parent Login Function (Async)
async function handleParentLogin() {
    const email = document.getElementById('parentEmail') ? document.getElementById('parentEmail').value : null;
    const password = document.getElementById('parentPassword') ? document.getElementById('parentPassword').value : null;

    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }

    const btn = document.querySelector('#form-parent button');
    const originalText = btn ? btn.innerHTML : 'Sign In';
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';
        btn.disabled = true;
    }

    try {
        const user = await DataService.login(email, password);

        if (user.role !== 'parent') {
            throw new Error("Invalid role. Please use the Staff Portal.");
        }

        window.location.href = 'parent/dashboard.html';

    } catch (error) {
        alert(error.message);
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// 3. Kid Login Function
async function handleKidLogin() {
    const username = document.getElementById('kidUsername')?.value?.trim();
    const guardianEmail = document.getElementById('guardianEmail')?.value?.trim();
    const password = document.getElementById('kidPassword')?.value;

    if (!username || !guardianEmail || !password) {
        alert("Please fill in your username, parent's email, and your password.");
        return;
    }

    const btn = document.querySelector('#form-kid button[type="submit"]');
    const originalText = btn ? btn.innerHTML : "LET'S PLAY! 🚀";
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking...';
        btn.disabled = true;
    }

    try {
        await DataService.kidLogin(username, guardianEmail, password);
        window.location.href = 'kid/home_logged_in.html';
    } catch (error) {
        alert(error.message || 'Login failed. Please try again.');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

// 4. Staff Login Handler (Async)
window.handleStaffLogin = async function (email, password) {
    if (!email || !password) {
        alert("Please enter credentials.");
        return;
    }

    const btn = document.querySelector('form button[type="submit"]');
    let originalText = 'Verify Credentials';
    if (btn) {
        originalText = btn.innerText;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
        btn.disabled = true;
    }

    try {
        const user = await DataService.login(email, password);

        // Route based on role
        if (['super_admin', 'admin'].includes(user.role)) {
            window.location.href = 'staff/admin_dashboard.html';
        } else if (user.role === 'assistant') {
            window.location.href = 'staff/assistant_panel.html';
        } else if (user.role === 'creator') {
            window.location.href = 'creator/creator.html';
        } else {
            throw new Error("Access Denied: You do not have staff privileges.");
        }

    } catch (error) {
        alert(error.message || "Login Failed");
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
};