const fs = require('fs');
const path = require('path');

function runTestAuthPages() {
    console.log("Running TDD test for the Auth Pages redesign...");

    const loginPath = path.join(__dirname, '../login.html');
    const registerPath = path.join(__dirname, '../parent/register_parent.html');

    if (!fs.existsSync(loginPath) || !fs.existsSync(registerPath)) {
        console.error("❌ RED: Essential auth files are missing!");
        process.exit(1);
    }

    const loginHTML = fs.readFileSync(loginPath, 'utf-8');
    const registerHTML = fs.readFileSync(registerPath, 'utf-8');

    // Expected strings for Login Page
    const loginExpectedElements = [
        "Safe fun for everyone.",
        "I'm a Kid",
        "I'm a Parent",
        "Welcome Back!",
        "YOUR USERNAME",
        "YOUR PASSWORD",
        "LET'S PLAY!"
    ];

    // Expected strings for Parent Registration Page
    const registerExpectedElements = [
        "Join the Cubby Cove Adventure!",
        "Basic Info",
        "Upload ID",
        "Face Setup",
        "First Name",
        "Password",
        "You're doing great!",
        "Continue"
    ];

    let passed = true;

    console.log("Checking login.html...");
    loginExpectedElements.forEach(element => {
        if (!loginHTML.includes(element)) {
            console.error(`❌ RED: Missing text/element in login.html: "${element}"`);
            passed = false;
        }
    });

    console.log("Checking register_parent.html...");
    registerExpectedElements.forEach(element => {
        if (!registerHTML.includes(element)) {
            console.error(`❌ RED: Missing text/element in register_parent.html: "${element}"`);
            passed = false;
        }
    });

    if (passed) {
        console.log("✅ GREEN: Both Auth pages have all expected structural elements!");
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runTestAuthPages();
