/**
 * Appwrite Configuration
 * -------------------------------------------------------------------------
 * This file handles the initialization of the Appwrite Client.
 * 
 * TODO: Replace the placeholders below with your actual Appwrite Project details.
 */

try {
    const { Client, Account, Databases, Storage, Functions } = Appwrite;

    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1') // Updated from .env
        .setProject('69b554060007d12c46ee'); // Updated from .env

    const account = new Account(client);
    const databases = new Databases(client);
    const storage = new Storage(client);
    const functions = new Functions(client);

    // Database & Collection IDs (Constants)
    const DB_ID = '69b5543d0007695488c5'; // REACHED NEW DB ID
    const COLLECTIONS = {
        USERS: 'users',
        CHILDREN: 'children',
        VIDEOS: 'videos',
        THREAT_LOGS: 'threat_logs',
        ACCESS_LOGS: 'access_logs',
        PENDING_STAFF: 'pending_staff',
        PATHS: 'paths',
        KID_REWARDS: 'kid_rewards',
        KID_PATH_STATUS: 'kid_path_status',
        CHAT_MESSAGES: 'chat_messages',
        NOTIFICATIONS: 'notifications',
        BUDDIES: 'buddies',
        GROUP_CHATS: 'group_chats',         // NEW: Private group chat rooms
        ADMIN_AUDIT_LOGS: 'admin_audit_logs', // NEW: Ghost mode audit trail
        COSMETICS: 'cosmetics',
        SUPPORT_TICKETS: 'support_tickets',
        SUPPORT_MESSAGES: 'support_messages',
        LOGIN_REQUESTS: 'login_requests'      // Kid parental-approval login flow
    };

    // Storage Bucket IDs
    const BUCKET_PARENT_DOCS = '69b578300038f9545b4f'; // Verified bucket ID from Appwrite Console
    const BUCKET_PROFILE_PICS = '69b578300038f9545b4f';

    // Function IDs
    const FUNCTION_GEMINI_FILTER = '69aed56d0034b1b68f9e'; // REPLACE with your Function ID

    // Expose creating services globally
    window.AppwriteService = {
        client,
        account,
        databases,
        storage,
        functions,
        DB_ID,
        COLLECTIONS,
        BUCKET_PARENT_DOCS,
        BUCKET_PROFILE_PICS,
        FUNCTION_GEMINI_FILTER
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

    /**
     * window.showConfirm(message, onConfirm, onCancel?)
     * Non-blocking replacement for native confirm().
     * onConfirm is called when user clicks "OK".
     * onCancel  is called (optionally) if user cancels.
     */
    window.showConfirm = function (message, onConfirm, onCancel) {
        let modal = document.getElementById('global-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'global-confirm-modal';
            modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] hidden flex items-center justify-center p-4 transition-opacity duration-300';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-cubby-yellow/20 text-cubby-yellow rounded-full flex items-center justify-center text-3xl mx-auto mb-4 shadow-md">
                            <i class="fa-solid fa-circle-question"></i>
                        </div>
                        <h3 class="text-xl font-extrabold text-gray-800 mb-2">Please Confirm</h3>
                        <p id="global-confirm-message" class="text-gray-600 mb-6 font-medium whitespace-pre-wrap break-words text-sm"></p>
                        <div class="flex gap-3">
                            <button id="global-confirm-cancel" class="flex-1 py-3 border-2 border-gray-200 text-gray-500 font-bold rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                            <button id="global-confirm-ok" class="flex-1 py-3 bg-cubby-blue hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-sm">Confirm</button>
                        </div>
                    </div>
                </div>
            `;
            if (document.body) {
                document.body.appendChild(modal);
            } else {
                window.addEventListener('DOMContentLoaded', () => document.body.appendChild(modal));
            }
        }

        modal.querySelector('#global-confirm-message').textContent = message;
        modal.classList.remove('hidden');

        const hide = () => modal.classList.add('hidden');

        const okBtn = modal.querySelector('#global-confirm-ok');
        const cancelBtn = modal.querySelector('#global-confirm-cancel');

        // Clone to remove stale listeners
        const newOk = okBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        okBtn.replaceWith(newOk);
        cancelBtn.replaceWith(newCancel);

        newOk.addEventListener('click', () => { hide(); if (onConfirm) onConfirm(); });
        newCancel.addEventListener('click', () => { hide(); if (onCancel) onCancel(); });
    };

} catch (error) {
    console.error("❌ [Appwrite] SDK not loaded. Ensure the script is included in your HTML.");
}
