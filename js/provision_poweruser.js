/**
 * Poweruser Provisioning Script
 * Run this from the terminal using: node js/provision_poweruser.js
 */
const { Client, Users, Databases, ID, Query, Permission, Role } = require('node-appwrite');

const PROJECT_ID = '69b554060007d12c46ee';
const DB_ID = '69b5543d0007695488c5';
const API_KEY = 'standard_891b68b5781dfbea2893d06a8a5a2700167f8199db7ad90f728e4a0046db0408f9814bfd0f93db7238d83f0b553aae0c831d456f08813851c749a032fef50ef4ae9f936398bc542f05d767c7fb3389511257ee5e5b434313cb6ee545f8c4cd61c60228dc9946e0283eed0f8adc85f2823e50c92155ee008bcdfa48be7bfb8fdc';

(async () => {
    console.log("🚀 Provisioning Poweruser...");
    const client = new Client()
        .setEndpoint('https://sgp.cloud.appwrite.io/v1')
        .setProject(PROJECT_ID)
        .setKey(API_KEY);
        
    const users = new Users(client);
    const databases = new Databases(client);

    const email = 'power_user@cubbycove.com';
    const password = 'password123';
    const name = 'Power User';

    let userId;

    try {
        console.log(`Checking if Auth user [${email}] already exists...`);
        const list = await users.list([Query.equal('email', [email])]);
        if (list.total > 0) {
            console.log("🟢 Auth user already exists.");
            userId = list.users[0].$id;
        } else {
            console.log(`⚠️ Auth user not found. Creating [${email}]...`);
            const newUser = await users.create(ID.unique(), email, undefined, password, name);
            userId = newUser.$id;
            console.log("✅ Auth user created successfully.");
        }
    } catch (e) {
        console.error("❌ Failed to verify/create Auth user:", e.message);
        return;
    }

    try {
        console.log(`Checking Database record for [${userId}]...`);
        try {
            await databases.getDocument(DB_ID, 'users', userId);
            console.log("🟢 Database record already exists. Updating permissions...");
            await databases.updateDocument(DB_ID, 'users', userId, undefined, [
                Permission.read(Role.user(userId)),
                Permission.update(Role.user(userId)),
                Permission.read(Role.users()),
            ]);
        } catch (e) {
            if (e.code === 404) {
                console.log(`⚠️ Database record not found. Creating profile for [${userId}]...`);
                await databases.createDocument(DB_ID, 'users', userId, {
                    role: 'super_admin',
                    status: 'active',
                    firstName: 'Power',
                    lastName: 'User',
                    email: email,
                    faceId: 'N/A', // Placeholder as it's required in schema
                    createdAt: new Date().toISOString()
                }, [
                    Permission.read(Role.user(userId)),
                    Permission.update(Role.user(userId)),
                    Permission.read(Role.users()),
                ]);
                console.log("✅ Database record created successfully.");
            } else {
                throw e;
            }
        }
    } catch (e) {
        console.error("❌ Failed to verify/create database record:", e.message);
    }

    console.log("🎉 Poweruser provisioning complete!");
})();
