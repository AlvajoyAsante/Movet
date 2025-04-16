import { setupPoseLandmarker } from './poseDetector.js';

const canvas = document.getElementById('poseCanvas');
const ctx = canvas.getContext('2d');
const instructionText = document.getElementById('instruction-text');

let gameActive = false;
let poseMatched = false;
let timer;
let currentPose = null;
let previousPose = null;

let userReady = false;
let readyFrameCount = 0;

// 🔧 Angle calculation for joints
function getAngleBetweenPoints(A, B, C) {
    const AB = { x: A.x - B.x, y: A.y - B.y };
    const CB = { x: C.x - B.x, y: C.y - B.y };
    const dot = AB.x * CB.x + AB.y * CB.y;
    const magAB = Math.sqrt(AB.x ** 2 + AB.y ** 2);
    const magCB = Math.sqrt(CB.x ** 2 + CB.y ** 2);
    const cosine = dot / (magAB * magCB);
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * (180 / Math.PI);
}

// 📚 Pose library
const poseLibrary = [
    {
        name: "T-Pose",
        validate: (lm) => {
            const leftYDiff1 = Math.abs(lm[11].y - lm[13].y);
            const leftYDiff2 = Math.abs(lm[13].y - lm[15].y);
            const leftXDist = Math.abs(lm[11].x - lm[15].x);

            const rightYDiff1 = Math.abs(lm[12].y - lm[14].y);
            const rightYDiff2 = Math.abs(lm[14].y - lm[16].y);
            const rightXDist = Math.abs(lm[12].x - lm[16].x);

            const leftAligned = leftYDiff1 < 0.04 && leftYDiff2 < 0.04 && leftXDist > 0.22;
            const rightAligned = rightYDiff1 < 0.04 && rightYDiff2 < 0.04 && rightXDist > 0.22;

            return leftAligned && rightAligned;
        }
    },
    {
        name: "Raise Right Hand",
        validate: (lm) => lm[16].y < lm[12].y
    },
    {
        name: "Raise Left Hand",
        validate: (lm) => lm[15].y < lm[11].y
    },
    {
        name: "Hands in the Air",
        validate: (lm) => lm[15].y < lm[11].y && lm[16].y < lm[12].y
    },
    {
        name: "Hands on Hips",
        validate: (lm) => {
            if (!lm[23] || !lm[24]) return false;
            const leftNearHip = Math.abs(lm[15].y - lm[23].y) < 0.07 && lm[15].y > lm[11].y;
            const rightNearHip = Math.abs(lm[16].y - lm[24].y) < 0.07 && lm[16].y > lm[12].y;
            return leftNearHip && rightNearHip;
        }
    }
];





// 🎯 Detect if user is fully in frame (shoulders and hips)
function isUserProperlyFramed(landmarks) {
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return false;

    // Shoulders must be in the upper third
    const shouldersHighEnough = leftShoulder.y < 0.4 && rightShoulder.y < 0.4;

    // Hips must be in the lower half and below shoulders
    const hipsLowEnough = leftHip.y > 0.6 && rightHip.y > 0.6;
    const hipsBelowShoulders = leftHip.y > leftShoulder.y && rightHip.y > rightShoulder.y;

    return shouldersHighEnough && hipsLowEnough && hipsBelowShoulders;
}




// ✅ Check current pose match
function checkPose(landmarks) {
    if (!currentPose) return;

    const matched = currentPose.validate(landmarks);

    if (matched && !poseMatched) {
        poseMatched = true;
        clearTimeout(timer);
        instructionText.innerText = `✅ You nailed the ${currentPose.name}!`;
        gameActive = false;
        setTimeout(startGameRound, 1500);
    }
}

// 🎲 Pick a new random pose
function getRandomPose() {
    let next;
    do {
        next = poseLibrary[Math.floor(Math.random() * poseLibrary.length)];
    } while (next === previousPose);
    previousPose = next;
    return next;
}

// 🚀 Start a new round
function startGameRound() {
    currentPose = getRandomPose();
    poseMatched = false;
    gameActive = true;
    instructionText.innerText = `Do the "${currentPose.name}" pose!`;

    console.log(`🕹️ New Pose: ${currentPose.name}`);

    timer = setTimeout(() => {
        if (!poseMatched) {
            instructionText.innerText = `❌ Game Over! Missed "${currentPose.name}".`;
            gameActive = false;
        }
    }, 10000);
}

// 🔄 Start the system
setupPoseLandmarker(canvas, ctx).then(({ startDetectionLoop }) => {
    startDetectionLoop((landmarks) => {
        if (!userReady) {
            if (isUserProperlyFramed(landmarks)) {
                readyFrameCount++;
                instructionText.innerText = "🙆 Stay in frame...";
                if (readyFrameCount >= 10) {
                    userReady = true;
                    instructionText.innerText = "✅ You're in frame! Get ready...";
                    setTimeout(startGameRound, 1500);
                }
            } else {
                readyFrameCount = 0;
                instructionText.innerText = "👋 Please get your upper body in the frame!";
            }
            return;
        }

        if (gameActive) {
            checkPose(landmarks);
        }
    });
});
