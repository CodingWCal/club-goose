import { publish } from "../eventBus";
import { onLandmarks, type PoseLandmark } from "./poseClient";
import { state } from "../state";

const GESTURES_ENABLED = false;
const HALT_ONLY_MODE = true; // Only enable halt gesture when camera is on

// MediaPipe Pose landmark indices
const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16
};

// Flick detection constants (unchanged)
const FLICK_WINDOW_MS = 180;     // recent window to measure velocity
const FLICK_MIN_SPEED = 1.2;     // normalized units/sec (image coords 0..1 per second)
const FLICK_MIN_DELTA_Y = 0.08;  // net vertical delta over window
const FLICK_COOLDOWN = 500;      // ms cooldown between flicks
const FLICK_SUPPRESS_RAISE_MS = 400; // suppress raise detection briefly after flick

// Quick tap constants (tunable/calibrated)
let TAP_PEAK_DELTA_Y = 0.08;     // must rise ≥ 8% above same-side shoulder
let TAP_DROP_HYST = 0.04;        // must drop ≥ 4% below shoulder to fire
const TAP_MIN_MS = 120;          // min time above shoulder before drop
let TAP_MAX_MS = 500;            // max window for up→down tap
const TAP_COOLDOWN_MS = 900;     // per-side cooldown after a fire
let EMA_ALPHA = 0.35;            // smoothing factor for wrist.y
let MIN_VIS = 0.6;               // ignore low-visibility frames

// Double down-chop HALT constants (tunable/calibrated)
let CHOP_DELTA_Y = 0.12;         // each wrist must move ≥12% downward past shoulder
let CHOP_MIN_SPEED = 1.0;        // normalized units/sec downward speed
let CHOP_PAIR_MS = 300;          // max time between the two chops
const HALT_COOLDOWN = 1500;      // cooldown between halts
const HALT_HYST_BACK = 0.06;     // both wrists must return ≥6% above shoulder to re-arm halt

// Calibration state
let calibrated = false;

// Debug listeners
const debugListeners = new Set<(name: string, meta: any) => void>();

interface FlickSample {
  t: number;
  y: number;
}

interface TapState {
  smoothedY: number;
  isArmed: boolean;
  armTime: number;
  lastCooldownEnd: number;
}

interface ChopState {
  hasChopped: boolean;
  chopTime: number;
  smoothedY: number;
  lastY: number;
  lastTime: number;
}

interface HaltState {
  leftChop: ChopState;
  rightChop: ChopState;
  lastHaltTime: number;
  suppressUntilReturn: boolean;
}

interface CalibrationSample {
  leftShoulderY: number;
  rightShoulderY: number;
  leftWristY: number;
  rightWristY: number;
  shoulderWidth: number;
  timestamp: number;
}

