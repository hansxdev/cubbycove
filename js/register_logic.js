/**
 * PARENT REGISTRATION CONTROLLER
 * Handles the multi-step form UI and calls DataService
 */

let currentStep = 1;

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Registration Logic Loaded");
    setupPasswordFeedback();
});

function setupPasswordFeedback() {
    const passInput = document.getElementById('password');
    if (!passInput) return;

    // Requirement Elements
    const reqs = {
        length: document.getElementById('req-length'),
        upper: document.getElementById('req-upper'),
        lower: document.getElementById('req-lower'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special')
    };

    const updateReq = (el, valid) => {
        if (!el) return;
        const icon = el.querySelector('i');
        if (valid) {
            el.classList.remove('text-gray-500');
            el.classList.add('text-green-500');
            if (icon) {
                icon.className = 'fa-solid fa-check-circle text-[10px] mr-1';
            }
        } else {
            el.classList.remove('text-green-500');
            el.classList.add('text-gray-500');
            if (icon) {
                icon.className = 'fa-regular fa-circle text-[10px] mr-1';
            }
        }
    };

    passInput.addEventListener('input', () => {
        const val = passInput.value;

        updateReq(reqs.length, val.length >= 8);
        updateReq(reqs.upper, /[A-Z]/.test(val));
        updateReq(reqs.lower, /[a-z]/.test(val));
        updateReq(reqs.number, /\d/.test(val));
        updateReq(reqs.special, /[!@#$%^&*(),.?":{}|<>]/.test(val));
    });
}

// --- NAVIGATION FUNCTIONS ---

function nextStep(targetStep) {
    if (targetStep > currentStep) {
        // We are moving forward, validate current step first
        if (!validateStep(currentStep)) return;
    }

    // Hide current step
    const currentEl = document.getElementById(`step-${currentStep}`);
    const nextEl = document.getElementById(`step-${targetStep}`);

    if (currentEl && nextEl) {
        currentEl.classList.add('hidden');
        nextEl.classList.remove('hidden');
        nextEl.classList.add('fade-in');
    }

    // Update Tracker Sidebar
    updateTracker(targetStep);

    currentStep = targetStep;

    // Trigger Webcam if hitting step 3
    if (currentStep === 3 && typeof startWebcam === 'function') {
        startWebcam();
    }
}

function prevStep(targetStep) {
    // If leaving step 3, stop webcam
    if (currentStep === 3 && typeof stopWebcam === 'function') {
        stopWebcam();
    }

    nextStep(targetStep);
}

// --- VALIDATION ---

function validateStep(step) {
    let isValid = true;

    if (step === 1) {
        // Validate IDs: firstName, lastName, email, password, confirmPassword
        const fname = document.getElementById('firstName');
        const lname = document.getElementById('lastName');
        const email = document.getElementById('email');
        const pass = document.getElementById('password');
        const confirmPass = document.getElementById('confirmPassword');

        const inputs = [fname, lname, email, pass, confirmPass];

        // 1. Check Empty Fields
        inputs.forEach(input => {
            if (!input) return; // Skip if element not found (shouldn't happen)

            if (!input.value.trim()) {
                markError(input);
                isValid = false;
            } else {
                clearError(input);
            }
        });

        // 1.5. Check Password Complexity (NEW)
        if (pass && pass.value) {
            const result = SecurityUtils.validatePassword(pass.value);
            if (!result.isValid) {
                markError(pass);
                alert(result.error);
                isValid = false;
            }
        }

        // 2. Check Password Match
        if (pass && confirmPass && pass.value !== confirmPass.value) {
            markError(confirmPass);
            alert("Passwords do not match!");
            isValid = false;
        }
    }

    if (step === 2) {
        // Check if ID was uploaded (Optional check, but good for UX)
        const preview = document.getElementById('upload-preview');
        if (preview && preview.classList.contains('hidden')) {
            alert("Please upload an ID document.");
            isValid = false;
        }
    }

    return isValid;
}

function markError(element) {
    if (!element) return;
    element.classList.add('border-red-500', 'ring-2', 'ring-red-200');
}

function clearError(element) {
    if (!element) return;
    element.classList.remove('border-red-500', 'ring-2', 'ring-red-200');
}

// --- UI UPDATES ---

function updateTracker(step) {
    // Reset all
    for (let i = 1; i <= 3; i++) {
        const tracker = document.getElementById(`tracker-${i}`);
        if (!tracker) continue;

        const circle = tracker.querySelector('div');
        const label = tracker.querySelector('span');

        // Default State (Pending)
        tracker.className = 'step-item flex items-center gap-4 text-gray-400 group';
        circle.className = 'w-10 h-10 rounded-full bg-gray-200 group-hover:bg-gray-300 flex items-center justify-center transition-colors';
        circle.innerHTML = i;

        if (i < step) {
            // Completed
            tracker.classList.add('text-green-500', 'font-bold');
            tracker.classList.remove('text-gray-400');
            circle.className = 'w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md';
            circle.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (i === step) {
            // Active
            tracker.className = 'step-item flex items-center gap-4 text-cubby-blue font-bold';
            circle.className = 'w-10 h-10 rounded-full bg-cubby-blue text-white flex items-center justify-center shadow-lg shadow-blue-200';
            circle.innerHTML = i;
        }
    }
}

// --- SUBMISSION ---

// Called by face-api.js after successful capture
// Called by face-api.js after successful capture
function submitRegistration() {
    const fname = document.getElementById('firstName')?.value || '';
    const mname = document.getElementById('middleName')?.value || '';
    const lname = document.getElementById('lastName')?.value || '';

    // 1. Gather Data
    const formData = {
        firstName: fname.trim(),
        middleName: mname.trim(),
        lastName: lname.trim(),
        email: document.getElementById('email')?.value,
        password: document.getElementById('password')?.value,
        faceId: 'mock_face_id_' + Date.now()
    };

    try {
        // 2. Call the Service Layer
        DataService.registerParent(formData);

        // 3. Show Success UI
        document.getElementById('step-3').classList.add('hidden');
        const successState = document.getElementById('success-state');
        if (successState) {
            successState.classList.remove('hidden');
            successState.classList.add('flex');
        }

    } catch (error) {
        if (error.code === 409 || error.message.includes('email') || error.message.includes('already exists')) {
            alert("This email is already registered. Please login or use a different email.");
            document.getElementById('step-3').classList.add('hidden');
            document.getElementById('step-1').classList.remove('hidden');
            currentStep = 1;
            updateTracker(1);
        } else {
            alert("Registration Failed: " + error.message);
        }
    }
}

// Expose submit to global scope so face-api.js can call it
window.submitRegistration = submitRegistration;