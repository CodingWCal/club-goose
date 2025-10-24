import { publish } from '../eventBus';
import { state } from '../state';

// MediaPipe type declarations
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}

// SSR guard
if (typeof window === 'undefined') {
  function startFaceGestures() { /* no-op on SSR */ }
  function stopFaceGestures() { /* no-op on SSR */ }
  function initFaceGestures() { /* no-op on SSR */ }
}

// Tunable constants
const TILT_HOLD_MS = 350;
const TILT_THRESH = 0.10;
const NOD_DELTA = 0.06;
const NOD_WINDOW = 500;
const DOUBLE_WINDOW = 900;
const SHAKE_DELTA = 0.08;
const COOLDOWN_MS = 700;

// EMA smoothing
const ALPHA = 0.35;

// Global state
let faceMesh: any = null;
let camera: any = null;
let isRunning = false;

// Smoothed head pose
let yaw = 0;
let roll = 0;
let pitch = 0;

// Gesture state
let lastTiltStartTime = 0;
let lastTiltDirection = 0; // -1 left, 1 right, 0 none
let lastGestureTime = 0;

// Nod detection
let nodHistory: Array<{ time: number; pitch: number }> = [];
let lastNodTime = 0;

// Shake detection
let shakeHistory: Array<{ time: number; yaw: number }> = [];

// Load MediaPipe scripts
async function loadScripts(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Check if already loaded
  if (window.FaceMesh && window.Camera) return;
  
  return new Promise((resolve, reject) => {
    let scriptsLoaded = 0;
    const totalScripts = 2;
    
    function onScriptLoad() {
      scriptsLoaded++;
      if (scriptsLoaded === totalScripts) resolve();
    }
    
    // Load FaceMesh
    const faceMeshScript = document.createElement('script');
    faceMeshScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js';
    faceMeshScript.onload = onScriptLoad;
    faceMeshScript.onerror = () => reject(new Error('Failed to load FaceMesh'));
    document.head.appendChild(faceMeshScript);
    
    // Load Camera Utils
    const cameraScript = document.createElement('script');
    cameraScript.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
    cameraScript.onload = onScriptLoad;
    cameraScript.onerror = () => reject(new Error('Failed to load Camera Utils'));
    document.head.appendChild(cameraScript);
  });
}

// Compute head pose from landmarks
function computeHeadPose(landmarks: any[]): { yaw: number; roll: number; pitch: number } {
  // Key landmarks
  const leftEar = landmarks[234];   // x, y, z
  const rightEar = landmarks[454];
  const noseTip = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  
  if (!leftEar || !rightEar || !noseTip || !forehead || !chin) {
    return { yaw: 0, roll: 0, pitch: 0 };
  }
  
  // Face dimensions for normalization
  const earDistance = Math.abs(rightEar.x - leftEar.x);
  const faceHeight = Math.abs(chin.y - forehead.y);
  
  if (earDistance === 0 || faceHeight === 0) {
    return { yaw: 0, roll: 0, pitch: 0 };
  }
  
  // Yaw: horizontal ear displacement (normalized)
  const rawYaw = (rightEar.x - leftEar.x) / earDistance;
  
  // Roll: angle of ear-ear line from horizontal
  const earVector = { x: rightEar.x - leftEar.x, y: rightEar.y - leftEar.y };
  const rawRoll = Math.atan2(earVector.y, earVector.x);
  
  // Pitch: chin-forehead displacement (normalized)
  const rawPitch = (chin.y - forehead.y) / faceHeight;
  
  return {
    yaw: rawYaw,
    roll: rawRoll,
    pitch: rawPitch - 0.5 // Center around 0
  };
}

// EMA smoothing
function smoothPose(newPose: { yaw: number; roll: number; pitch: number }): void {
  yaw = ALPHA * newPose.yaw + (1 - ALPHA) * yaw;
  roll = ALPHA * newPose.roll + (1 - ALPHA) * roll;
  pitch = ALPHA * newPose.pitch + (1 - ALPHA) * pitch;
}

// Detect tilt gestures
function detectTilt(): void {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastGestureTime < COOLDOWN_MS) return;
  
  const currentDirection = roll > TILT_THRESH ? 1 : roll < -TILT_THRESH ? -1 : 0;
  
  // Start new tilt
  if (currentDirection !== 0 && lastTiltDirection === 0) {
    lastTiltStartTime = now;
    lastTiltDirection = currentDirection;
    return;
  }
  
  // Continue existing tilt
  if (currentDirection === lastTiltDirection && currentDirection !== 0) {
    const holdDuration = now - lastTiltStartTime;
    
    if (holdDuration >= TILT_HOLD_MS) {
      // Fire gesture
      if (typeof window === 'undefined') return; // SSR guard
      if (currentDirection === 1) {
        // Tilt right - toggle melody
        const event = state.layers.melody ? "voice.melody.off" : "voice.melody.on";
        publish({ type: event });
      } else {
        // Tilt left - toggle drums
        const event = state.layers.drums ? "voice.drums.off" : "voice.drums.on";
        publish({ type: event });
      }
      
      lastGestureTime = now;
      lastTiltDirection = 0;
    }
    return;
  }
  
  // Reset tilt
  lastTiltDirection = 0;
}