// Helper function
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Statistics helpers
function mean(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

class GestureDetector {
  private unsubscribeLandmarks: (() => void) | null = null;
  
  // Flick detection state
  private rightWristSamples: FlickSample[] = [];
  private lastFlickTime = 0;
  private raiseSuppressionUntil = 0;
  
  // Quick tap state
  private rightTapState: TapState = { smoothedY: 0, isArmed: false, armTime: 0, lastCooldownEnd: 0 };
  private leftTapState: TapState = { smoothedY: 0, isArmed: false, armTime: 0, lastCooldownEnd: 0 };
  
  // Double down-chop halt state
  private haltState: HaltState = {
    leftChop: { hasChopped: false, chopTime: 0, smoothedY: 0, lastY: 0, lastTime: 0 },
    rightChop: { hasChopped: false, chopTime: 0, smoothedY: 0, lastY: 0, lastTime: 0 },
    lastHaltTime: 0,
    suppressUntilReturn: false
  };

  init(): void {
    if (this.unsubscribeLandmarks) {
      return; // Already initialized
    }

    this.unsubscribeLandmarks = onLandmarks((landmarks: PoseLandmark[]) => {
      this.processLandmarks(landmarks);
    });

    // Expose debug hook if window exists
    if (typeof window !== 'undefined') {
      // @ts-ignore
      (window as any).__mmOnGesture = (fn: (name: string, meta: any) => void) => {
        debugListeners.add(fn);
        return () => debugListeners.delete(fn);
      };
    }

    // Auto-calibrate on first init (non-blocking)
    if (!calibrated) {
      calibrate().catch(error => {
        console.warn('Auto-calibration failed:', error);
      });
    }
  }

  dispose(): void {
    if (this.unsubscribeLandmarks) {
      this.unsubscribeLandmarks();
      this.unsubscribeLandmarks = null;
    }

    this.rightWristSamples = [];
    this.lastFlickTime = 0;
    this.raiseSuppressionUntil = 0;
    this.rightTapState = { smoothedY: 0, isArmed: false, armTime: 0, lastCooldownEnd: 0 };
    this.leftTapState = { smoothedY: 0, isArmed: false, armTime: 0, lastCooldownEnd: 0 };
    this.haltState = {
      leftChop: { hasChopped: false, chopTime: 0, smoothedY: 0, lastY: 0, lastTime: 0 },
      rightChop: { hasChopped: false, chopTime: 0, smoothedY: 0, lastY: 0, lastTime: 0 },
      lastHaltTime: 0,
      suppressUntilReturn: false
    };

    debugListeners.clear();
  }

  private processLandmarks(landmarks: PoseLandmark[]): void {
    if (landmarks.length < 17) return; // Ensure we have all required landmarks

    // Check if camera is enabled - only process gestures when camera is on
    if (!state.camera.enabled) {
      return;
    }

    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

    // Skip if any landmark is missing or has low visibility
    if (!this.isLandmarkValid(leftShoulder) || 
        !this.isLandmarkValid(rightShoulder) || 
        !this.isLandmarkValid(leftWrist) || 
        !this.isLandmarkValid(rightWrist)) {
      return;
    }

    const now = Date.now();

    // In halt-only mode, only process halt gesture to avoid interfering with voice
    if (HALT_ONLY_MODE) {
      // Only check double down-chop halt gesture
      this.checkDoubleChopHalt(leftShoulder, rightShoulder, leftWrist, rightWrist, now);
      return;
    }

    // Update flick detection samples
    this.updateFlickSamples(rightWrist, now);
    
    // Check flick gestures (for tempo control)
    this.checkFlickGestures(now);

    // Check quick tap gestures (for layer toggles)
    this.checkQuickTapGestures(leftShoulder, rightShoulder, leftWrist, rightWrist, now);
    
    // Check double down-chop halt gesture
    this.checkDoubleChopHalt(leftShoulder, rightShoulder, leftWrist, rightWrist, now);
  }

  private isLandmarkValid(landmark: PoseLandmark): boolean {
    return landmark && 
           typeof landmark.x === 'number' && 
           typeof landmark.y === 'number' &&
           (landmark.visibility === undefined || landmark.visibility > MIN_VIS);
  }

  private updateFlickSamples(rightWrist: PoseLandmark, now: number): void {
    // Add new sample
    this.rightWristSamples.push({ t: now, y: rightWrist.y });
    
    // Remove old samples (keep ~250ms buffer)
    const bufferMs = 250;
    this.rightWristSamples = this.rightWristSamples.filter(sample => now - sample.t <= bufferMs);
    
    // Limit buffer size
    if (this.rightWristSamples.length > 15) {
      this.rightWristSamples.shift();
    }
  }

  private checkFlickGestures(now: number): void {
    if (now - this.lastFlickTime < FLICK_COOLDOWN) {
      return; // In flick cooldown
    }

    if (this.rightWristSamples.length < 3) {
      return; // Need more samples
    }

    // Get samples within flick window
    const windowSamples = this.rightWristSamples.filter(sample => now - sample.t <= FLICK_WINDOW_MS);
    if (windowSamples.length < 2) {
      return;
    }

    // Calculate velocity over the window
    const oldestSample = windowSamples[0];
    const newestSample = windowSamples[windowSamples.length - 1];
    const deltaT = (newestSample.t - oldestSample.t) / 1000; // Convert to seconds
    const deltaY = newestSample.y - oldestSample.y;
    
    if (deltaT <= 0) {
      return;
    }

    const speed = deltaY / deltaT; // positive = downward, negative = upward
    const absDeltaY = Math.abs(deltaY);

    // Check for UP flick (tempo up): negative speed (upward) with sufficient delta
    if (speed <= -FLICK_MIN_SPEED && absDeltaY >= FLICK_MIN_DELTA_Y && deltaY < 0) {
      this.publishFlick('voice.faster', now, { speed: speed.toFixed(3), deltaY: deltaY.toFixed(3) });
      // Clear any current ARM for right side on flick
      this.rightTapState.isArmed = false;
      return;
    }

    // Check for DOWN flick (tempo down): positive speed (downward) with sufficient delta  
    if (speed >= FLICK_MIN_SPEED && absDeltaY >= FLICK_MIN_DELTA_Y && deltaY > 0) {
      this.publishFlick('voice.slower', now, { speed: speed.toFixed(3), deltaY: deltaY.toFixed(3) });
      // Clear any current ARM for right side on flick
      this.rightTapState.isArmed = false;
      return;
    }
  }

  private publishFlick(eventType: string, now: number, meta: any): void {
    this.lastFlickTime = now;
    this.raiseSuppressionUntil = now + FLICK_SUPPRESS_RAISE_MS;
    
    const flickType = eventType === 'voice.faster' ? 'flick.up' : 'flick.down';
    console.log(`🎭 ${flickType}`, meta);
    
    // Notify debug listeners
    for (const listener of debugListeners) {
      try {
        listener(flickType, meta);
      } catch (error) {
        console.error('Error in debug listener:', error);
      }
    }
    
    if (GESTURES_ENABLED) {
      // Publish both the voice event (for audio) and gesture event (for visuals)
      publish({ 
        type: eventType as any,
        payload: { ...meta, timestamp: now }
      });
      
      // Also publish specific gesture event for visual effects
      const gestureEvent = eventType === 'voice.faster' ? 'gesture.flickRightUp' : 'gesture.flickRightDown';
      publish({
        type: gestureEvent as any,
        payload: { ...meta, timestamp: now }
      });
    }
  }

  private checkQuickTapGestures(
    leftShoulder: PoseLandmark,
    rightShoulder: PoseLandmark,
    leftWrist: PoseLandmark,
    rightWrist: PoseLandmark,
    now: number
  ): void {
    // Check if visibility is sufficient
    const leftValid = leftWrist.visibility === undefined || leftWrist.visibility >= MIN_VIS;
    const rightValid = rightWrist.visibility === undefined || rightWrist.visibility >= MIN_VIS;
    const leftShoulderValid = leftShoulder.visibility === undefined || leftShoulder.visibility >= MIN_VIS;
    const rightShoulderValid = rightShoulder.visibility === undefined || rightShoulder.visibility >= MIN_VIS;

    // Process right tap (melody toggle)
    if (rightValid && rightShoulderValid && now > this.raiseSuppressionUntil) {
      this.processTap(this.rightTapState, rightWrist.y, rightShoulder.y, now, 'right');
    }

    // Process left tap (drums toggle)
    if (leftValid && leftShoulderValid) {
      this.processTap(this.leftTapState, leftWrist.y, leftShoulder.y, now, 'left');
    }
  }

  private processTap(tapState: TapState, wristY: number, shoulderY: number, now: number, side: 'left' | 'right'): void {
    // Update smoothed Y using EMA
    if (tapState.smoothedY === 0) {
      tapState.smoothedY = wristY; // Initialize
    } else {
      tapState.smoothedY = EMA_ALPHA * wristY + (1 - EMA_ALPHA) * tapState.smoothedY;
    }

    const peakThreshold = shoulderY - TAP_PEAK_DELTA_Y;
    const dropThreshold = shoulderY + TAP_DROP_HYST;

    // Check if in cooldown
    if (now < tapState.lastCooldownEnd) {
      return;
    }

    if (!tapState.isArmed) {
      // Check for ARM condition: wrist crosses above threshold
      if (tapState.smoothedY < peakThreshold) {
        tapState.isArmed = true;
        tapState.armTime = now;
      }
    } else {
      // Currently armed - check for FIRE condition
      const timeArmed = now - tapState.armTime;
      
      if (timeArmed >= TAP_MIN_MS && timeArmed <= TAP_MAX_MS) {
        // Within valid time window - check for drop
        if (tapState.smoothedY > dropThreshold) {
          // Fire the tap!
          this.fireTap(side, now, {
            timeArmed: timeArmed,
            peakY: tapState.smoothedY.toFixed(3),
            shoulderY: shoulderY.toFixed(3)
          });
          
          // Reset state and start cooldown
          tapState.isArmed = false;
          tapState.lastCooldownEnd = now + TAP_COOLDOWN_MS;
        }
      } else if (timeArmed > TAP_MAX_MS) {
        // Timeout - disarm
        tapState.isArmed = false;
      }
    }
  }

  private fireTap(side: 'left' | 'right', now: number, meta: any): void {
    const eventType = side === 'right' ? 'gesture.waveRight' : 'gesture.waveLeft';
    const logType = side === 'right' ? 'tap.melody' : 'tap.drums';
    
    console.log(`🎭 ${logType}`, meta);
    
    // Notify debug listeners
    for (const listener of debugListeners) {
      try {
        listener(logType, meta);
      } catch (error) {
        console.error('Error in debug listener:', error);
      }
    }
    
    if (GESTURES_ENABLED) {
      publish({
        type: eventType as any,
        payload: { ...meta, timestamp: now }
      });
    }
  }

  private checkDoubleChopHalt(
    leftShoulder: PoseLandmark,
    rightShoulder: PoseLandmark,
    leftWrist: PoseLandmark,
    rightWrist: PoseLandmark,
    now: number
  ): void {
    // Check if in halt cooldown
    if (now - this.haltState.lastHaltTime < HALT_COOLDOWN) {
      return;
    }

    // Check visibility
    const leftValid = (leftWrist.visibility === undefined || leftWrist.visibility >= MIN_VIS) &&
                     (leftShoulder.visibility === undefined || leftShoulder.visibility >= MIN_VIS);
    const rightValid = (rightWrist.visibility === undefined || rightWrist.visibility >= MIN_VIS) &&
                      (rightShoulder.visibility === undefined || rightShoulder.visibility >= MIN_VIS);

    // Process each wrist for chop detection
    if (leftValid) {
      this.processChop(this.haltState.leftChop, leftWrist.y, leftShoulder.y, now, 'left');
    }
    
    if (rightValid) {
      this.processChop(this.haltState.rightChop, rightWrist.y, rightShoulder.y, now, 'right');
    }

    // Check for double chop completion
    this.checkDoubleChopCompletion(leftShoulder.y, rightShoulder.y, leftWrist.y, rightWrist.y, now);
  }

  private processChop(chopState: ChopState, wristY: number, shoulderY: number, now: number, side: 'left' | 'right'): void {
    // Update smoothed Y using EMA
    if (chopState.smoothedY === 0) {
      chopState.smoothedY = wristY;
      chopState.lastY = wristY;
      chopState.lastTime = now;
      return;
    }

    chopState.smoothedY = EMA_ALPHA * wristY + (1 - EMA_ALPHA) * chopState.smoothedY;

    // Calculate speed (positive = downward)
    const deltaT = (now - chopState.lastTime) / 1000;
    if (deltaT <= 0) return;

    const deltaY = chopState.smoothedY - chopState.lastY;
    const speed = deltaY / deltaT;

    // Update for next iteration
    chopState.lastY = chopState.smoothedY;
    chopState.lastTime = now;

    // Check for chop: downward movement past shoulder with sufficient speed
    const chopThreshold = shoulderY + CHOP_DELTA_Y;
    if (!chopState.hasChopped && 
        chopState.smoothedY > chopThreshold && 
        speed >= CHOP_MIN_SPEED) {
      
      chopState.hasChopped = true;
      chopState.chopTime = now;
    }
  }

  private checkDoubleChopCompletion(leftShoulderY: number, rightShoulderY: number, leftWristY: number, rightWristY: number, now: number): void {
    const leftChop = this.haltState.leftChop;
    const rightChop = this.haltState.rightChop;

    // Check if both have chopped within the pair window
    if (leftChop.hasChopped && rightChop.hasChopped) {
      const timeDiff = Math.abs(leftChop.chopTime - rightChop.chopTime);
      
      if (timeDiff <= CHOP_PAIR_MS) {
        // Double chop detected!
        this.fireHalt(now, {
          leftChopTime: leftChop.chopTime,
          rightChopTime: rightChop.chopTime,
          timeDiff: timeDiff
        });
        
        // Reset chop states and start cooldown
        leftChop.hasChopped = false;
        rightChop.hasChopped = false;
        this.haltState.lastHaltTime = now;
        this.haltState.suppressUntilReturn = true;
      }
    }

    // Clean up old single chops that didn't pair
    if (leftChop.hasChopped && now - leftChop.chopTime > CHOP_PAIR_MS) {
      leftChop.hasChopped = false;
    }
    if (rightChop.hasChopped && now - rightChop.chopTime > CHOP_PAIR_MS) {
      rightChop.hasChopped = false;
    }

    // Check hysteresis for re-arming
    if (this.haltState.suppressUntilReturn) {
      const leftBackUp = leftWristY < (leftShoulderY - HALT_HYST_BACK);
      const rightBackUp = rightWristY < (rightShoulderY - HALT_HYST_BACK);
      
      if (leftBackUp && rightBackUp) {
        this.haltState.suppressUntilReturn = false;
      }
    }
  }

  private fireHalt(now: number, meta: any): void {
    console.log('🎭 halt.chop', meta);
    
    // Notify debug listeners
    for (const listener of debugListeners) {
      try {
        listener('halt.chop', meta);
      } catch (error) {
        console.error('Error in debug listener:', error);
      }
    }
    
    publish({
      type: 'gesture.halt' as any,
      payload: { ...meta, timestamp: now }
    });
  }
}

// Calibration function
export async function calibrate(durationMs = 2000): Promise<void> {
  if (calibrated) {
    console.log('Already calibrated, skipping...');
    return;
  }

  console.log('Starting gesture calibration...');
  
  const samples: CalibrationSample[] = [];
  let startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const unsubscribe = onLandmarks((landmarks: PoseLandmark[]) => {
      const now = Date.now();
      if (now - startTime > durationMs) {
        unsubscribe();
        
        try {
          // Process calibration data
          processCalibrationData(samples);
          calibrated = true;
          resolve();
        } catch (error) {
          reject(error);
        }
        return;
      }

      // Collect sample if landmarks are valid
      if (landmarks.length >= 17) {
        const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
        const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];

        // Check visibility
        const hasValidVisibility = [leftShoulder, rightShoulder, leftWrist, rightWrist].every(
          landmark => landmark.visibility === undefined || landmark.visibility > MIN_VIS
        );

        if (hasValidVisibility) {
          const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
          samples.push({
            leftShoulderY: leftShoulder.y,
            rightShoulderY: rightShoulder.y,
            leftWristY: leftWrist.y,
            rightWristY: rightWrist.y,
            shoulderWidth: shoulderWidth,
            timestamp: now
          });
        }
      }
    });

    // Timeout fallback
    setTimeout(() => {
      unsubscribe();
      if (!calibrated) {
        reject(new Error('Calibration timeout - insufficient valid samples'));
      }
    }, durationMs + 500);
  });
}

