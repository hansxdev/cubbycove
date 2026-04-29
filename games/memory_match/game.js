// Initialize Kaboom
kaboom({
    global: true,
    background: [0, 48, 73], // deep_space_blue.DEFAULT
    crisp: true // enforces pixel art scaling
});

// Load the custom Google Font
loadFont("PressStart", "Press Start 2P", { css: true });

// Strictly mapped color palette
const COLORS = {
    MOLTEN_LAVA: Color.fromHex("#c80000"), // 600
    MOLTEN_LAVA_DARK: Color.fromHex("#780000"), // DEFAULT
    BRICK_RED: Color.fromHex("#c1121f"), // DEFAULT
    PAPAYA_WHIP: Color.fromHex("#fdf0d5"), // DEFAULT
    DEEP_SPACE_BLUE: Color.fromHex("#003049"), // DEFAULT
    STEEL_BLUE: Color.fromHex("#669bbc") // DEFAULT
};

// 25 distinctive emoji animals
const EMOJIS = [
    "🦊", "🐸", "🐶", "🐱", "🐭", "🐹", "🐰", "🐻", "🐼", "🐨", 
    "🐯", "🦁", "🐮", "🐷", "🐵", "🐔", "🐧", "🐦", "🐤", "🦆", 
    "🦅", "🦉", "🦇", "🐺", "🐗"
];

// Level configuration
// Level 1: 10 cards (5 pairs) -> 5x2
// Level 2: 20 cards (10 pairs) -> 5x4
// Level 3: 30 cards (15 pairs) -> 6x5
// Level 4: 40 cards (20 pairs) -> 8x5
// Level 5: 50 cards (25 pairs) -> 10x5
const LEVELS = [
    { index: 1, cols: 5, rows: 2, pairs: 5 },
    { index: 2, cols: 5, rows: 4, pairs: 10 },
    { index: 3, cols: 6, rows: 5, pairs: 15 },
    { index: 4, cols: 8, rows: 5, pairs: 20 },
    { index: 5, cols: 10, rows: 5, pairs: 25 }
];

// Reusable function to shuffle an array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Particle effect function on match
function spawnParticles(posParam) {
    for (let i = 0; i < 10; i++) {
        add([
            pos(posParam),
            rect(10, 10),
            color(COLORS.PAPAYA_WHIP),
            move(choose([LEFT, RIGHT, UP, DOWN, vec2(1,1), vec2(-1,-1), vec2(1,-1), vec2(-1,1)]), rand(100, 300)),
            offscreen({ destroy: true }),
            lifespan(0.5, { fade: 0.5 })
        ]);
    }
}

