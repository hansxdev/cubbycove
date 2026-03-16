const fs = require('fs');
const path = require('path');

const OLD_PROJECT_ID = '69904f4900396667cf4c';
const FILES_TO_CHECK = [
    'js/assistant_logic.js',
    'js/admin_logic.js',
    'js/create_power_user.js'
];

function checkHardcodedIds() {
    console.log(`🧪 Scanning for hardcoded project ID: ${OLD_PROJECT_ID}...`);
    let foundAny = false;

    FILES_TO_CHECK.forEach(relPath => {
        const absPath = path.resolve('c:/Users/Admin/Documents/cubbycove', relPath);
        if (!fs.existsSync(absPath)) {
            console.log(`⚠️ File not found: ${relPath}`);
            return;
        }

        const content = fs.readFileSync(absPath, 'utf8');
        if (content.includes(OLD_PROJECT_ID)) {
            console.error(`❌ Found old project ID in: ${relPath}`);
            foundAny = true;
        } else {
            console.log(`✅ No old project ID in: ${relPath}`);
        }
    });

    if (foundAny) {
        console.log("🎯 REPRODUCTION SUCCESSFUL: Hardcoded IDs detected.");
        process.exit(1);
    } else {
        console.log("✨ No hardcoded IDs found.");
        process.exit(0);
    }
}

checkHardcodedIds();