function processCalibrationData(samples: CalibrationSample[]): void {
  if (samples.length < 10) {
    throw new Error('Insufficient calibration samples');
  }

  // Compute averages
  const shoulderWidth_avg = mean(samples.map(s => s.shoulderWidth));
  const leftShoulderY_avg = mean(samples.map(s => s.leftShoulderY));
  const rightShoulderY_avg = mean(samples.map(s => s.rightShoulderY));

  // Compute wrist noise (standard deviation)
  const leftWristYs = samples.map(s => s.leftWristY);
  const rightWristYs = samples.map(s => s.rightWristY);
  const leftWristStdY = stddev(leftWristYs);
  const rightWristStdY = stddev(rightWristYs);
  const wristStdY = Math.max(leftWristStdY, rightWristStdY);

  // Compute typical wrist speeds for natural movement
  const leftSpeeds: number[] = [];
  const rightSpeeds: number[] = [];
  
  for (let i = 1; i < samples.length; i++) {
    const dt = (samples[i].timestamp - samples[i-1].timestamp) / 1000;
    if (dt > 0 && dt < 0.1) { // Valid time delta
      leftSpeeds.push(Math.abs(samples[i].leftWristY - samples[i-1].leftWristY) / dt);
      rightSpeeds.push(Math.abs(samples[i].rightWristY - samples[i-1].rightWristY) / dt);
    }
  }

  // Derive adaptive thresholds
  (TAP_PEAK_DELTA_Y as any) = clamp(Math.max(0.06, 2.5 * wristStdY), 0.05, 0.12);
  (TAP_DROP_HYST as any) = clamp(Math.max(0.03, 1.5 * wristStdY), 0.02, 0.08);
  (TAP_MAX_MS as any) = clamp(500 + 100 * (1 - shoulderWidth_avg / 0.3), 450, 700);
  (CHOP_DELTA_Y as any) = clamp(0.10 + 0.15 * (0.25 - shoulderWidth_avg), 0.10, 0.18);
  (CHOP_MIN_SPEED as any) = clamp(0.85 + 0.3 * (0.25 - shoulderWidth_avg), 0.80, 1.25);

  // Log calibration results
  console.log("mmCalibrated", {
    tapPeak: Number(TAP_PEAK_DELTA_Y.toFixed(3)),
    tapHyst: Number(TAP_DROP_HYST.toFixed(3)),
    tapMaxMs: TAP_MAX_MS,
    chopDelta: Number(CHOP_DELTA_Y.toFixed(3)),
    chopSpeed: Number(CHOP_MIN_SPEED.toFixed(3)),
    samples: samples.length,
    shoulderWidth: Number(shoulderWidth_avg.toFixed(3)),
    wristNoise: Number(wristStdY.toFixed(4))
  });
}

