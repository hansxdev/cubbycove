// Logic for creator/studio.html

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Tab Switching Logic
    window.showTab = function(tabName) {
        document.getElementById('tab-uploads').classList.add('hidden');
        document.getElementById('tab-new').classList.add('hidden');
        
        document.getElementById(`tab-${tabName}`).classList.remove('hidden');

        const navUploads = document.getElementById('nav-uploads');
        const navNew = document.getElementById('nav-new');
        const pageTitle = document.getElementById('page-title');

        if (tabName === 'uploads') {
            navUploads.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-500');
            navUploads.classList.remove('text-gray-500', 'border-transparent');
            
            navNew.classList.remove('bg-orange-50', 'text-orange-600', 'border-orange-500');
            navNew.classList.add('text-gray-500', 'border-transparent');
            
            pageTitle.innerText = "My Content";
        } else {
            navNew.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-500');
            navNew.classList.remove('text-gray-500', 'border-transparent');
            
            navUploads.classList.remove('bg-orange-50', 'text-orange-600', 'border-orange-500');
            navUploads.classList.add('text-gray-500', 'border-transparent');
            
            pageTitle.innerText = "Upload New Video";
        }
    };

    // 2. Upload Form Handling
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            const titleInput = document.getElementById('videoTitle').value;
            
            // Loading State
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
            btn.disabled = true;
            btn.classList.add('opacity-75');

            // Simulate API Call
            setTimeout(() => {
                alert("Video submitted successfully! It is now Pending Review.");
                
                // Add new video to list (Mock)
                addPendingVideoToList(titleInput);
                
                // Reset Form
                uploadForm.reset();
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.classList.remove('opacity-75');
                
                // Switch back to uploads tab
                showTab('uploads');
                
                // Update stats
                const pendingStat = document.getElementById('stat-pending');
                if(pendingStat) {
                    pendingStat.innerText = parseInt(pendingStat.innerText) + 1;
                }

            }, 1500);
        });
    }

    // Helper: Add Mock Video to List
    function addPendingVideoToList(title) {
        const list = document.getElementById('video-list');
        const newCard = document.createElement('div');
        newCard.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex gap-4 items-center dashboard-card animate-pulse';
        newCard.innerHTML = `
            <div class="w-32 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
                <div class="absolute inset-0 flex items-center justify-center">
                    <i class="fa-solid fa-clock text-gray-400 text-2xl"></i>
                </div>
            </div>
            <div class="flex-1">
                <div class="flex justify-between">
                    <h4 class="font-bold text-gray-800">${title}</h4>
                    <span class="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">Pending Review</span>
                </div>
                <p class="text-xs text-gray-500 mt-1">Uploaded Just Now</p>
            </div>
        `;
        
        // Insert at the top
        list.insertBefore(newCard, list.firstChild);
        
        // Remove pulse animation after a moment
        setTimeout(() => {
            newCard.classList.remove('animate-pulse');
        }, 2000);
    }
});