import { Client, Account, Databases, Storage, Functions } from 'react-native-appwrite';

export const appwriteConfig = {
    endpoint: "https://sgp.cloud.appwrite.io/v1",
    projectId: "69904f4900396667cf4c",
    databaseId: "699054e500210206c665",
    userCollectionId: "users",
    childrenCollectionId: "children",
    videoCollectionId: "videos",
    threatLogCollectionId: "threat_logs",
    accessLogCollectionId: "access_logs",
    pendingStaffCollectionId: "pending_staff",
    storageParentDocsId: "parent_docs",
    storageProfilePicsId: "parent_docs",
    funGeminiFilterId: "69aed56d0034b1b68f9e"
};

const client = new Client();
client
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

export default client;
