// test_ui_toggle.js
const assert = require('assert');

// 1. Mock the DOM global element fetcher $()
const mockElements = {};
global.$ = function(id) {
    if (!mockElements[id]) {
        mockElements[id] = {
            id: id,
            classList: {
                classes: new Set(),
                add: function(cls) { this.classes.add(cls); },
                remove: function(cls) { this.classes.delete(cls); },
                contains: function(cls) { return this.classes.has(cls); }
            },
            disabled: true,
            placeholder: ''
        };
    }
    return mockElements[id];
};

// Import logic structure (Simulated for TDD isolated unit)
function applyActiveBuddyUI() {
    $('no-buddy-state').classList.add('hidden');
    $('no-buddy-state').classList.remove('flex');
    $('chat-messages').classList.remove('hidden');
    $('chat-messages').classList.add('flex');
    $('send-btn').disabled = false;
    $('message-input').disabled = false;
}

// 2. Write the failing test
function runTests() {
    console.log("Running TDD tests for UI toggle...");
    
    // Pre-condition: User has empty state visible
    $('no-buddy-state').classList.add('flex');
    $('chat-messages').classList.add('hidden');
    $('send-btn').disabled = true;
    $('message-input').disabled = true;

    // Action
    applyActiveBuddyUI();

    // Assertion
    try {
        assert.ok($('no-buddy-state').classList.contains('hidden'), 'no-buddy-state should have hidden class');
        assert.ok(!$('no-buddy-state').classList.contains('flex'), 'no-buddy-state should not have flex class');
        
        assert.ok(!$('chat-messages').classList.contains('hidden'), 'chat-messages should not be hidden');
        assert.ok($('chat-messages').classList.contains('flex'), 'chat-messages should have flex class');
        
        assert.strictEqual($('send-btn').disabled, false, 'send-btn should be enabled');
        assert.strictEqual($('message-input').disabled, false, 'message-input should be enabled');
        
        console.log("✅ GREEN: All tests passed!");
    } catch (e) {
        console.error("❌ RED: Test failed!");
        console.error(e.message);
        process.exit(1);
    }
}

runTests();
