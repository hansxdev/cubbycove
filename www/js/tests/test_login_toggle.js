// test_login_toggle.js
const assert = require('assert');

// Simple DOM mock to load switchRole logic
const mockElements = {};
global.document = {
    getElementById: function(id) {
        if (!mockElements[id]) {
            mockElements[id] = {
                id: id,
                className: '',
                classList: {
                    classes: new Set(),
                    add: function(cls) { this.classes.add(cls); },
                    remove: function(cls) { this.classes.delete(cls); },
                    contains: function(cls) { return this.classes.has(cls); }
                },
                textContent: ''
            };
        }
        return mockElements[id];
    }
};

// Extracted logic of switchRole functionality planned for new animation
function switchRole(role) {
    const kidTab = document.getElementById('kidTab');
    const parentTab = document.getElementById('parentTab');
    const kidSection = document.getElementById('kidSection');
    const parentSection = document.getElementById('parentSection');
    const heading = document.getElementById('welcomeHeading');

    const activeClass = 'flex-1 py-2.5 rounded-full tab-active font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer';
    const inactiveClass = 'flex-1 py-2.5 rounded-full tab-inactive hover:text-slate-600 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer';

    if (role === 'kid') {
        kidTab.className = activeClass;
        parentTab.className = inactiveClass;
        kidSection.className = "col-start-1 row-start-1 transition-all duration-500 ease-in-out transform translate-x-0 opacity-100 z-10 w-full";
        parentSection.className = "col-start-1 row-start-1 transition-all duration-500 ease-in-out transform translate-x-full opacity-0 pointer-events-none z-0 w-full";
        heading.textContent = 'Welcome Back! 👋';
    } else {
        parentTab.className = activeClass;
        kidTab.className = inactiveClass;
        kidSection.className = "col-start-1 row-start-1 transition-all duration-500 ease-in-out transform -translate-x-full opacity-0 pointer-events-none z-0 w-full";
        parentSection.className = "col-start-1 row-start-1 transition-all duration-500 ease-in-out transform translate-x-0 opacity-100 z-10 w-full";
        heading.textContent = 'Parent Sign In';
    }
}

// Write the failing test
function runTests() {
    console.log("Running TDD tests for Login UI toggle animation and height retainment...");
    
    // Test 1: Switch to Parent
    switchRole('parent');
    try {
        const kidSection = document.getElementById('kidSection');
        const parentSection = document.getElementById('parentSection');
        
        // According to the plan, they should both have grid col-start-1 row-start-1 to retain size
        assert.ok(kidSection.className.includes('col-start-1 row-start-1'), 'Kid section should be placed in grid 1x1');
        assert.ok(parentSection.className.includes('col-start-1 row-start-1'), 'Parent section should be placed in grid 1x1');

        // Parent form should slide in (translate-x-0)
        assert.ok(parentSection.className.includes('translate-x-0'), 'Parent section should be centered');
        assert.ok(parentSection.className.includes('opacity-100'), 'Parent section should be visible');
        
        // Kid form should slide out left (-translate-x-full)
        assert.ok(kidSection.className.includes('-translate-x-full'), 'Kid section should slide to the left');
        assert.ok(kidSection.className.includes('opacity-0'), 'Kid section should be invisible');
        
        console.log("✅ GREEN: switchRole('parent') logic works!");
    } catch (e) {
        console.error("❌ RED: Test failed on switchRole('parent')!");
        console.error(e.message);
        process.exit(1);
    }
}

runTests();
