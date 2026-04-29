const fs = require('fs');
const path = require('path');

// TDD Test for Landing Page replacement
function runLandingPageTest() {
    console.log("Running TDD test for the new landing page design...");
    
    const indexPath = path.join(__dirname, '../index.html');
    if (!fs.existsSync(indexPath)) {
        console.error("❌ RED: index.html not found!");
        process.exit(1);
    }

    const htmlContent = fs.readFileSync(indexPath, 'utf-8');

    // Expected strings in the new landing page
    const expectedElements = [
        "Hugs, Fun, and Learning!",
        "Discover magical stories, fun games, and playful adventures",
        "Be a Cubby Now!",
        "Meet the Buddies",
        "Create a parent account",
        "Want to meet your buddies? Ask a parent to create an account for you",
        "href=\"#games\"",
        "href=\"#stories\"",
        "href=\"#parents\"",
        "href=\"#about\"",
        "id=\"games\"",
        "id=\"stories\"",
        "id=\"parents\"",
        "id=\"about\""
    ];

    let passed = true;

    expectedElements.forEach(element => {
        if (!htmlContent.includes(element)) {
            console.error(`❌ RED: Missing expected text/element: "${element}"`);
            passed = false;
        }
    });

    if (passed) {
        console.log("✅ GREEN: Landing page has all expected structural elements!");
        process.exit(0);
    } else {
        process.exit(1);
    }
}

runLandingPageTest();
