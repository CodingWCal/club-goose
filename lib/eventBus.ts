export type AppEventType =
  | "gesture.raiseRight" | "gesture.raiseLeft" | "gesture.waveRight" | "gesture.waveLeft" | "gesture.halt"
  | "gesture.flickRightUp" | "gesture.flickRightDown"
  | "voice.start" | "voice.stop" | "voice.faster" | "voice.slower"
  | "voice.melody.on" | "voice.melody.off"
  | "voice.drums.on" | "voice.drums.off"
  | "voice.chords.on" | "voice.chords.off"
  | "voice.lead.on" | "voice.lead.off"
  | "voice.bass.on" | "voice.bass.off"
  | "voice.kick.on" | "voice.kick.off"
  | "voice.snare.on" | "voice.snare.off"
  | "voice.hats.on" | "voice.hats.off"
  | "ui.settings.open" | "ui.settings.close"
  | "ui.about.open" | "ui.about.close"
  | "ui.start" | "ui.theme.club" | "ui.theme.default"
  | "ui.visuals.on" | "ui.visuals.off"
  | "vis.burst" | "vis.pulse"
  | "beat.pulse"
  | "state.updated";

export type AppEvent = { type: AppEventType; payload?: any };
const listeners = new Set<(e: AppEvent) => void>();
export function publish(e: AppEvent) { for (const fn of listeners) fn(e); }
export function subscribe(fn: (e: AppEvent) => void) { listeners.add(fn); return () => listeners.delete(fn); }

// Dev helper: expose publish for console debugging
if (typeof window !== "undefined") {
  // @ts-ignore
  (window as any).__mmPublish = publish;
}

// Debug hooks so you can publish from DevTools
declare global {
  interface Window {
    __mmPub?: (evt: any) => void;
    __mmSub?: (fn: (evt:any)=>void) => void;
  }
}
if (typeof window !== "undefined") {
  (window as any).__mmPub = publish;
  (window as any).__mmSub = subscribe;
}
