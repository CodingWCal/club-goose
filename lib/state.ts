import { publish } from "./eventBus";
export type Layers = { drums: boolean; melody: boolean };
export type IndividualLayers = { lead: boolean; chords: boolean; bass: boolean; kick: boolean; snare: boolean; hats: boolean };
export interface AppState { bpm: number; isPlaying: boolean; layers: Layers; individualLayers: IndividualLayers; visuals: { paletteIndex: number; intensity: number; lastBurstAt: number }; camera: { enabled: boolean }; theme: "default" | "club"; }
export const state: AppState = { bpm: 120, isPlaying: false, layers: { drums: false, melody: false }, individualLayers: { lead: false, chords: false, bass: false, kick: false, snare: false, hats: false }, visuals: { paletteIndex: 0, intensity: 0.25, lastBurstAt: 0 }, camera: { enabled: false }, theme: "club" };
export function setState(p: Partial<AppState>) { Object.assign(state, p); publish({ type: "state.updated", payload: { ...state } }); }

export function bumpIntensity(amount = 0.35) { const v = Math.min(1, (state.visuals.intensity ?? 0) + amount); setState({ visuals: { ...state.visuals, intensity: v } }); }
export function cyclePalette(step = 1) { const next = (state.visuals.paletteIndex + step) % 5; setState({ visuals: { ...state.visuals, paletteIndex: next, lastBurstAt: Date.now() } }); }
export function toggleCamera(enabled: boolean) { setState({ camera: { ...state.camera, enabled } }); }
export function setTheme(theme: "default" | "club") { setState({ theme }); }
export function setIndividualLayer(layer: keyof IndividualLayers, enabled: boolean) { setState({ individualLayers: { ...state.individualLayers, [layer]: enabled } }); }
