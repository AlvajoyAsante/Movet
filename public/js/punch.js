import { setupPoseLandmarker } from './poseDetector.js';

async function init() {
    const canvas = document.getElementById('poseCanvas');
    const ctx = canvas.getContext('2d');

    // Set up pose landmarker with the canvas and context
    const detector = await setupPoseLandmarker(canvas, ctx);

    // Start pose detection loop, optionally handle pose landmarks here
    detector.startDetectionLoop((landmarks) => {
        // Here you could add logic specific to punch-out game
        // For now, just logging
        console.log('Pose landmarks:', landmarks);
    });
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
    init().catch(console.error);
});