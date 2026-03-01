/**
 * Appwrite Configuration
 * -------------------------------------------------------------------------
 * This file handles the initialization of the Appwrite Client.
 * 
 * TODO: Replace the placeholders below with your actual Appwrite Project details.
 */

try {
    const { Client, Account, Databases, Storage } = Appwrite;

    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1') // Updated from .env
        .setProject('69904f4900396667cf4c'); // Updated from .env

    const account = new Account(client);
    const databases = new Databases(client);
    const storage = new Storage(client);

    // Database & Collection IDs (Constants)
    const DB_ID = '699054e500210206c665'; // REPLACE with your Database ID
    const COLLECTIONS = {
        USERS: 'users',
        CHILDREN: 'children',
        VIDEOS: 'videos',
        THREAT_LOGS: 'threat_logs',
        ACCESS_LOGS: 'access_logs'
    };

    // Storage Bucket IDs
    const BUCKET_PARENT_DOCS = 'parent_docs'; // Create this bucket in your Appwrite project

    // Expose creating services globally
    window.AppwriteService = {
        client,
        account,
        databases,
        storage,
        DB_ID,
        COLLECTIONS,
        BUCKET_PARENT_DOCS
    };

    console.log("✅ [Appwrite] Client Initialized");

    // --- GLOBAL ALERT MODAL OVERRIDE ---
    window.alert = function (message) {
        let modal = document.getElementById('global-alert-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'global-alert-modal';
            modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] hidden flex items-center justify-center p-4 transition-opacity duration-300';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative transform transition-all scale-100 opacity-100">
                    <button onclick="document.getElementById('global-alert-modal').classList.add('hidden')"
                        class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl outline-none focus:outline-none">
                        <i class="fa-solid fa-times"></i>
                    </button>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-cubby-blue text-white rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
                            <i class="fa-solid fa-bell animate-pulse"></i>
                        </div>
                        <h3 class="text-xl font-extrabold text-gray-800 mb-2">Notice</h3>
                        <p id="global-alert-message" class="text-gray-600 mb-6 font-medium whitespace-pre-wrap break-words text-sm"></p>
                        <button onclick="document.getElementById('global-alert-modal').classList.add('hidden')"
                            class="w-full py-3 bg-cubby-blue hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-200">
                            Okay
                        </button>
                    </div>
                </div>
            `;
            // Must wait for body to exist if script is loaded in head
            if (document.body) {
                document.body.appendChild(modal);
            } else {
                window.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
            }
        }
        modal.querySelector('#global-alert-message').textContent = message;
        modal.classList.remove('hidden');
    };

} catch (error) {
    console.error("❌ [Appwrite] SDK not loaded. Ensure the script is included in your HTML.");
}
