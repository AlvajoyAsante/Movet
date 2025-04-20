// punch.js
import { setupPoseLandmarker } from './poseDetector.js';

async function init() {
    const canvas = document.getElementById('poseCanvas');
    const ctx = canvas.getContext('2d');
    let score = 0;
    const targetScore = 25;
    let startTime = null;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Game state variables
    const boxWidth = 150, boxHeight = 150;
    const boxes = [
        { x: canvas.width * 0.25 - boxWidth / 2, y: canvas.height * 0.25 - boxHeight / 2 },
        { x: canvas.width * 0.75 - boxWidth / 2, y: canvas.height * 0.25 - boxHeight / 2 },
        { x: canvas.width * 0.25 - boxWidth / 2, y: canvas.height * 0.75 - boxHeight / 2 },
        { x: canvas.width * 0.75 - boxWidth / 2, y: canvas.height * 0.75 - boxHeight / 2 }
    ];
    let currentBoxIndex = 0;
    let gameOver = false;

    // Draw current target box
    function drawBox() {
        const box = boxes[currentBoxIndex];
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 5;
        ctx.strokeRect(box.x, box.y, boxWidth, boxHeight);
    }

    // Check for punch: hand inside box
    function checkPunch(landmarks) {
        const box = boxes[currentBoxIndex];
        const handIndices = [19, 20];
        for (const idx of handIndices) {
            const lm = landmarks[idx];
            if (!lm) continue;
            const x = lm.x * canvas.width;
            const y = lm.y * canvas.height;
            if (x >= box.x && x <= box.x + boxWidth && y >= box.y && y <= box.y + boxHeight) {
                return true;
            }
        }
        return false;
    }

    // Main game tick: draw video, landmarks, box, and check punch
    function gameTick(landmarks) {
        if (gameOver) return;
        drawBox();
        if (checkPunch(landmarks)) {
            score++;
            document.getElementById('score-display').innerText = `Score: ${score}`;

            currentBoxIndex = (currentBoxIndex + 1) % boxes.length;

            if (score === targetScore) {
                gameOver = true;
                const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
                document.getElementById('score-display').innerText = `🎉 Good job! You hit ${targetScore} in ${totalTime} seconds.`;
            }
        }
    }

    // Set up pose landmarker
    const detector = await setupPoseLandmarker(canvas, ctx);

    // Start detection loop with game logic
    detector.startDetectionLoop((landmarks) => {
        if (!startTime) startTime = Date.now();
        gameTick(landmarks);
    });

    // Replay and Home button handlers
    document.getElementById('replay-btn').addEventListener('click', () => {
        currentBoxIndex = 0;
        score = 0;
        gameOver = false;
        startTime = null;
        document.getElementById('score-display').innerText = `Score: ${score}`;
    });

    document.getElementById('home-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
});