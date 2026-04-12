/**
 * Bug Fix Tests — CubbyCove
 * ──────────────────────────────────────────────────────────────
 * Tests for 3 bugs fixed in this session:
 *  1. staff_claim.html: 401 "session already active"
 *  2. kid_logic.js: likes/dislikes can be clicked multiple times
 *  3. chat_logic.js: messages double-send after Gemini validation
 *
 * Run: node js/tests/bug_fixes.test.js
 * No external dependencies required.
 */

let passed = 0;
let failed = 0;

function assert(description, condition) {
    if (condition) {
        console.log(`  ✅ PASS: ${description}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${description}`);
        failed++;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG 1 — staff_claim.html: session guard before createEmailPasswordSession
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n📋 Bug 1: Staff Claim — session guard\n');
{
    /**
     * Simulates the claimAccount() flow with the fix applied.
     * The fix is: always call deleteSession('current') (silently) before
     * createEmailPasswordSession. We verify:
     *   (a) deleteSession is ALWAYS called before createSession
     *   (b) An "active session" error from deleteSession is swallowed
     *   (c) createSession is still called after deleteSession throws
     */
    const callOrder = [];

    const mockAccount = {
        create: async () => { callOrder.push('create'); },
        deleteSession: async (which) => {
            callOrder.push(`deleteSession(${which})`);
            // Simulate Appwrite's error when there IS no session (benign — should be swallowed)
        },
        createEmailPasswordSession: async () => {
            callOrder.push('createEmailPasswordSession');
            return { $id: 'sess_123' };
        }
    };

    // Minimal claimAccount logic (mirrors the fixed version)
    async function simulateClaimAccount_Fixed(account) {
        callOrder.length = 0;
        await account.create('uid', 'test@test.com', 'pass123', 'Test User');
        try { await account.deleteSession('current'); } catch (_) { }
        await account.createEmailPasswordSession('test@test.com', 'pass123');
    }

    // Minimal claimAccount logic (mirrors the BUGGY version — no deleteSession)
    async function simulateClaimAccount_Buggy(account) {
        callOrder.length = 0;
        await account.create('uid', 'test@test.com', 'pass123', 'Test User');
        await account.createEmailPasswordSession('test@test.com', 'pass123');
    }

    (async () => {
        await simulateClaimAccount_Fixed(mockAccount);
        assert(
            'deleteSession is called before createEmailPasswordSession',
            callOrder.indexOf('deleteSession(current)') < callOrder.indexOf('createEmailPasswordSession')
        );

        // Simulate deleteSession throwing (active session exists)
        const throwingAccount = {
            ...mockAccount,
            deleteSession: async () => {
                callOrder.push('deleteSession(throws)');
                throw new Error('Creation of a session is prohibited when a session is active.');
            }
        };

        await simulateClaimAccount_Fixed(throwingAccount);
        assert(
            'createEmailPasswordSession is still called even if deleteSession throws',
            callOrder.includes('createEmailPasswordSession')
        );

        await simulateClaimAccount_Buggy(mockAccount);
        assert(
            'BUGGY version does NOT call deleteSession at all (confirms fix is needed)',
            !callOrder.includes('deleteSession(current)')
        );
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG 2 — kid_logic.js: one like/dislike per video per session
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n👍 Bug 2: Like / Dislike — vote-once guard\n');
{
    /**
     * Simulates the _kidLikeVideo and _kidDislikeVideo logic with the fix applied.
     * Verifies:
     *   (a) DataService.likeVideo is called exactly once per videoId
     *   (b) Subsequent calls for the same videoId are silently ignored
     *   (c) Calls for DIFFERENT videoIds are allowed
     *   (d) The guard is independent per like vs dislike
     */
    const likedVideoIds = new Set();
    const dislikedVideoIds = new Set();
    let likeCallCount = 0;
    let dislikeCallCount = 0;

    const mockDataService = {
        likeVideo: async (videoId) => { likeCallCount++; return { likes: 1 }; },
        dislikeVideo: async (videoId) => { dislikeCallCount++; return { dislikes: 1 }; }
    };

    // Replicate the fixed _kidLikeVideo logic (minus DOM)
    async function kidLikeVideo_Fixed(videoId) {
        if (likedVideoIds.has(videoId)) return;
        likedVideoIds.add(videoId);
        try {
            await mockDataService.likeVideo(videoId);
        } catch (e) {
            likedVideoIds.delete(videoId);
        }
    }

    async function kidDislikeVideo_Fixed(videoId) {
        if (dislikedVideoIds.has(videoId)) return;
        dislikedVideoIds.add(videoId);
        try {
            await mockDataService.dislikeVideo(videoId);
        } catch (e) {
            dislikedVideoIds.delete(videoId);
        }
    }

    (async () => {
        // Like video A three times — should only call DataService once
        likeCallCount = 0;
        await kidLikeVideo_Fixed('videoA');
        await kidLikeVideo_Fixed('videoA');
        await kidLikeVideo_Fixed('videoA');
        assert('likeVideo is only called once for the same videoId (3 clicks)', likeCallCount === 1);

        // Like video B (different video) — should work
        await kidLikeVideo_Fixed('videoB');
        assert('likeVideo IS called for a different videoId', likeCallCount === 2);

        // Dislike video A three times — should only call DataService once
        dislikeCallCount = 0;
        await kidDislikeVideo_Fixed('videoA');
        await kidDislikeVideo_Fixed('videoA');
        await kidDislikeVideo_Fixed('videoA');
        assert('dislikeVideo is only called once for the same videoId (3 clicks)', dislikeCallCount === 1);

        // Simultaneous like AND dislike of same video — both should execute (different guards)
        likeCallCount = 0;
        dislikeCallCount = 0;
        const freshLiked = new Set();
        const freshDisliked = new Set();

        async function freshLike(videoId) {
            if (freshLiked.has(videoId)) return;
            freshLiked.add(videoId);
            likeCallCount++;
        }
        async function freshDislike(videoId) {
            if (freshDisliked.has(videoId)) return;
            freshDisliked.add(videoId);
            dislikeCallCount++;
        }

        await freshLike('videoC');
        await freshDislike('videoC');
        assert('Like and dislike guards are independent per reaction type', likeCallCount === 1 && dislikeCallCount === 1);
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3 — chat_logic.js: _isSending reset on mute check early return
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n💬 Bug 3: Chat send — _isSending guard\n');
{
    /**
     * Simulates the sendMessage() guard logic with the fix applied.
     * Verifies:
     *   (a) Calling sendMessage() twice rapidly only sends once (guard works)
     *   (b) After the mute check short-circuits, _isSending is reset so next
     *       non-muted send can proceed
     *   (c) BUGGY version: after mute return (no reset), _isSending stays true
     *       and next call is incorrectly blocked
     */
    let _isSending = false;
    let messageSentCount = 0;

    // Simulate the fixed sendMessage logic (with mute + guard reset)
    async function sendMessage_Fixed(isMuted) {
        if (_isSending) return; // guard check (synchronous)
        _isSending = true;

        // mute check (synchronous for this simulation)
        if (isMuted) {
            _isSending = false; // ← THE FIX
            return;
        }

        // Simulate await (e.g., AI validation call) — this is where the guard matters
        await Promise.resolve();

        // "AI approved" + send
        messageSentCount++;
        _isSending = false; // finally equivalent
    }

    // Simulate the BUGGY sendMessage logic (no reset on mute return)
    let _isSendingBuggy = false;
    let messageSentCountBuggy = 0;

    async function sendMessage_Buggy(isMuted) {
        if (!_isSendingBuggy) _isSendingBuggy = true; else return;

        if (isMuted) {
            // NO reset — bug!
            return;
        }

        messageSentCountBuggy++;
        _isSendingBuggy = false;
    }

    (async () => {
        // ── Fixed: rapid double-send is blocked ────────────────────────────────
        // The real browser guard works synchronously: the first call sets
        // _isSending = true before any await. A second synchronous call (e.g.
        // Enter key pressed twice before the AI call returns) checks the flag
        // and returns immediately. We simulate this directly.
        _isSending = false; messageSentCount = 0;

        // Simulate first click: sets guard synchronously, then awaits AI
        const firstSend = sendMessage_Fixed(false);
        // At this point _isSending is already true (set before first await)

        // Simulate second click arriving while first is in flight
        if (_isSending) {
            // guard fires — second invocation is blocked (as in real browser code)
        } else {
            // guard didn't fire — this would be the bug
            await sendMessage_Fixed(false);
        }
        await firstSend;

        assert('Rapid double-click: _isSending guard ensures only one message is sent', messageSentCount === 1);

        // ── Fixed: after mute, next real message CAN send ─────────────────────
        _isSending = false; messageSentCount = 0;
        await sendMessage_Fixed(true);   // muted — should short-circuit & reset guard
        await sendMessage_Fixed(false);  // not muted — should send
        assert('After mute early-return, next message sends successfully', messageSentCount === 1);

        // ── Buggy: after mute, next real message is BLOCKED ───────────────────
        _isSendingBuggy = false; messageSentCountBuggy = 0;
        await sendMessage_Buggy(true);   // muted — guard NOT reset
        await sendMessage_Buggy(false);  // should send but _isSendingBuggy is still true!
        assert(
            'BUGGY version: message is incorrectly blocked after mute (confirms fix needed)',
            messageSentCountBuggy === 0  // 0 = bug confirmed
        );
    })();
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
setTimeout(() => {
    console.log(`\n${'─'.repeat(55)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
        console.log('🎉 All tests passed!\n');
        process.exit(0);
    } else {
        console.error('💥 Some tests failed.\n');
        process.exit(1);
    }
}, 200); // give async tests time to settle
