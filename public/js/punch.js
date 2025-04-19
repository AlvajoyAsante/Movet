import { setupPoseLandmarker } from './poseDetector.js';

async function init() {
    const canvas = document.getElementById('poseCanvas');
    const ctx = canvas.getContext('2d');

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);

    // Game state variables
    const boxWidth = 150, boxHeight = 150;
    const boxes = [
        { x: canvas.width * 0.25 - boxWidth / 2, y: canvas.height * 0.25 - boxHeight / 2, hit: false },
        { x: canvas.width * 0.75 - boxWidth / 2, y: canvas.height * 0.25 - boxHeight / 2, hit: false },
        { x: canvas.width * 0.25 - boxWidth / 2, y: canvas.height * 0.75 - boxHeight / 2, hit: false },
        { x: canvas.width * 0.75 - boxWidth / 2, y: canvas.height * 0.75 - boxHeight / 2, hit: false }
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

    // Check for punch: wrist inside box
    function checkPunch(landmarks) {
        const box = boxes[currentBoxIndex];
        const wristIndices = [15, 16];
        for (const idx of wristIndices) {
            const lm = landmarks[idx];
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
            currentBoxIndex++;
            if (currentBoxIndex >= boxes.length) {
                gameOver = true;
                document.getElementById('end-buttons').style.display = 'flex';
            }
        }
    }

    // Set up pose landmarker
    const detector = await setupPoseLandmarker(canvas, ctx);

    // Start detection loop with game logic
    detector.startDetectionLoop((landmarks) => {
        gameTick(landmarks);
    });

    // Replay and Home button handlers
    document.getElementById('replay-btn').addEventListener('click', () => {
        currentBoxIndex = 0;
        gameOver = false;
        document.getElementById('end-buttons').style.display = 'none';
    });
    document.getElementById('home-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
});