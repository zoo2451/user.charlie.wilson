// 1. Setup Canvas and Context
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 2. Game State
let score = 0;
let gameActive = true;
let animationId;

// 3. Game Objects
const dino = {
    x: 50,
    y: 150,
    w: 40,
    h: 40,
    dy: 0,
    jumpForce: 12,
    gravity: 0.6,
    grounded: false
};

const cactus = {
    x: canvas.width,
    y: 160,
    w: 20,
    h: 40,
    speed: 6
};

// 4. Input Handling
window.addEventListener("keydown", (e) => {
    // Jump with Space or Up Arrow
    if ((e.code === "Space" || e.code === "ArrowUp") && dino.grounded) {
        dino.dy = -dino.jumpForce;
        dino.grounded = false;
    }
    // Restart with 'R' if game is over
    if (!gameActive && e.code === "KeyR") {
        resetGame();
    }
});

function resetGame() {
    score = 0;
    cactus.x = canvas.width;
    gameActive = true;
    dino.y = 150;
    dino.dy = 0;
    update(); // Restart the loop
}

function update() {
    if (!gameActive) return;

    // Physics
    dino.dy += dino.gravity;
    dino.y += dino.dy;

    // Floor collision
    if (dino.y + dino.h > 200) {
        dino.y = 200 - dino.h;
        dino.dy = 0;
        dino.grounded = true;
    }

    // Cactus movement
    cactus.x -= cactus.speed;
    if (cactus.x < -cactus.w) {
        cactus.x = canvas.width + Math.random() * 200;
        score++;
        cactus.speed += 0.1; // Make it harder over time
    }

    // Collision Detection
    if (dino.x < cactus.x + cactus.w &&
        dino.x + dino.w > cactus.x &&
        dino.y < cactus.y + cactus.h &&
        dino.y + dino.h > cactus.y) {
        gameActive = false;
    }

    draw();
    animationId = requestAnimationFrame(update);
}

function draw() {
    // Background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Ground Line
    ctx.strokeStyle = "#535353";
    ctx.beginPath();
    ctx.moveTo(0, 190);
    ctx.lineTo(canvas.width, 190);
    ctx.stroke();

    // Draw Dino (the Player)
    ctx.fillStyle = "#535353";
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);

    // Draw Cactus (the Obstacle)
    ctx.fillStyle = "#ff4d4d";
    ctx.fillRect(cactus.x, cactus.y, cactus.w, cactus.h);

    // Draw Score
    ctx.fillStyle = "black";
    ctx.font = "16px 'Courier New', Courier, monospace";
    ctx.fillText("HI SCORE: " + score, 10, 30);

    if (!gameActive) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, canvas.height/2);
        ctx.fillText("Press 'R' to Restart", canvas.width/2, canvas.height/2 + 30);
    }
}

// Start the game!
update();