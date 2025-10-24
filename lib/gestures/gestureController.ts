import { subscribe } from "../eventBus";
import { state, setState } from "../state";
import { openUiVoiceWindow } from "../voice/windowedRecognition";

let isRegistered = false;

export function registerGestureHandlers() {
  if (isRegistered) return;
  isRegistered = true;

  subscribe((event) => {
    switch (event.type) {
      case "gesture.halt":
        handleHalt();
        break;
    }
  });
}

function handleHalt() {
  // Toggle play/pause state
  const newIsPlaying = !state.isPlaying;
  setState({ isPlaying: newIsPlaying });
  
  console.log(`🎭 Halt gesture: ${newIsPlaying ? 'Playing' : 'Paused'}`);
  
  // If we just paused, open voice window for UI commands
  if (!newIsPlaying) {
    openUiVoiceWindow();
  }
}
