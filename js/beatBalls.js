import * as THREE from 'https://unpkg.com/three@0.134.0/build/three.module.js';
import { setupPoseLandmarker } from './poseDetector.js';

// DOM elements and state
const randomBtn = document.getElementById('random-song-btn');
const spotifyPlayer = document.getElementById('spotify-player');
const bpmInput = document.getElementById('bpm-input');
const shineSelect = document.getElementById('shine-select');
const startBtn = document.getElementById('start-btn');

// constant radius for balls and collision detection
const BALL_RADIUS = 20;
// store latest pose landmarks
let currentLandmarks = [];

let bpm = 120;
let shineType = 'matte';
let spawnIntervalId;
let speed = 200; // pixels per second
let score = 0;

let gameRunning = false;
let maxScore = 0;
let poseCtxTransformed = false;

const homeBtn = document.getElementById('home-btn');

// Predefined Spotify track URIs (replace or extend with your own)
const tracks = [
    '4uLU6hMCjMI75M1A2tKUQC', // Never Gonna Give You Up
    '3n3Ppam7vgaVa1iaRUc9Lp', // Twenty One Pilots
    '5CQ30WqJwcep0pYcV4AMNc', // Imagine Dragons
    '3KkXRkHbMCARz0aVfEt68P', // Major Lazer & DJ Snake
    '7ouMYWpwJ422jRcDASZB7P'  // The Beatles
];

randomBtn.addEventListener('click', () => {
    const id = tracks[Math.floor(Math.random() * tracks.length)];
    const embed = document.createElement('iframe');
    embed.setAttribute('src', `https://open.spotify.com/embed/track/${id}`);
    embed.setAttribute('width', '300');
    embed.setAttribute('height', '80');
    embed.setAttribute('frameborder', '0');
    embed.setAttribute('allow', 'encrypted-media');
    spotifyPlayer.innerHTML = '';
    spotifyPlayer.appendChild(embed);
});

startBtn.addEventListener('click', async () => {
    if (!gameRunning) {
        // ▶️ START the game
        score = 0;
        document.getElementById('score-display').innerText = `Score: ${score}`;
        startBtn.innerText = '⏹️ Stop';
        gameRunning = true;

        bpm = parseInt(bpmInput.value, 10) || 120;
        shineType = shineSelect.value;

        startBtn.disabled = true;
        randomBtn.disabled = true;
        bpmInput.disabled = true;
        shineSelect.disabled = true;

        // Clear any existing balls
        if (scene) {
            balls.forEach(ball => scene.remove(ball));
            balls = [];
        }

        initThree();

        // Setup pose detection
        const poseCanvas = document.getElementById('poseCanvas');
        const poseCtx = poseCanvas.getContext('2d');
        if (!poseCtxTransformed) {
            poseCtx.translate(poseCanvas.width, 0);
            poseCtx.scale(-1, 1);
            poseCtxTransformed = true;
        }

        const detector = await setupPoseLandmarker(poseCanvas, poseCtx);
        detector.startDetectionLoop(landmarks => { currentLandmarks = landmarks; });

        const interval = (60 / bpm) * 1000;
        spawnBall();
        spawnIntervalId = setInterval(spawnBall, interval);

        setTimeout(() => {
            startBtn.disabled = false;
        }, 500);
    } else {
        // ⏹️ STOP the game
        gameRunning = false;
        startBtn.innerText = '▶️ Start';

        if (score > maxScore) {
            maxScore = score;
        }

        // Clear interval and remove all balls
        clearInterval(spawnIntervalId);
        spawnIntervalId = null;

        if (scene) {
            balls.forEach(ball => scene.remove(ball));
            balls = [];
        }

        // ✅ Re-enable input fields so user can adjust
        startBtn.disabled = false;
        randomBtn.disabled = false;
        bpmInput.disabled = false;
        shineSelect.disabled = false;
    }
});


// Three.js scene setup
let scene, camera, renderer;
let balls = [];
let prevTime = 0;

function initThree() {
    const canvas = document.getElementById('ballCanvas');
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(
        -canvas.width / 2, canvas.width / 2,
        canvas.height / 2, -canvas.height / 2,
        0.1, 2000
    );
    camera.position.z = 1000;

    renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
    renderer.setSize(canvas.width, canvas.height);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 1, 1);
    scene.add(dirLight);

    prevTime = performance.now();
    animate();
}

function spawnBall() {
    const canvas = document.getElementById('ballCanvas');
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    let material;
    const color = new THREE.Color(`hsl(${Math.random() * 360}, 80%, 60%)`);
    switch (shineType) {
        case 'glossy':
            material = new THREE.MeshPhongMaterial({ color, shininess: 100 });
            break;
        case 'metallic':
            material = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 0.2 });
            break;
        default:
            material = new THREE.MeshLambertMaterial({ color });
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = (Math.random() - 0.5) * canvas.width;
    mesh.position.y = canvas.height / 2 + BALL_RADIUS;
    scene.add(mesh);
    balls.push(mesh);
}

function animate(time) {
    requestAnimationFrame(animate);
    const delta = (time - prevTime) / 1000;
    prevTime = time;
    // get canvases for screen mapping
    const ballCanvas = document.getElementById('ballCanvas');
    const poseCanvas = document.getElementById('poseCanvas');
    for (let i = balls.length - 1; i >= 0; i--) {
        const ball = balls[i];
        // screen coordinates of ball
        const screenX = ball.position.x + ballCanvas.width / 2;
        const screenY = ballCanvas.height / 2 - ball.position.y;
        // check hand-landmark collisions
        let collided = false;
        for (const lm of currentLandmarks) {
            const lx = lm.x * poseCanvas.width;
            const ly = lm.y * poseCanvas.height;
            if ((lx - screenX) ** 2 + (ly - screenY) ** 2 < BALL_RADIUS * BALL_RADIUS) {
                collided = true;
                break;
            }
        }
        if (collided) {
            scene.remove(ball);
            balls.splice(i, 1);

            // 🔼 Update score
            score++;
            const scoreDisplay = document.getElementById('score-display');
            if (scoreDisplay) {
                scoreDisplay.innerText = `Score: ${score}`;
            }

            continue;
        }
        ball.position.y -= speed * delta;
        if (ball.position.y < -document.getElementById('ballCanvas').height / 2 - BALL_RADIUS) {
            scene.remove(ball);
            balls.splice(i, 1);
        }
    }
    renderer.render(scene, camera);
}

homeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
});