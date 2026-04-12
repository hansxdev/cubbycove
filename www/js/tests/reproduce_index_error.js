const { Client, Databases, Query } = require('node-appwrite');

async function reproduceIndexError() {
    const PROJECT_ID = '69b554060007d12c46ee';
    const DB_ID = '69b5543d0007695488c5';
    const COLLECTION_ID = 'pending_staff';
    // ⚠️  Paste a fresh API key here only when running this test, then clear it.
    const API_KEY = 'PASTE_API_KEY_HERE';

    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1')
        .setProject(PROJECT_ID)
        .setKey(API_KEY);

    const databases = new Databases(client);

    console.log("🧪 Testing query on pending_staff by email...");

    try {
        const result = await databases.listDocuments(DB_ID, COLLECTION_ID, [
            Query.equal('email', 'test@example.com'),
            Query.limit(1)
        ]);
        console.log("✅ Query successful. Documents found:", result.total);
        if (result.total === 0) {
            console.log("ℹ️ No documents found, but query worked (which might mean index exists or Appwrite is allowing unindexed query in Node SDK)");
        }
    } catch (e) {
        console.error("❌ Test Failed as expected (or unexpectedly):", e.message);
        if (e.message.includes('index') || e.code === 400) {
            console.log("🎯 REPRODUCTION SUCCESSFUL: Index missing error caught.");
            process.exit(0);
        } else {
            console.error("Unexpected error code:", e.code);
            process.exit(1);
        }
    }
}

reproduceIndexError();
