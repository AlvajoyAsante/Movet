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

let awaitingNeutral = false;
let neutralTimerStarted = false;
let neutralTimer = null;

const overlayImg = document.getElementById('pose-overlay');
const whiteOverlay = document.getElementById('white-overlay');

// --- Helper: Check if user is in neutral pose ---
function checkNeutralPosition(landmarks) {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftWrist || !rightWrist || !leftHip || !rightHip) return false;

    const nearHip = (w, h) =>
        Math.abs(w.y - h.y) < 0.1 && Math.abs(w.x - h.x) < 0.15;

    return nearHip(leftWrist, leftHip) && nearHip(rightWrist, rightHip);
}

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
            const leftAngle = getAngleBetweenPoints(lm[11], lm[13], lm[15]);
            const rightAngle = getAngleBetweenPoints(lm[12], lm[14], lm[16]);
            const leftY = [lm[11].y, lm[13].y, lm[15].y];
            const rightY = [lm[12].y, lm[14].y, lm[16].y];
            const leftAligned = Math.max(...leftY) - Math.min(...leftY) < 0.05;
            const rightAligned = Math.max(...rightY) - Math.min(...rightY) < 0.05;
            return (
                Math.abs(leftAngle - 180) <= 20 &&
                Math.abs(rightAngle - 180) <= 20 &&
                leftAligned &&
                rightAligned
            );
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
        name: "Arms Up",
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
    },
    {
        name: "Touch Your Shoulders",
        validate: (lm) => {
            const leftWristNearShoulder = Math.abs(lm[15].x - lm[11].x) < 0.1 && Math.abs(lm[15].y - lm[11].y) < 0.1;
            const rightWristNearShoulder = Math.abs(lm[16].x - lm[12].x) < 0.1 && Math.abs(lm[16].y - lm[12].y) < 0.1;
            return leftWristNearShoulder && rightWristNearShoulder;
        }
    },
    {
        name: "One Arm Up, One Down",
        validate: (lm) => {
            return (
                (lm[16].y < lm[12].y && lm[15].y > lm[11].y) || // Right up, left down
                (lm[15].y < lm[11].y && lm[16].y > lm[12].y)    // Left up, right down
            );
        }
    },
    {
        name: "Hand on Head",
        validate: (lm) => {
            const headY = lm[0].y;
            const leftWristNearHead = Math.abs(lm[15].y - headY) < 0.1;
            const rightWristNearHead = Math.abs(lm[16].y - headY) < 0.1;
            return leftWristNearHead || rightWristNearHead;
        }
    },
    {
        name: "Salute",
        validate: (lm) => {
            const eyeY = (lm[1].y + lm[4].y) / 2;
            const rightWristNearEye = Math.abs(lm[16].y - eyeY) < 0.05 && lm[16].x < lm[4].x;
            return rightWristNearEye;
        }
    },
    {
        name: "Hands Crossed in Front",
        validate: (lm) => {
            const handsClose = Math.abs(lm[15].x - lm[16].x) < 0.15;
            const handsBelowChest = lm[15].y > lm[11].y && lm[16].y > lm[12].y;
            return handsClose && handsBelowChest;
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

        whiteOverlay.style.opacity = 1;
        whiteOverlay.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        overlayImg.style.opacity = 1;

        awaitingNeutral = true;
        neutralTimerStarted = false;
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

        if (awaitingNeutral) {
            const inNeutral = checkNeutralPosition(landmarks);

            whiteOverlay.style.backgroundColor = inNeutral
                ? "rgba(0, 255, 0, 0.3)" // green
                : "rgba(255, 0, 0, 0.3)"; // red

            instructionText.innerText = inNeutral
                ? "✅ Holding neutral position..."
                : "🧍 Return to neutral position!";

            if (inNeutral && !neutralTimerStarted) {
                neutralTimerStarted = true;
                neutralTimer = setTimeout(() => {
                    awaitingNeutral = false;
                    neutralTimerStarted = false;
                    whiteOverlay.style.opacity = 0;
                    overlayImg.style.opacity = 0;
                    startGameRound();
                }, 3000);
            }

            if (!inNeutral && neutralTimerStarted) {
                clearTimeout(neutralTimer);
                neutralTimerStarted = false;
            }

            return;
        }

        if (gameActive) {
            checkPose(landmarks);
        }
    });
});

