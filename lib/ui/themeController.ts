import { subscribe } from "../eventBus";
import { state, bumpIntensity } from "../state";

let isRegistered = false;

export function registerThemeHandlers() {
  if (isRegistered) return;
  isRegistered = true;

  subscribe((event) => {
    switch (event.type) {
      case "ui.theme.club":
        handleClubTheme();
        break;
    }
  });
}

function handleClubTheme() {
  // Switch to neon palette and boost intensity
  state.visuals.paletteIndex = 3;
  bumpIntensity(0.8);

  // Optional audio flourish
  if (typeof window !== 'undefined' && (window as any).Tone) {
    try {
      const filter = new (window as any).Tone.Filter(800, "highpass");
      filter.toDestination();
      
      // Create a brief audio flourish
      const synth = new (window as any).Tone.Synth({
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 1.2 }
      }).connect(filter);

      // Play a quick ascending arpeggio
      synth.triggerAttackRelease("C4", "8n");
      setTimeout(() => synth.triggerAttackRelease("E4", "8n"), 100);
      setTimeout(() => synth.triggerAttackRelease("G4", "8n"), 200);
      setTimeout(() => synth.triggerAttackRelease("C5", "4n"), 300);

      // Clean up after 1.5 seconds
      setTimeout(() => {
        synth.dispose();
        filter.dispose();
      }, 1500);

    } catch (error) {
      console.warn('Failed to play club theme audio flourish:', error);
    }
  }

  console.log('🎪 Club theme activated with neon visuals and audio flourish');
}
