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

const scoreText = document.getElementById('score-text');
let score = 0;

const overlayImg = document.getElementById('pose-overlay');
const whiteOverlay = document.getElementById('white-overlay');

let musicStarted = false;
let simonSaid = false; // whether this round included "Simon Says"
let allowPoseDetection = false;

let targetScore = null;
let gameOver = false;

const correctBell = new Audio("assets/audio/correct_buzzer.mp3");
const gameOverSound = new Audio("assets/audio/game_over.mp3");
const backgroundMusic = new Audio("assets/audio/background_audio.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.3;

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
        audio: "T-Pose.m4a",
        validate: (lm) => {
            const leftAngle = getAngleBetweenPoints(lm[11], lm[13], lm[15]);
            const rightAngle = getAngleBetweenPoints(lm[12], lm[14], lm[16]);
            const leftY = [lm[11].y, lm[13].y, lm[15].y];
            const rightY = [lm[12].y, lm[14].y, lm[16].y];
            const leftAligned = Math.max(...leftY) - Math.min(...leftY) < 0.12;
            const rightAligned = Math.max(...rightY) - Math.min(...rightY) < 0.12;
            return (
                Math.abs(leftAngle - 180) <= 25 &&
                Math.abs(rightAngle - 180) <= 25 &&
                leftAligned &&
                rightAligned
            );
        }
    },
    { name: "Right Hand", audio: "Right Hand.m4a", validate: (lm) => lm[16].y < lm[12].y },
    { name: "Left Hand", audio: "Left Hand.m4a", validate: (lm) => lm[15].y < lm[11].y },
    { name: "Arms Up", audio: "Arms Up.m4a", validate: (lm) => lm[15].y < lm[11].y && lm[16].y < lm[12].y },
    {
        name: "Hands on Hips",
        audio: "Hands on Hips.m4a",
        validate: (lm) => {
            if (!lm[23] || !lm[24]) return false;
            const leftNearHip = Math.abs(lm[15].y - lm[23].y) < 0.07 && lm[15].y > lm[11].y;
            const rightNearHip = Math.abs(lm[16].y - lm[24].y) < 0.07 && lm[16].y > lm[12].y;
            return leftNearHip && rightNearHip;
        }
    },
    {
        name: "Touch Your Shoulders",
        audio: "Touch Your Shoulders.m4a",
        validate: (lm) => {
            const l = Math.abs(lm[15].x - lm[11].x) < 0.1 && Math.abs(lm[15].y - lm[11].y) < 0.1;
            const r = Math.abs(lm[16].x - lm[12].x) < 0.1 && Math.abs(lm[16].y - lm[12].y) < 0.1;
            return l && r;
        }
    },
    {
        name: "One Arm Up, One Down",
        audio: "One Arm Up, One Down.m4a",
        validate: (lm) => (
            (lm[16].y < lm[12].y && lm[15].y > lm[11].y) ||
            (lm[15].y < lm[11].y && lm[16].y > lm[12].y)
        )
    },
    {
        name: "Hands on Head",
        audio: "Hands on Head.m4a",
        validate: (lm) => {
            const headY = lm[0].y;
            return Math.abs(lm[15].y - headY) < 0.1 || Math.abs(lm[16].y - headY) < 0.1;
        }
    },
    {
        name: "Salute",
        audio: "Salute.m4a",
        validate: (lm) => {
            const eyeY = (lm[1].y + lm[4].y) / 2;
            return Math.abs(lm[16].y - eyeY) < 0.05 && lm[16].x < lm[4].x;
        }
    },
    {
        name: "Hands Crossed in Front",
        audio: "cross-hands.m4a",
        validate: (lm) => {
            const handsClose = Math.abs(lm[15].x - lm[16].x) < 0.15;
            const handsBelowChest = lm[15].y > lm[11].y && lm[16].y > lm[12].y;
            return handsClose && handsBelowChest;
        }
    }
];

