import * as Tone from 'tone';
import { subscribe } from "../eventBus";
import { state, setState } from "../state";
import { initTransport, startTransport, stopTransport, setBpm } from "./transport";
import { initInstruments, toggleDrums, toggleMelody, setChords, setLead, setBass, setKick, setSnare, setHats } from "./instruments";

let isRegistered = false;
let audioReady = false;
const backlog: any[] = [];


  // Initialize audio systems
export function registerSoundHandlers(): void {
  if (isRegistered) return;

  // Subscribe immediately, but buffer events until audio is ready
  subscribe(async (event) => {
    if (!audioReady) { backlog.push(event); return; }
    
    // Ignore all gesture events - voice events only drive audio
    if (event.type.startsWith("gesture.")) { 
      console.warn("[audio] gesture ignored - voice events only:", event.type); 
      return; 
    }
    
    switch (event.type) {
      /** Transport */
      case "voice.start":
        await handleStart();
        break;

      case "voice.stop":
        await handleStop();
        break;

      /** Tempo commands disabled */

      /** Individual Parts (VOICE – explicit on/off) */
      case "voice.chords.on":
        if (event.type === "voice.chords.on") await startTransport();
        setChords(true);
        break;
      case "voice.chords.off":
        setChords(false);
        break;
      case "voice.lead.on":
        if (event.type === "voice.lead.on") await startTransport();
        setLead(true);
        break;
      case "voice.lead.off":
        setLead(false);
        break;
      case "voice.bass.on":
        console.log("🎵 BASS ON command received!");
        if (event.type === "voice.bass.on") await startTransport();
        setBass(true);
        break;
      case "voice.bass.off":
        console.log("🎵 BASS OFF command received!");
        setBass(false);
        break;
      case "voice.kick.on":
        if (event.type === "voice.kick.on") await startTransport();
        setKick(true);
        break;
      case "voice.kick.off":
        setKick(false);
        break;
      case "voice.snare.on":
        if (event.type === "voice.snare.on") await startTransport();
        setSnare(true);
        break;
      case "voice.snare.off":
        setSnare(false);
        break;
      case "voice.hats.on":
        if (event.type === "voice.hats.on") await startTransport();
        setHats(true);
        break;
      case "voice.hats.off":
        setHats(false);
        break;

      /** Legacy Layers (VOICE – explicit on/off) */
      case "voice.melody.on":
        await setMelody(true);
        break;
      case "voice.melody.off":
        await setMelody(false);
        break;
      case "voice.drums.on":
        await setDrums(true);
        break;
      case "voice.drums.off":
        await setDrums(false);
        break;

      default:
        // ignore
        break;
    }
  });

  // Initialize audio systems, then mark ready and flush any buffered events
  (async () => {
    try {
      await initTransport();
      await initInstruments();
      audioReady = true;
      console.log("Audio ready; flushing", backlog.length, "events");
      for (const evt of backlog.splice(0)) {
        // Only process voice events from backlog - gestures disabled
        if (evt.type.startsWith("gesture.")) {
          console.warn("[audio] gesture ignored - voice events only (backlog):", evt.type);
          continue;
        }
        
        // re-dispatch through the same switch by calling subscribe handler logic
        // simplest way: just fake re-publish by calling the same route above
        // (we're already inside this function, so reuse the switch by pushing through subscribe handler)
        // here we just run the switch inline:
        switch (evt.type) {
          case "voice.start": await handleStart(); break;
          case "voice.stop": await handleStop(); break;
          case "voice.melody.on": await setMelody(true); break;
          case "voice.melody.off": await setMelody(false); break;
          case "voice.drums.on": await setDrums(true); break;
          case "voice.drums.off": await setDrums(false); break;
          default: break;
        }
      }
      console.log("Sound handlers registered");
    } catch (error) {
      console.error("Failed to initialize audio:", error);
    }
  })();

  isRegistered = true;
}
/* ---------- helpers ---------- */

async function handleStart(): Promise<void> {
  try {
    await startTransport();
    Tone.Destination.mute = false;
    setBpm(state.bpm);
    setState({ isPlaying: true });
    console.log("Audio started");
  } catch (error) {
    console.error("Failed to start audio:", error);
  }
}

async function handleStop(): Promise<void> {
  try {
    await stopTransport();
    setState({ isPlaying: false });
    console.log("Audio stopped");
  } catch (error) {
    console.error("Failed to stop audio:", error);
  }
}

// BPM functions removed - tempo commands disabled

/** Explicit setters used by both voice and gesture toggle paths */
async function setMelody(on: boolean): Promise<void> {
  try {
    if (on) await startTransport(); // auto-start when enabling a layer
    toggleMelody(on);               // your instruments API expects the target state
    setState({ layers: { ...state.layers, melody: on } });
    console.log(`Melody ${on ? "enabled" : "disabled"}`);
  } catch (err) {
    console.error("Failed to set melody:", err);
  }
}

async function setDrums(on: boolean): Promise<void> {
  try {
    if (on) await startTransport(); // auto-start when enabling a layer
    toggleDrums(on);
    setState({ layers: { ...state.layers, drums: on } });
    console.log(`Drums ${on ? "enabled" : "disabled"}`);
  } catch (err) {
    console.error("Failed to set drums:", err);
  }
}

