// Logic for staff/admin_dashboard.html

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Add Video Form Handler (Direct Admin Upload)
    const addVideoForm = document.getElementById('addVideoForm');
    
    if (addVideoForm) {
        addVideoForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const btn = addVideoForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            const videoId = document.getElementById('videoId').value;
            const videoTitle = document.getElementById('videoTitle').value;
            
            if(!videoId || !videoTitle) {
                alert("Please fill in all fields.");
                return;
            }

            // Loading State
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding...';
            btn.disabled = true;
            btn.classList.add('opacity-75');

            // Mock API Call
            setTimeout(() => {
                alert(`Video "${videoTitle}" added successfully to the Safe Library!`);
                
                // Reset Form
                addVideoForm.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-75');
            }, 1000);
        });
    }

    // 2. User Management (Ban/Unban)
    // Using event delegation on the table body to handle clicks
    const tableBody = document.querySelector('tbody');
    if (tableBody) {
        tableBody.addEventListener('click', (e) => {
            // Find closest button
            const btn = e.target.closest('button');
            if (!btn) return;

            // Handle Ban Action
            if (btn.title === "Ban User") {
                if(confirm("Are you sure you want to ban this user? They will lose access immediately.")) {
                    // Update UI to show 'Banned' state
                    const row = btn.closest('tr');
                    const statusSpan = row.querySelector('td:nth-child(3) span');
                    const nameSpan = row.querySelector('td:nth-child(1)');
                    
                    statusSpan.className = 'text-red-500 font-bold text-xs';
                    statusSpan.innerText = 'Banned';
                    
                    nameSpan.classList.add('text-red-500');
                    
                    // Change button to Unban
                    btn.title = "Unban";
                    btn.classList.remove('text-red-400', 'hover:text-red-600');
                    btn.classList.add('text-green-400', 'hover:text-green-600');
                    btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
                    
                    alert("User has been banned.");
                }
            } 
            // Handle Unban Action
            else if (btn.title === "Unban") {
                if(confirm("Restore access for this user?")) {
                    // Update UI to show 'Active' state
                    const row = btn.closest('tr');
                    const statusSpan = row.querySelector('td:nth-child(3) span');
                    const nameSpan = row.querySelector('td:nth-child(1)');
                    
                    statusSpan.className = 'text-green-500 font-bold text-xs';
                    statusSpan.innerText = 'Active';
                    
                    nameSpan.classList.remove('text-red-500');
                    
                    // Change button back to Ban
                    btn.title = "Ban User";
                    btn.classList.remove('text-green-400', 'hover:text-green-600');
                    btn.classList.add('text-red-400', 'hover:text-red-600');
                    btn.innerHTML = '<i class="fa-solid fa-ban"></i>';
                    
                    alert("User access restored.");
                }
            }
        });
    }
});