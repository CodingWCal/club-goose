// MediaPipe globals (loaded dynamically via script tags)
declare const Pose: any;
declare const POSE_LANDMARKS: any;
declare const POSE_CONNECTIONS: any;
declare const Camera: any;
declare const drawConnectors: any;
declare const drawLandmarks: any;

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

type LandmarkCallback = (landmarks: PoseLandmark[]) => void;

// Module-level debug overlay state
let lastLandmarks: any[] | null = null;
let overlayCanvas: HTMLCanvasElement | null = null;
let overlayCtx: CanvasRenderingContext2D | null = null;
let overlayOptions: { mirror?: boolean } = {};
let overlayAnimationId: number | null = null;

class PoseClient {
  private pose: any = null;
  private camera: any = null;
  private isRunning = false;
  private landmarkListeners = new Set<LandmarkCallback>();

  async startPose(videoEl?: HTMLVideoElement): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // Load MediaPipe scripts dynamically
      await this.loadMediaPipeScripts();

      // Initialize MediaPipe Pose
      this.pose = new Pose({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      this.pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.pose.onResults((results: any) => {
        if (results.poseLandmarks) {
          // Store latest landmarks at module level
          lastLandmarks = results.poseLandmarks;
          this.notifyLandmarkListeners(results.poseLandmarks);
        }
      });

      // Set up camera
      const video = videoEl || await this.createVideoElement();
      
      // Initialize camera with MediaPipe Camera utility (now available globally)
      this.camera = new Camera(video, {
        onFrame: async () => {
          if (this.pose && this.isRunning) {
            await this.pose.send({ image: video });
          }
        },
        width: 640,
        height: 480
      });

      await this.camera.start();
      this.isRunning = true;

    } catch (error) {
      console.error('Failed to start pose detection:', error);
      throw new Error('Could not initialize pose detection. Ensure camera permissions are granted.');
    }
  }

  stopPose(): void {
    this.isRunning = false;
    
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    
    if (this.pose) {
      this.pose.close();
      this.pose = null;
    }

    this.landmarkListeners.clear();
    
    // Clear landmarks and stop overlay
    lastLandmarks = null;
    stopOverlayLoop();
  }

  onLandmarks(callback: LandmarkCallback): () => void {
    this.landmarkListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.landmarkListeners.delete(callback);
    };
  }

  private async loadMediaPipeScripts(): Promise<void> {
    // Load MediaPipe Pose if not already loaded
    if (typeof Pose === 'undefined') {
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose');
    }

    // Load MediaPipe Camera Utils if not already loaded
    if (typeof Camera === 'undefined') {
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils');
    }

    // Load MediaPipe Drawing Utils if not already loaded
    if (typeof drawConnectors === 'undefined' || typeof drawLandmarks === 'undefined') {
      await this.loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils');
    }

    // Wait for all globals to be available
    await this.waitForGlobals();
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded (guard against duplicates)
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  private async waitForGlobals(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds at 100ms intervals
      
      const checkGlobals = () => {
        if (typeof Pose !== 'undefined' && 
            typeof POSE_LANDMARKS !== 'undefined' && 
            typeof Camera !== 'undefined') {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('MediaPipe globals failed to load'));
        } else {
          attempts++;
          setTimeout(checkGlobals, 100);
        }
      };
      
      checkGlobals();
    });
  }

  private async createVideoElement(): Promise<HTMLVideoElement> {
    const video = document.createElement('video');
    video.style.display = 'none';
    document.body.appendChild(video);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      
      video.srcObject = stream;
      video.play();
      
      return new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(video);
        video.onerror = () => reject(new Error('Failed to load video stream'));
      });
    } catch (error) {
      document.body.removeChild(video);
      throw new Error('Camera access denied or not available');
    }
  }

  private notifyLandmarkListeners(landmarks: PoseLandmark[]): void {
    for (const listener of this.landmarkListeners) {
      try {
        listener(landmarks);
      } catch (error) {
        console.error('Error in landmark listener:', error);
      }
    }
  }
}

// Module-level overlay functions
function startOverlayLoop(): void {
  // Guard against duplicate rAF
  if (overlayAnimationId !== null) {
    return;
  }

  const drawFrame = () => {
    if (!overlayCanvas || !overlayCtx) {
      overlayAnimationId = null;
      return;
    }

    // Clear canvas
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (lastLandmarks) {
      // Save context for transformations
      overlayCtx.save();

      // Apply mirror transformation if enabled
      if (overlayOptions.mirror) {
        overlayCtx.scale(-1, 1);
        overlayCtx.translate(-overlayCanvas.width, 0);
      }

      try {
        // Draw pose connections (skeleton)
        if (typeof drawConnectors !== 'undefined' && typeof POSE_CONNECTIONS !== 'undefined') {
          drawConnectors(overlayCtx, lastLandmarks, POSE_CONNECTIONS, {
            color: '#22c55e',
            lineWidth: 2
          });
        }

        // Draw landmarks (points)
        if (typeof drawLandmarks !== 'undefined') {
          drawLandmarks(overlayCtx, lastLandmarks, {
            color: '#ef4444',
            fillColor: '#ef4444',
            radius: 2
          });
        }
      } catch (error) {
        console.warn('Error drawing pose overlay:', error);
      }

      // Restore context
      overlayCtx.restore();
    }

    // Continue animation loop
    overlayAnimationId = requestAnimationFrame(drawFrame);
  };

  // Start the animation loop
  overlayAnimationId = requestAnimationFrame(drawFrame);
}

function stopOverlayLoop(): void {
  if (overlayAnimationId !== null) {
    cancelAnimationFrame(overlayAnimationId);
    overlayAnimationId = null;
  }

  if (overlayCanvas && overlayCtx) {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }

  overlayCanvas = null;
  overlayCtx = null;
  overlayOptions = {};
}

// Singleton instance
let poseClientInstance: PoseClient | null = null;

export function startPose(videoEl?: HTMLVideoElement): Promise<void> {
  if (!poseClientInstance) {
    poseClientInstance = new PoseClient();
  }
  return poseClientInstance.startPose(videoEl);
}

export function stopPose(): void {
  if (poseClientInstance) {
    poseClientInstance.stopPose();
    poseClientInstance = null;
  }
}

export function onLandmarks(callback: LandmarkCallback): () => void {
  if (!poseClientInstance) {
    poseClientInstance = new PoseClient();
  }
  return poseClientInstance.onLandmarks(callback);
}

export function setDebugOverlay(canvas: HTMLCanvasElement | null, opts?: { mirror?: boolean }): void {
  // Stop existing overlay
  stopOverlayLoop();

  if (canvas) {
    overlayCanvas = canvas;
    overlayCtx = canvas.getContext('2d');
    overlayOptions = opts || {};
    
    if (overlayCtx) {
      startOverlayLoop();
    }
  }
}

// Browser dev hooks (only in browser environment)
if (typeof window !== 'undefined') {
  // @ts-ignore
  (window as any).__mmOverlaySet = (cv: HTMLCanvasElement) => setDebugOverlay(cv, { mirror: true });
  
  // @ts-ignore
  (window as any).__mmOverlayInfo = () => ({
    hasCanvas: !!overlayCanvas,
    hasCtx: !!overlayCtx,
    hasLandmarks: !!lastLandmarks
  });
}
