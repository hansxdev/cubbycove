// Logic for creator/creator.html

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initCreatorStudio();

    // Tab Switching
    window.showTab = function (tabName) {
        document.querySelectorAll('main > div').forEach(div => div.classList.add('hidden'));
        document.querySelectorAll('nav a').forEach(a => {
            a.classList.remove('bg-orange-50', 'text-orange-600', 'border-orange-500');
            a.classList.add('text-gray-500', 'border-transparent');
        });

        const targetDiv = document.getElementById(`tab-${tabName}`);
        const targetNav = document.getElementById(`nav-${tabName}`);

        if (targetDiv) targetDiv.classList.remove('hidden');
        if (targetNav) {
            targetNav.classList.add('bg-orange-50', 'text-orange-600', 'border-orange-500');
            targetNav.classList.remove('text-gray-500', 'border-transparent');
        }

        if (tabName === 'uploads') loadMyUploads();
    };

    // Form Handler
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }

    // Default Tab
    showTab('uploads');
});

function initCreatorStudio() {
    currentUser = DataService.getCurrentUser();

    // Auth Check
    if (!currentUser || !['creator', 'admin', 'super_admin', 'assistant'].includes(currentUser.role)) {
        // Mock Creator for testing if not logged in properties 
        // In real app, redirect. But for dev flow, maybe just warn?
        // window.location.href = '../staff_access.html';
        console.warn("No creator logged in.");
    }

    if (currentUser) {
        const titleEl = document.getElementById('page-title');
        // Update header details if elements exist (omitted for brevity)
    }
}

function handleUpload(e) {
    e.preventDefault();

    const url = document.getElementById('videoUrl').value;
    const title = document.getElementById('videoTitle').value;
    const category = document.getElementById('videoCategory').value;

    if (!currentUser) {
        alert("Please log in to upload.");
        return;
    }

    try {
        DataService.addVideo({
            url: url,
            title: title,
            category: category,
            creatorEmail: currentUser.email
        });

        alert("Video submitted successfully! It is now pending review.");
        document.getElementById('uploadForm').reset();
        showTab('uploads');
    } catch (error) {
        alert("Upload failed: " + error.message);
    }
}

function loadMyUploads() {
    if (!currentUser) return;

    const container = document.getElementById('video-list');
    const myVideos = DataService.getCreatorVideos(currentUser.email);

    container.innerHTML = ''; // Clear stats/mock data that was hardcoded if any

    // Update Top Stats
    const pendingCount = myVideos.filter(v => v.status === 'pending').length;
    const liveCount = myVideos.filter(v => v.status === 'approved').length;

    document.getElementById('stat-live').innerText = liveCount;
    document.getElementById('stat-pending').innerText = pendingCount;
    // Views mocked for now

    // Render List
    myVideos.forEach(video => {
        let statusColor = 'bg-yellow-100 text-yellow-700';
        let statusText = 'Pending Review';

        if (video.status === 'approved') {
            statusColor = 'bg-green-100 text-green-700';
            statusText = 'Live';
        } else if (video.status === 'rejected') {
            statusColor = 'bg-red-100 text-red-700';
            statusText = 'Rejected';
        }

        let thumb = "https://placehold.co/400x250/e2e8f0/64748b?text=Video";
        if (video.url.includes('v=')) {
            const vidId = video.url.split('v=')[1].split('&')[0];
            thumb = `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;
        } else if (video.url.includes('youtu.be/')) {
            const vidId = video.url.split('youtu.be/')[1];
            thumb = `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;
        }

        const html = `
             <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex gap-4 items-center dashboard-card">
                <div class="w-32 h-20 bg-gray-200 rounded-lg flex-shrink-0 overflow-hidden relative">
                    <img src="${thumb}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <div class="flex justify-between">
                        <h4 class="font-bold text-gray-800">${video.title}</h4>
                        <span class="${statusColor} text-xs font-bold px-2 py-1 rounded">${statusText}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">Uploaded ${new Date(video.uploadedAt).toLocaleString()}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}