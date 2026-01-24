// Logic for parent/dashboard.html AND parent/register_child.html

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Dashboard specific logic (if on dashboard page)
    const dashboardTitle = document.querySelector('h1');
    if (dashboardTitle && dashboardTitle.innerText.includes('Dashboard')) {
        console.log("Parent Dashboard Loaded");
        // Future: Fetch real data from Firebase here
    }

    // 2. Register Child specific logic
    const addChildForm = document.getElementById('addChildForm');
    if (addChildForm) {
        console.log("Add Child Form Loaded");
    }
});

// Function to handle "Create Profile" button click
function saveChild() {
    // 1. Get values (Mock)
    // In real app: const name = document.querySelector('input[placeholder="e.g. Tommy"]').value;
    
    // 2. Show loading state
    const btn = document.querySelector('button[onclick="saveChild()"]');
    if(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;
        btn.classList.add('opacity-75');

        // 3. Simulate Network Request
        setTimeout(() => {
            alert("Child Profile Created Successfully!");
            // Redirect back to dashboard
            window.location.href = 'dashboard.html';
        }, 1500);
    }
}