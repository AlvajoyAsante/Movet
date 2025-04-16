// Responsible for setting up the webcam and pose detection logic using MediaPipe's PoseLandmarker

import {
    FilesetResolver,
    PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

let canvasRef; // Reference to the canvas element
let ctxRef;    // Reference to the canvas drawing context
let video;     // Video element for the webcam feed

// Initializes and returns the pose detector and a loop to process each frame
export async function setupPoseLandmarker(canvas, ctx) {
    canvasRef = canvas;
    ctxRef = ctx;

    // Load the MediaPipe vision task bundle
    const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm'
    );

    // Create a pose detector instance with our desired settings
    const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: 'models/pose_landmarker_full.task' // Load local pose model
        },
        runningMode: 'VIDEO', // Real-time mode
        numPoses: 1           // Only detect the most prominent pose
    });

    // Setup the webcam and stream it to the video element
    video = document.createElement('video');
    video.width = canvas.width;
    video.height = canvas.height;
    video.autoplay = true;
    video.playsInline = true;
    video.style.display = 'none'; // Hide the raw video element
    document.body.appendChild(video);

    // Access webcam stream
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // Wait until the video is ready
    await new Promise(resolve => video.onloadedmetadata = resolve);
    await new Promise(resolve => video.onplaying = resolve);

    // Return an object with the method to start the pose detection loop
    return {
        startDetectionLoop: (onResults) => detectFrame(poseLandmarker, onResults)
    };
}

// Loop that runs on each video frame to detect poses and draw results
function detectFrame(poseLandmarker, onResults) {
    video.requestVideoFrameCallback((now, metadata) => {
        const results = poseLandmarker.detectForVideo(video, metadata.mediaTime * 1000);

        // Draw the current video frame to canvas
        ctxRef.drawImage(video, 0, 0, canvasRef.width, canvasRef.height);

        // If landmarks were detected, draw them as dots
        if (results.landmarks && Array.isArray(results.landmarks[0])) {
            for (const landmark of results.landmarks[0]) {
                const x = landmark.x * canvasRef.width;
                const y = landmark.y * canvasRef.height;

                ctxRef.beginPath();
                ctxRef.arc(x, y, 6, 0, 2 * Math.PI);
                ctxRef.fillStyle = 'deepskyblue';
                ctxRef.fill();
            }

            // Debug log for detected pose landmarks
            console.log('Detected landmarks:', results.landmarks);

            // 🧠 Send the landmarks back to simon.js (if a callback is provided)
            if (typeof onResults === 'function') {
                onResults(results.landmarks[0]); // only return the most prominent pose
            }
        }

        // Continue the loop
        detectFrame(poseLandmarker, onResults);
    });
}