function playPoseAudio(filename, onComplete) {
    backgroundMusic.volume = 0.1;

    const audio = new Audio(`assets/audio/${filename}`);
    audio.play();

    audio.addEventListener("ended", () => {
        backgroundMusic.volume = 0.3;
        if (onComplete) onComplete();
    });

    audio.addEventListener("error", () => {
        backgroundMusic.volume = 0.3;
        if (onComplete) onComplete();
    });
}


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
// --- Pose check logic ---
function checkPose(landmarks) {
    if (!allowPoseDetection || !currentPose || poseMatched) return;

    const matched = currentPose.validate(landmarks);
    if (!matched) return;

    poseMatched = true;
    clearTimeout(timer);
    gameActive = false;
    allowPoseDetection = false;

    if (simonSaid) {
        score++;
        scoreText.innerText = `Score: ${score}`;
        correctBell.play();

        if (score >= targetScore) {
            gameOver = true;
            instructionText.innerText = `🎉 You won with ${score} points!`;
            backgroundMusic.pause();
            backgroundMusic.currentTime = 0;
            correctBell.play(); // celebratory ding!
            return;
        }


        instructionText.innerText = `✅ You nailed the ${currentPose.name}!`;

        setTimeout(() => {
            instructionText.innerText = `🧍 Return to neutral position!`;
            awaitingNeutral = true;
            whiteOverlay.style.opacity = 1;
            overlayImg.style.opacity = 1;
        }, 1500);
    } else {
        gameOver = true;
        instructionText.innerText = `❌ Game Over! Final Score: ${score}`;
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        gameOverSound.play();
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
    allowPoseDetection = false; // block early detection

    simonSaid = Math.random() < 0.6;

    if (simonSaid) {
        instructionText.innerText = `Simon Says: Do the "${currentPose.name}" pose!`;

        const simonAudio = new Audio("assets/audio/Simon Says.m4a");
        simonAudio.play();
        simonAudio.addEventListener("ended", () => {
            playPoseAudio(currentPose.audio, () => {
                allowPoseDetection = true;

                // ⏱️ Add 10s timer to catch timeout failure
                timer = setTimeout(() => {
                    if (!poseMatched) {
                        instructionText.innerText = `❌ Game Over! Missed "${currentPose.name}".`;
                        gameActive = false;
                        gameOver = true;
                        backgroundMusic.pause();
                        backgroundMusic.currentTime = 0;
                        gameOverSound.play();
                    }
                }, 10000);
            });
        });
    } else {
        instructionText.innerText = `Do the "${currentPose.name}" pose!`;

        playPoseAudio(currentPose.audio, () => {
            allowPoseDetection = true;

            // ✅ Start 5s timeout to reward player for ignoring the fake
            timer = setTimeout(() => {
                if (!poseMatched) {
                    instructionText.innerText = `✅ You ignored the fake!`;
                    score++;
                    scoreText.innerText = `Score: ${score}`;
                    correctBell.play(); // 🔊 Play bell on correct fake-ignore

                    setTimeout(() => {
                        instructionText.innerText = `🧍 Return to neutral position!`;
                        awaitingNeutral = true;
                        whiteOverlay.style.opacity = 1;
                        overlayImg.style.opacity = 1;
                    }, 1500);
                }
            }, 5000);
        });
    }

    console.log(`🕹️ New Pose: ${currentPose.name} | Simon Says: ${simonSaid}`);
}

window.startGameWithTarget = function (target) {
    targetScore = target;
    document.getElementById("game-setup").style.display = "none";
    const gameEl = document.getElementById("game-container");
    gameEl.style.display = "flex";
    requestAnimationFrame(() => gameEl.classList.add("visible"));
    instructionText.innerText = "🙆 Step into frame to begin!";

    // 🔄 Only now start the landmarker + detection
    setupPoseLandmarker(canvas, ctx).then(({ startDetectionLoop }) => {
        startDetectionLoop((landmarks) => {
            if (gameOver) return;

            if (!userReady) {
                if (isUserProperlyFramed(landmarks)) {
                    readyFrameCount++;
                    instructionText.innerText = "🙆 Stay in frame...";
                    if (readyFrameCount >= 10) {
                        userReady = true;
                        instructionText.innerText = "✅ You're in frame! Get ready...";

                        if (!musicStarted) {
                            backgroundMusic.play().then(() => {
                                musicStarted = true;
                                console.log("🎵 Background music started");
                            }).catch(err => {
                                console.warn("❌ Background music failed to play:", err);
                            });
                        }

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
                    ? "rgba(0, 255, 0, 0.3)"
                    : "rgba(255, 0, 0, 0.3)";

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

                        if (!gameOver) {
                            startGameRound();
                        }
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
}




