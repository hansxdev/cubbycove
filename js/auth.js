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

// 3. Kid Login Function — Parental Approval Flow
async function handleKidLogin() {
    const username = document.getElementById('kidUsername')?.value?.trim();
    const guardianEmail = document.getElementById('guardianEmail')?.value?.trim();
    const password = document.getElementById('kidPassword')?.value;

    if (!username || !guardianEmail || !password) {
        alert("Please fill in your username, parent's email, and your password.");
        return;
    }

    const btn = document.querySelector('#form-kid button[type="submit"]');
    const form = document.getElementById('form-kid');

    // ── Step 1: Show a loading state on the button (but keep the form visible) ──
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Checking credentials...';
        btn.disabled = true;
    }

    // ── Step 2: Validate credentials — this throws if anything is wrong ──────────
    let request;
    try {
        request = await DataService.createLoginRequest(username, guardianEmail, password);
    } catch (err) {
        // Restore the button so the kid can try again
        if (btn) {
            btn.innerHTML = "LET'S PLAY! 🚀";
            btn.disabled = false;
        }
        alert(err.message || 'Invalid credentials. Please try again.');
        return;
    }

    // ── Step 3: Credentials OK — NOW replace the form with the waiting screen ────
    const originalHTML = form ? form.innerHTML : '';
    if (form) {
        form.innerHTML = `
            <div class="text-center py-6 space-y-6" id="waiting-screen">
                <div class="w-20 h-20 bg-cubby-blue/10 rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <i class="fa-solid fa-shield-halved text-cubby-blue text-4xl"></i>
                </div>
                <div>
                    <h3 class="text-xl font-extrabold text-gray-800 mb-1">Waiting for Parent Approval</h3>
                    <p class="text-sm text-gray-500">A notification has been sent to your parent.<br>Ask them to check their dashboard!</p>
                </div>
                <div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700 font-semibold">
                    <i class="fa-solid fa-clock mr-2"></i> Request expires in <span id="req-countdown">5:00</span>
                </div>
                <button onclick="cancelKidLogin()" class="text-xs text-gray-400 hover:text-red-500 underline transition-colors">
                    Cancel request
                </button>
            </div>
        `;
    }

    // Countdown timer (5 min)
    const expiresAt = new Date(request.expiresAt).getTime();
    const countdownEl = () => document.getElementById('req-countdown');
    const timerInterval = setInterval(() => {
        const remaining = Math.max(0, expiresAt - Date.now());
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        if (countdownEl()) countdownEl().textContent = `${m}:${s.toString().padStart(2, '0')}`;
        if (remaining === 0) clearInterval(timerInterval);
    }, 1000);

    // Poll every 3 seconds
    window._kidLoginPollStopped = false;
    window.cancelKidLogin = function () {
        window._kidLoginPollStopped = true;
        clearInterval(timerInterval);
        if (form) form.innerHTML = originalHTML;
    };

    const poll = async () => {
        if (window._kidLoginPollStopped) return;

        const updated = await DataService.pollLoginRequest(request.$id);
        if (!updated) return; // network error, try again next tick

        if (updated.status === 'approved') {
            clearInterval(timerInterval);
            await DataService.kidLoginFromApproved(updated);
            window.location.href = 'kid/home_logged_in.html';
            return;
        }

        if (updated.status === 'denied') {
            clearInterval(timerInterval);
            if (form) form.innerHTML = originalHTML;
            alert('Your parent denied this login request. Please ask them to try again.');
            return;
        }

        // Check expiry
        if (new Date(updated.expiresAt).getTime() < Date.now()) {
            clearInterval(timerInterval);
            if (form) form.innerHTML = originalHTML;
            alert('Login request expired after 5 minutes. Please try again.');
            return;
        }

        // Still pending — poll again in 3s
        setTimeout(poll, 3000);
    };

    setTimeout(poll, 3000); // start first poll after 3s
}

// 4. Staff Login Handler — accepts Staff ID (#STF-...) or email
window.handleStaffLogin = async function (identifier, password) {
    if (!identifier || !password) {
        alert("Please enter your Staff ID (or email) and password.");
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
        let loginEmail = identifier.trim();

        // If identifier looks like a Staff ID, resolve it to an email first
        if (loginEmail.toUpperCase().startsWith('#STF-')) {
            const staffDoc = await DataService.getStaffByStaffId(loginEmail);
            loginEmail = staffDoc.email;
        }

        const user = await DataService.login(loginEmail, password);

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
