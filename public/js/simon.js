// Entry point for the Simon Says game page logic
// Responsible for initializing pose detection and handling game-specific logic later

import { setupPoseLandmarker } from './poseDetector.js';

// Get references to the canvas and its drawing context
const canvas = document.getElementById('poseCanvas');
const ctx = canvas.getContext('2d');

// Start the MediaPipe pose detection system and begin detection loop
setupPoseLandmarker(canvas, ctx).then(({ startDetectionLoop }) => {
    // Begin processing video frames once setup is done
    startDetectionLoop();

    // Eventually, game logic will go here (e.g., check if player performs correct pose)
});
