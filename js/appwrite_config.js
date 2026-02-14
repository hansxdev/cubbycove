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

    // Expose creating services globally
    window.AppwriteService = {
        client,
        account,
        databases,
        storage,
        DB_ID,
        COLLECTIONS
    };

    console.log("✅ [Appwrite] Client Initialized");

} catch (error) {
    console.error("❌ [Appwrite] SDK not loaded. Ensure the script is included in your HTML.");
}
