/**
 * Logic for displaying Approved Videos on the Guests/Kids Home Page (index.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    loadHomeVideos();
});

function loadHomeVideos() {
    const videoGrid = document.querySelector('.grid'); // The main video container
    if (!videoGrid) return;

    // Get Approved Videos & Randomize/Sort
    const videos = DataService.getVideos('approved');

    if (videos.length === 0) {
        // Keep the static mock content if no real data yet? 
        // Or clear it? Let's append to it or replace if we have real content.
        // For now, let's just append the new dynamic ones at the TOP.
        return;
    }

    // If we have real videos, let's PREPEND them
    videos.forEach(video => {
        let vidId = '';
        if (video.url.includes('v=')) vidId = video.url.split('v=')[1].split('&')[0];
        else if (video.url.includes('youtu.be/')) vidId = video.url.split('youtu.be/')[1];

        const thumb = `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;

        const html = `
            <div class="video-card group cursor-pointer" onclick="playVideo('${vidId}')">
                <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-200">
                    <img src="${thumb}" alt="${video.title}" class="absolute inset-0 w-full h-full object-cover">
                    <div class="absolute inset-0 bg-black/20 hidden group-hover:flex items-center justify-center transition-all">
                        <div class="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center pl-1 shadow-lg">
                            <i class="fa-solid fa-play text-cubby-blue text-xl"></i>
                        </div>
                    </div>
                </div>
                <div class="flex gap-3 mt-3">
                    <div class="min-w-[40px]"><img src="https://api.dicebear.com/7.x/identicon/svg?seed=${video.category}" class="w-9 h-9 rounded-full bg-gray-100"></div>
                    <div>
                        <h3 class="font-extrabold text-gray-900 leading-tight mb-1 line-clamp-2 text-base group-hover:text-cubby-blue transition-colors">
                            ${video.title}
                        </h3>
                        <p class="text-sm text-gray-500 font-semibold">${video.category} • ${video.creatorEmail.split('@')[0]}</p>
                    </div>
                </div>
            </div>
        `;

        videoGrid.insertAdjacentHTML('afterbegin', html);
    });
}

function playVideo(videoId) {
    // Simple Modal Player for now
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4";
    modal.innerHTML = `
        <div class="w-full max-w-4xl aspect-video bg-black relative rounded-xl overflow-hidden shadow-2xl">
            <button onclick="this.parentElement.parentElement.remove()" class="absolute -top-12 right-0 text-white text-3xl hover:text-red-500"><i class="fa-solid fa-times"></i></button>
            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
    `;
    document.body.appendChild(modal);
}

// --- AUTH MODALS ---

function showLoginModal(title = "Want to do more?") {
    const modal = document.getElementById('login-modal');
    const modalTitle = document.getElementById('modal-title');

    if (modal) {
        if (modalTitle) modalTitle.innerText = title;
        modal.classList.remove('hidden');
    } else {
        // Fallback if modal not found -> Direct redirect
        window.location.href = 'staff_access.html'; // Defaulting to staff access if modal fails, as it exists.
    }
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('hidden');
}

// Expose globally
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.playVideo = playVideo;

/**
 * Handles clicks on protected links (Games, etc.)
 * Checks if user is logged in. If not, shows login modal.
 */
window.handleProtectedLink = async function (event, url) {
    event.preventDefault(); // Stop default navigation

    try {
        const user = await DataService.getCurrentUser();
        if (user) {
            // User is logged in, allow navigation
            window.location.href = url;
        } else {
            // No user, show modal
            showLoginModal("Sign in to play games!");
        }
    } catch (error) {
        console.error("Auth Check Error:", error);
        showLoginModal("Sign in to play games!");
    }
};