import { initSpeech, startListening, stopListening } from "./speechClient";
import { publish } from "../eventBus";

// Voice command mapping
const VOICE_COMMANDS: Record<string, string> = {
  // Transport control
  "start": "voice.start",
  "play": "voice.start",
  "stop": "voice.stop", 
  "pause": "voice.stop",
  "halt": "voice.stop",
  
  // Layer control
  "drums on": "voice.drums.on",
  "drums off": "voice.drums.off",
  "melody on": "voice.melody.on", 
  "melody off": "voice.melody.off",
  
  // Individual instrument control
  "bass on": "voice.bass.on",
  "bass off": "voice.bass.off",
  "sub on": "voice.bass.on",
  "sub off": "voice.bass.off",
  "kick on": "voice.kick.on",
  "kick off": "voice.kick.off",
  "bass drum on": "voice.kick.on",
  "bass drum off": "voice.kick.off",
  "snare on": "voice.snare.on",
  "snare off": "voice.snare.off",
  "hats on": "voice.hats.on",
  "hats off": "voice.hats.off",
  "hi-hats on": "voice.hats.on",
  "hi-hats off": "voice.hats.off",
  "lead on": "voice.lead.on",
  "lead off": "voice.lead.off",
  "synth on": "voice.lead.on",
  "synth off": "voice.lead.off",
  "chords on": "voice.chords.on",
  "chords off": "voice.chords.off",
  "pads on": "voice.chords.on",
  "pads off": "voice.chords.off",
  
  // Tempo control
  "faster": "voice.faster",
  "increase tempo": "voice.faster",
  "slower": "voice.slower",
  "decrease tempo": "voice.slower",
  
  // UI control
  "open settings": "ui.settings.open",
  "close settings": "ui.settings.close",
  "open about": "ui.about.open",
  "close about": "ui.about.close",
  "start conducting": "ui.start",
  "enter club goose": "ui.theme.club",
  "exit club goose": "ui.theme.default",
  "club mode": "ui.theme.club",
  "default mode": "ui.theme.default",
  "normal mode": "ui.theme.default",
  "visuals on": "ui.visuals.on",
  "visuals off": "ui.visuals.off",
  "show visuals": "ui.visuals.on",
  "hide visuals": "ui.visuals.off",
  "enable visuals": "ui.visuals.on",
  "disable visuals": "ui.visuals.off"
};

let isInitialized = false;

export async function initVoice(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    // Initialize speech recognition with our command handler
    initSpeech((text: string) => {
      routeVoiceCommand(text);
    });
    
    // Start listening
    await startListening();
    
    isInitialized = true;
    console.log('🎙️ Voice controller initialized');
    
  } catch (error) {
    console.error('Failed to initialize voice controller:', error);
    throw error;
  }
}

export function disposeVoice(): void {
  stopListening();
  isInitialized = false;
  console.log('🎙️ Voice controller disposed');
}

function routeVoiceCommand(transcript: string): void {
  // Normalize the transcript
  const normalizedText = transcript.toLowerCase().trim();
  
  // Look for exact phrase matches
  for (const [phrase, eventType] of Object.entries(VOICE_COMMANDS)) {
    if (normalizedText === phrase || normalizedText.includes(phrase)) {
      console.log(`🎙️ Voice command: "${phrase}" → ${eventType}`);
      
      // Publish the corresponding event
      publish({
        type: eventType as any,
        payload: { 
          transcript: normalizedText,
          matchedPhrase: phrase,
          timestamp: Date.now()
        }
      });
      
      // Only match the first command found
      return;
    }
  }
  
  // Log unrecognized commands for debugging
  console.log(`🎙️ Unrecognized voice command: "${normalizedText}"`);
}

// Additional helper functions for manual control
export function manualVoiceCommand(command: string): void {
  const eventType = VOICE_COMMANDS[command.toLowerCase()];
  if (eventType) {
    publish({
      type: eventType as any,
      payload: {
        transcript: command,
        matchedPhrase: command,
        timestamp: Date.now(),
        manual: true
      }
    });
  }
}

export function getAvailableCommands(): string[] {
  return Object.keys(VOICE_COMMANDS);
}

export function isVoiceInitialized(): boolean {
  return isInitialized;
}