// Game Scene
scene("game", (levelIndex) => {
    const levelDef = LEVELS[levelIndex];
    let matched = 0;
    let flippedCards = [];
    let stateCanFlip = true;

    // Header UI
    add([
        text(`Level ${levelDef.index}`, { font: "PressStart", size: height() * 0.05 }),
        pos(center().x, height() * 0.05),
        anchor("center"),
        color(COLORS.PAPAYA_WHIP)
    ]);

    // Create deck
    let deck = [];
    for (let i = 0; i < levelDef.pairs; i++) {
        deck.push(EMOJIS[i]);
        deck.push(EMOJIS[i]); // pairs
    }
    deck = shuffleArray(deck);

    // Calculate grid logic dynamically based on screen size
    const screenWidth = width();
    const screenHeight = height() * 0.8; // Use 80% of height to leave space for top header
    const offsetY = height() * 0.15; // Push grid down

    // Compute base card dimensions to fit the strict layout
    const maxW = screenWidth / levelDef.cols;
    const maxH = screenHeight / levelDef.rows;
    const borderGap = Math.min(maxW, maxH) * 0.1; // 10% gap
    const cardSize = Math.min(maxW, maxH) - borderGap * 2; // the actual card block square

    const startX = (screenWidth - (levelDef.cols * maxW)) / 2 + (maxW / 2);
    const startY = offsetY + (screenHeight - (levelDef.rows * maxH)) / 2 + (maxH / 2);

    let idx = 0;
    for (let row = 0; row < levelDef.rows; row++) {
        for (let col = 0; col < levelDef.cols; col++) {
            const animalEmoji = deck[idx];
            idx++;

            // Create card entity
            const card = add([
                rect(cardSize, cardSize, { radius: cardSize * 0.1 }),
                pos(startX + col * maxW, startY + row * maxH),
                anchor("center"),
                color(COLORS.MOLTEN_LAVA),
                outline(4, COLORS.BRICK_RED),
                area(), // make it clickable
                "card",
                {
                    emoji: animalEmoji,
                    isFlipped: false,
                    isMatched: false,
                    faceObj: null,

                    flipUp() {
                        this.isFlipped = true;
                        this.color = COLORS.PAPAYA_WHIP;
                        
                        // Show emoji text
                        this.faceObj = this.add([
                            text(this.emoji, { size: cardSize * 0.6 }),
                            anchor("center"),
                            color(BLACK)
                        ]);
                    },

                    flipDown() {
                        this.isFlipped = false;
                        this.color = COLORS.MOLTEN_LAVA;
                        
                        if (this.faceObj) {
                            this.faceObj.destroy();
                            this.faceObj = null;
                        }
                    }
                }
            ]);
        }
    }

    // Input Handling
    onClick("card", (c) => {
        if (!stateCanFlip || c.isFlipped || c.isMatched) return;

        c.flipUp();
        flippedCards.push(c);

        if (flippedCards.length === 2) {
            stateCanFlip = false;
            
            if (flippedCards[0].emoji === flippedCards[1].emoji) {
                // IT'S A MATCH
                wait(0.5, () => {
                    spawnParticles(flippedCards[0].pos);
                    spawnParticles(flippedCards[1].pos);

                    flippedCards[0].isMatched = true;
                    flippedCards[1].isMatched = true;
                    
                    flippedCards[0].hidden = true;
                    flippedCards[1].hidden = true;

                    flippedCards = [];
                    matched++;

                    if (matched === levelDef.pairs) {
                        handleLevelComplete(levelIndex);
                    }
                    stateCanFlip = true;
                });
            } else {
                // MISMATCH
                wait(0.8, () => {
                    flippedCards[0].flipDown();
                    flippedCards[1].flipDown();
                    flippedCards = [];
                    stateCanFlip = true;
                });
            }
        }
    });

    function handleLevelComplete(currentLevelIndex) {
        stateCanFlip = false; // block interactions
        wait(1, () => {
            const overlay = add([
                rect(width(), height()),
                color(0,0,0),
                opacity(0.8),
                pos(0,0),
                fixed(),
                z(100)
            ]);

            add([
                text("Great! Level Cleared!", { font: "PressStart", size: height() * 0.05 }),
                pos(width() / 2, height() / 2 - 50),
                anchor("center"),
                color(COLORS.PAPAYA_WHIP),
                fixed(),
                z(101)
            ]);

            add([
                text("+10 Stars Added", { font: "PressStart", size: height() * 0.03 }),
                pos(width() / 2, height() / 2 + 20),
                anchor("center"),
                color(COLORS.STEEL_BLUE),
                fixed(),
                z(101)
            ]);

            // Attempt window reward call
            if (typeof window !== "undefined" && window._claimReward) {
                try {
                    window._claimReward(10);
                } catch (e) {
                    console.error("Reward trigger failed", e);
                }
            }

            // Proceed text
            const btnText = currentLevelIndex + 1 < LEVELS.length ? "Proceed to Next Level" : "Finish Game";
            
            const btn = add([
                rect(width() * 0.6, height() * 0.1, { radius: 10 }),
                pos(width() / 2, height() / 2 + 100),
                anchor("center"),
                color(COLORS.MOLTEN_LAVA_DARK),
                outline(4, COLORS.PAPAYA_WHIP),
                area(),
                fixed(),
                z(101),
                "next_btn"
            ]);

            add([
                text(btnText, { font: "PressStart", size: Math.min(width() * 0.03, 20) }),
                pos(btn.pos),
                anchor("center"),
                color(COLORS.PAPAYA_WHIP),
                fixed(),
                z(102)
            ]);

            onClick("next_btn", () => {
                if (currentLevelIndex + 1 < LEVELS.length) {
                    go("game", currentLevelIndex + 1);
                } else {
                    go("win");
                }
            });
        });
    }
});

// Victory Scene
scene("win", () => {
    add([
        text("You Win!", { font: "PressStart", size: height() * 0.08 }),
        pos(width() / 2, height() / 2 - 60),
        anchor("center"),
        color(COLORS.PAPAYA_WHIP)
    ]);

    add([
        text("You found all matches!", { font: "PressStart", size: height() * 0.04 }),
        pos(width() / 2, height() / 2 + 20),
        anchor("center"),
        color(COLORS.STEEL_BLUE)
    ]);

    const playAgain = add([
        rect(width() * 0.4, height() * 0.1, { radius: 10 }),
        pos(width() / 2, height() / 2 + 120),
        anchor("center"),
        color(COLORS.MOLTEN_LAVA),
        outline(4, COLORS.PAPAYA_WHIP),
        area(),
        "play_again"
    ]);

    add([
        text("Play Again", { font: "PressStart", size: Math.min(width() * 0.04, 24) }),
        pos(playAgain.pos),
        anchor("center"),
        color(COLORS.PAPAYA_WHIP)
    ]);

    onClick("play_again", () => {
        go("game", 0);
    });
});

// Start Game at Level 1 (Index 0)
go("game", 0);
