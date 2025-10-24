import { publish } from "../eventBus";

export async function startVoiceWindow(ms = 2000): Promise<void> {
  if (typeof window === 'undefined') return;

  // Ensure Tone.js is started to satisfy autoplay policy
  await (window as any).Tone?.start?.();

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn('Speech recognition not supported');
    return;
  }

  const recognition = new SpeechRecognition();
  
  // Configure recognition
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  // Set up timeout
  const timeout = setTimeout(() => {
    recognition.stop();
  }, ms);

  // Handle results
  recognition.onresult = (event: any) => {
    clearTimeout(timeout);
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    
    console.log('Voice command:', transcript);
    
    // Match commands and publish events
    switch (transcript) {
      case "open settings":
        publish({ type: "ui.settings.open" });
        break;
      case "close settings":
        publish({ type: "ui.settings.close" });
        break;
      case "open about":
        publish({ type: "ui.about.open" });
        break;
      case "close about":
        publish({ type: "ui.about.close" });
        break;
      case "enter club goose":
        publish({ type: "ui.theme.club" });
        publish({ type: "vis.burst" });
        break;
      default:
        console.log('Unrecognized voice command:', transcript);
        break;
    }
    
    recognition.stop();
  };

  // Handle errors
  recognition.onerror = (event: any) => {
    clearTimeout(timeout);
    console.warn('Speech recognition error:', event.error);
    recognition.stop();
  };

  // Handle end
  recognition.onend = () => {
    clearTimeout(timeout);
  };

  // Start recognition
  try {
    recognition.start();
  } catch (error) {
    clearTimeout(timeout);
    console.error('Failed to start speech recognition:', error);
  }
}

export function openUiVoiceWindow() {
  startVoiceWindow(2000);
}