// Singleton instance
let gestureDetectorInstance: GestureDetector | null = null;

export function initGestureDetector(): void {
  // Only initialize gesture detector if camera is enabled
  if (!state.camera.enabled) {
    console.log("🎭 Gesture detector skipped - camera disabled");
    return;
  }

  if (!gestureDetectorInstance) {
    gestureDetectorInstance = new GestureDetector();
  }
  gestureDetectorInstance.init();
  console.log("🎭 Gesture detector initialized (halt-only mode)");
}

export function disposeGestureDetector(): void {
  if (gestureDetectorInstance) {
    gestureDetectorInstance.dispose();
    gestureDetectorInstance = null;
  }
}

// Handle camera state changes dynamically
export function handleCameraStateChange(): void {
  if (state.camera.enabled) {
    // Camera enabled - initialize gesture detector
    initGestureDetector();
  } else {
    // Camera disabled - dispose gesture detector
    disposeGestureDetector();
    console.log("🎭 Gesture detector disposed - camera disabled");
  }
}

// Browser hooks
if (typeof window !== 'undefined') {
  // Tuning/debug hook
  // @ts-ignore
  (window as any).__mmTune = (p: any = {}) => {
    if (typeof p.tapPeak === 'number')      (TAP_PEAK_DELTA_Y as any) = p.tapPeak;
    if (typeof p.tapHyst === 'number')      (TAP_DROP_HYST as any) = p.tapHyst;
    if (typeof p.tapMaxMs === 'number')     (TAP_MAX_MS as any) = p.tapMaxMs;
    if (typeof p.ema === 'number')          (EMA_ALPHA as any) = p.ema;
    if (typeof p.minVis === 'number')       (MIN_VIS as any) = p.minVis;
    if (typeof p.chopDelta === 'number')    (CHOP_DELTA_Y as any) = p.chopDelta;
    if (typeof p.chopSpeed === 'number')    (CHOP_MIN_SPEED as any) = p.chopSpeed;
    if (typeof p.chopPairMs === 'number')   (CHOP_PAIR_MS as any) = p.chopPairMs;
    console.log('mmTune', { TAP_PEAK_DELTA_Y, TAP_DROP_HYST, TAP_MAX_MS, EMA_ALPHA, MIN_VIS, CHOP_DELTA_Y, CHOP_MIN_SPEED, CHOP_PAIR_MS });
  };

  // Calibration hook
  // @ts-ignore
  (window as any).__mmCalibrate = () => calibrate(2000);
}