// Detect nod gestures
function detectNod(): void {
  if (typeof window === "undefined") return; // SSR guard
  const now = Date.now();
  
  // Check cooldown
  if (now - lastGestureTime < COOLDOWN_MS) return;
  
  // Add current pitch to history
  nodHistory.push({ time: now, pitch });
  
  // Clean old history
  nodHistory = nodHistory.filter(h => now - h.time <= NOD_WINDOW);
  
  if (nodHistory.length < 3) return;
  
  // Look for down→up pattern
  let minPitch = nodHistory[0].pitch;
  let maxPitch = nodHistory[0].pitch;
  let minTime = nodHistory[0].time;
  let maxTime = nodHistory[0].time;
  
  for (const h of nodHistory) {
    if (h.pitch < minPitch) {
      minPitch = h.pitch;
      minTime = h.time;
    }
    if (h.pitch > maxPitch) {
      maxPitch = h.pitch;
      maxTime = h.time;
    }
  }
  
  // Check for valid nod: down then up
  if (maxTime > minTime && (maxPitch - minPitch) >= NOD_DELTA) {
    const timeSinceLastNod = now - lastNodTime;
    
    // Check for double nod
    if (typeof window === 'undefined') return; // SSR guard
    if (timeSinceLastNod <= DOUBLE_WINDOW) {
      // Double nod - faster
      publish({ type: "voice.faster" });
      lastNodTime = 0; // Reset to prevent triple
    } else {
      // Single nod - start/stop
      const event = state.isPlaying ? "voice.stop" : "voice.start";
      publish({ type: event });
      lastNodTime = now;
    }
    
    lastGestureTime = now;
    nodHistory = []; // Clear history
  }
}

// Detect shake gestures
function detectShake(): void {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastGestureTime < COOLDOWN_MS) return;
  
  // Add current yaw to history
  shakeHistory.push({ time: now, yaw });
  
  // Clean old history
  shakeHistory = shakeHistory.filter(h => now - h.time <= DOUBLE_WINDOW);
  
  if (shakeHistory.length < 4) return;
  
  // Look for alternating left-right-left or right-left-right pattern
  let alternations = 0;
  let lastDirection = 0;
  
  for (let i = 1; i < shakeHistory.length; i++) {
    const delta = shakeHistory[i].yaw - shakeHistory[i-1].yaw;
    const currentDirection = Math.abs(delta) >= SHAKE_DELTA ? (delta > 0 ? 1 : -1) : 0;
    
    if (currentDirection !== 0 && currentDirection !== lastDirection && lastDirection !== 0) {
      alternations++;
    }
    
    if (currentDirection !== 0) {
      lastDirection = currentDirection;
    }
  }
  
  // Need at least 2 alternations for a shake
  if (alternations >= 2) {
    if (typeof window === 'undefined') return; // SSR guard
    publish({ type: "voice.slower" });
    lastGestureTime = now;
    shakeHistory = []; // Clear history
  }
}

// Process face mesh results
function onResults(results: any): void {
  if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
    return;
  }
  
  const landmarks = results.multiFaceLandmarks[0];
  const newPose = computeHeadPose(landmarks);
  
  // Smooth the pose
  smoothPose(newPose);
  
  // Detect gestures
  detectTilt();
  detectNod();
  detectShake();
}

// Start face gesture detection
export async function startFaceGestures(video: HTMLVideoElement): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isRunning) return;
  
  try {
    await loadScripts();
    
    // Initialize FaceMesh
    faceMesh = new window.FaceMesh({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      }
    });
    
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });
    
    faceMesh.onResults(onResults);
    
    // Initialize camera
    camera = new window.Camera(video, {
      onFrame: async () => {
        if (faceMesh && isRunning) {
          await faceMesh.send({ image: video });
        }
      },
      width: 640,
      height: 480
    });
    
    // Start camera
    await camera.start();
    isRunning = true;
    
    console.log('Face gestures started');
    
  } catch (error) {
    console.error('Failed to start face gestures:', error);
    throw error;
  }
}

// Stop face gesture detection
export function stopFaceGestures(): void {
  if (!isRunning) return;
  
  isRunning = false;
  
  if (camera) {
    camera.stop();
    camera = null;
  }
  
  if (faceMesh) {
    faceMesh.close();
    faceMesh = null;
  }
  
  // Reset state
  yaw = 0;
  roll = 0;
  pitch = 0;
  lastTiltStartTime = 0;
  lastTiltDirection = 0;
  lastGestureTime = 0;
  nodHistory = [];
  lastNodTime = 0;
  shakeHistory = [];
  
  console.log('Face gestures stopped');
}

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).__faceDbg = () => ({ yaw, roll, pitch });
}
