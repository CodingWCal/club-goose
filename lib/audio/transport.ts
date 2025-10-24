import * as Tone from 'tone';
import { setState } from '../state';

// Expose Tone on window for debugging
if (typeof window !== 'undefined') {
  (window as any).Tone = Tone;
}

let isInitialized = false;
let isStarted = false;

export async function initTransport(): Promise<void> {
  if (isInitialized || typeof window === 'undefined') {
    return;
  }

  try {
    await Tone.start();
    Tone.Destination.mute = false;
    Tone.Destination.volume.value = 0; // 0dB unity gain
    Tone.Transport.bpm.value = 120;
    // Do NOT call Transport.stop() here
    
    isInitialized = true;
    isStarted = false;
    console.log('Transport initialized');
  } catch (error) {
    console.error('Failed to initialize transport:', error);
    throw new Error('Could not initialize audio transport');
  }
}

export async function startTransport(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Early return if already running
  if (isStarted) {
    return;
  }

  if (!isInitialized) {
    await initTransport();
  }

  try {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    
    // Ensure destination is unmuted
    Tone.Destination.mute = false;
    
    Tone.Transport.start();
    isStarted = true;
    console.log('Transport started');
  } catch (error) {
    console.error('Failed to start transport:', error);
    throw new Error('Could not start transport');
  }
}

export async function stopTransport(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (isStarted) {
    Tone.Transport.stop();
    isStarted = false;
    console.log('Transport stopped');
  }
}

export function setBpm(bpm: number): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Clamp BPM between 60 and 180
  const clampedBpm = Math.max(60, Math.min(180, bpm));
  
  if (isInitialized) {
    Tone.Transport.bpm.rampTo(clampedBpm, 0.15);
  }
  
  // Update global state
  setState({ bpm: clampedBpm });
}
