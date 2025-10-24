// Robust Web Speech wrapper with explicit mic permission gate.

import { publish } from '../eventBus';

// Web Speech API type declarations
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

let recognition: any = null;
let micReady = false;
let asking = false;
let lastRecognitionTime = 0;
const DEBOUNCE_MS = 800;

// Synonyms mapping for voice commands
const COMMAND_SYNONYMS = {
  // Individual part commands - Chords
  'voice.chords.on': ['chords on', 'pads on'],
  'voice.chords.off': ['chords off', 'pads off'],
  
  // Individual part commands - Lead
  'voice.lead.on': ['lead on', 'melody on', 'synth on'],
  'voice.lead.off': ['lead off', 'melody off', 'synth off'],
  
  // Individual part commands - Bass
  'voice.bass.on': ['bass on', 'sub on'],
  'voice.bass.off': ['bass off', 'sub off'],
  
  // Individual part commands - Kick
  'voice.kick.on': ['kick on', 'bass drum on'],
  'voice.kick.off': ['kick off', 'bass drum off'],
  
  // Individual part commands - Snare
  'voice.snare.on': ['snare on'],
  'voice.snare.off': ['snare off'],
  
  // Individual part commands - Hats
  'voice.hats.on': ['hats on', 'hi-hats on'],
  'voice.hats.off': ['hats off', 'hi-hats off'],
  
  // Legacy melody commands (backward compatibility)
  'voice.melody.on': ['melody on', 'lead on', 'synth on'],
  'voice.melody.off': ['melody off', 'lead off', 'synth off'],
  
  // Legacy drums commands (backward compatibility)
  'voice.drums.on': ['drums on', 'beat on', 'kick on'],
  'voice.drums.off': ['drums off', 'beat off', 'kick off'],
  
  // Transport commands
  'voice.start': ['start', 'play', 'begin'],
  'voice.stop': ['stop', 'pause', 'halt'],
  
  // UI commands
  'ui.settings.open': ['open settings', 'show settings', 'settings'],
  'ui.settings.close': ['close settings', 'hide settings'],
  'ui.about.open': ['open about', 'show about', 'about'],
  'ui.about.close': ['close about', 'hide about'],
  
  // Theme commands
  'ui.theme.club': ['enter club goose', 'club mode', 'club goose'],
  'ui.theme.default': ['exit club goose', 'default mode', 'normal mode'],
  
  // Visualizer commands
  'ui.visuals.on': ['visuals on', 'show visuals', 'enable visuals'],
  'ui.visuals.off': ['visuals off', 'hide visuals', 'disable visuals']
};

// Process voice command with synonyms mapping
function processVoiceCommand(text: string): { event: string; matchedPhrase: string } | null {
  const lowerText = text.toLowerCase().trim();
  
  // Debug: log the input text
  console.log(`🔍 Processing command: "${lowerText}"`);
  
  // Check each command type for matches
  for (const [eventType, synonyms] of Object.entries(COMMAND_SYNONYMS)) {
    for (const synonym of synonyms) {
      if (lowerText.includes(synonym)) {
        console.log(`✅ Match found: "${synonym}" → ${eventType}`);
        return { event: eventType, matchedPhrase: synonym };
      }
    }
  }
  
  console.log(`❌ No match found for: "${lowerText}"`);
  return null;
}

export async function ensureMic(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (micReady) return true;
  if (asking) return false;
  try {
    asking = true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop()); // probe only
    micReady = true;
    return true;
  } catch (e) {
    console.error("Mic permission request failed:", e);
    micReady = false;
    return false;
  } finally {
    asking = false;
  }
}

export function initSpeech(onCommand: (text: string) => void) {
  if (typeof window === "undefined") return;
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    console.warn("Web Speech API not available");
    return;
  }

  recognition = new SR();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (ev: SpeechRecognitionEvent) => {
    const last = ev.results[ev.results.length - 1];
    if (!last?.isFinal) return;
    
    const text = last[0].transcript.trim();
    const now = Date.now();
    
    // Debounce repeated recognitions
    if (now - lastRecognitionTime < DEBOUNCE_MS) {
      console.log("🎤 Voice command debounced:", text);
      return;
    }
    lastRecognitionTime = now;
    
    console.log("🎤 Voice transcript:", text);
    
    // Process command with synonyms mapping
    const command = processVoiceCommand(text);
    if (command) {
      console.log(`🎯 Voice intent: "${command.matchedPhrase}" → ${command.event}`);
      console.log(`📢 Publishing event: ${command.event}`);
      
      // Test if it's a UI command
      if (command.event.startsWith('ui.')) {
        console.log(`🎛️ UI Command detected: ${command.event}`);
      }
      
      publish({ type: command.event as any });
    } else {
      console.log("❓ Voice command not recognized:", text);
      console.log("💡 Available commands: bass on/off, kick on/off, snare on/off, hats on/off, lead on/off, chords on/off, start, stop, open/close settings, open/close about, enter club goose");
      
      // Debug: check if it contains close or settings/about
      if (text.toLowerCase().includes('close') || text.toLowerCase().includes('settings') || text.toLowerCase().includes('about')) {
        console.log("🔍 Debug: Command contains close/settings/about but wasn't recognized");
        console.log("🔍 Available UI commands:", Object.keys(COMMAND_SYNONYMS).filter(k => k.startsWith('ui.')));
      }
    }
    
    // Also call the original callback for backward compatibility
    onCommand(text.toLowerCase());
  };

  recognition.onerror = (e: any) => {
    const errorType = e.error || 'unknown';
    console.log(`Voice recognition error: ${errorType}`);
    
    if (errorType === "not-allowed") {
      console.log("Microphone access denied - voice recognition disabled");
      micReady = false;
      return;
    }
    
    if (errorType === "no-speech") {
      console.log("No speech detected - retrying silently");
      setTimeout(() => startListening().catch(() => {}), 600);
      return;
    }
    
    // For other errors, log but don't retry aggressively
    console.log(`Voice recognition error (${errorType}) - will retry later`);
    setTimeout(() => startListening().catch(() => {}), 2000);
  };

  recognition.onend = () => {
    if (micReady) setTimeout(() => startListening().catch(() => {}), 250);
  };
}

export async function startListening(): Promise<void> {
  if (!recognition) return;
  if (!(await ensureMic())) {
    console.warn("Mic not granted; voice disabled.");
    return;
  }
  try { recognition.start(); console.log("Voice recognition started"); } catch {}
}

export function stopListening(): void {
  try { recognition?.stop(); } catch {}
}

// Dev helper: expose test function for console debugging
if (typeof window !== "undefined") {
  // @ts-ignore
  (window as any).__testVoiceCommand = (text: string) => {
    console.log(`🧪 Testing voice command: "${text}"`);
    const command = processVoiceCommand(text);
    if (command) {
      console.log(`✅ Command recognized: ${command.event}`);
      publish({ type: command.event as any });
    } else {
      console.log(`❌ Command not recognized`);
    }
  };
}