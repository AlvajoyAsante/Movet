import { setupPoseLandmarker } from './poseDetector.js';

const canvas = document.getElementById('poseCanvas');
const ctx = canvas.getContext('2d');
const instructionText = document.getElementById('instruction-text');

let gameActive = false;
let timer;
let poseMatched = false;

// --- Define your test pose ---
const T_POSE = {
    name: "T-Pose",
    leftArmAngle: 180,
    rightArmAngle: 180,
    margin: 20
};



// --- Calculate the angle at the elbow joint ---
function getAngleBetweenPoints(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };

    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
    const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);

    const cosine = dot / (magAB * magCB);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI);
    return angle;
}

// --- Pose matching logic ---
function checkPose(landmarks) {
    const leftAngle = getAngleBetweenPoints(landmarks[11], landmarks[13], landmarks[15]);
    const rightAngle = getAngleBetweenPoints(landmarks[12], landmarks[14], landmarks[16]);

    // Extract y-values
    const leftY = [landmarks[11].y, landmarks[13].y, landmarks[15].y];
    const rightY = [landmarks[12].y, landmarks[14].y, landmarks[16].y];

    // Horizontal check: max difference between y-coordinates
    const leftAligned = Math.max(...leftY) - Math.min(...leftY) < 0.05;
    const rightAligned = Math.max(...rightY) - Math.min(...rightY) < 0.05;

    console.log(`Left Angle: ${leftAngle.toFixed(2)}, Right Angle: ${rightAngle.toFixed(2)}`);
    console.log(`Left Aligned: ${leftAligned}, Right Aligned: ${rightAligned}`);

    const inMargin = (actual, target, margin) =>
        Math.abs(actual - target) <= margin;

    const leftArmGood = inMargin(leftAngle, T_POSE.leftArmAngle, T_POSE.margin) && leftAligned;
    const rightArmGood = inMargin(rightAngle, T_POSE.rightArmAngle, T_POSE.margin) && rightAligned;

    if (leftArmGood && rightArmGood) {
        poseMatched = true;
        clearTimeout(timer);
        instructionText.innerText = '✅ Great job!';
        gameActive = false;
    }
}


// --- Starts a new round of the game ---
function startGameRound() {
    instructionText.innerText = `Hold a ${T_POSE.name}!`;
    poseMatched = false;
    gameActive = true;

    timer = setTimeout(() => {
        if (!poseMatched) {
            instructionText.innerText = '❌ Game Over! You missed the pose.';
            gameActive = false;
        }
    }, 10000); // 10 seconds to respond
}

// --- Setup pose detection ---
setupPoseLandmarker(canvas, ctx).then(({ startDetectionLoop }) => {
    startDetectionLoop((landmarks) => {
        if (gameActive) {
            checkPose(landmarks);
        }
    });

    startGameRound();
});
