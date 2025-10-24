"use client";

import { useEffect, useRef } from "react";
import { subscribe, publish } from "@/lib/eventBus";
import * as Tone from "tone";

// Tone.js type declarations
declare global {
  interface Window {
    Tone: typeof Tone;
  }
}

interface StageCanvasProps {
  isPlaying: boolean;
  bpm: number;
  activeLayers: {
    drums: boolean;
    melody: boolean;
  };
  theme: "default" | "club";
}

interface CanvasState {
  bpm: number;
  isPlaying: boolean;
  theme: string;
  activeLayers: {
    drums: boolean;
    melody: boolean;
  };
}

// Animation state
let rafId: number | null = null;
let isRunning = false;
let unsubscribe: (() => void) | null = null;
let toneUnsubscribe: (() => void) | null = null;

// Beat synchronization
let beatFlash = 0;
let barFlash = 0;
let beatDecay = 0.92;
let barDecay = 0.88;

// Gesture modulation state
let saturationBoost = 0;
let saturationDecay = 0.95;
let colorTint = { r: 0, g: 0, b: 0 };
let tintDecay = 0.95;

// Confetti system
interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

let confettiParticles: ConfettiParticle[] = [];

// Confetti functions
function createConfettiBurst(canvas: HTMLCanvasElement) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0080', '#8000ff', '#00ff80'];
  
  for (let i = 0; i < 50; i++) {
    const angle = (Math.PI * 2 * i) / 50 + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 1; // Slight upward bias
    
    confettiParticles.push({
      x: centerX + (Math.random() - 0.5) * 100,
      y: centerY + (Math.random() - 0.5) * 100,
      vx: vx,
      vy: vy,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 3 + Math.random() * 4,
      life: 1.0,
      maxLife: 1.0
    });
  }
}

function updateConfetti(deltaTime: number) {
  confettiParticles = confettiParticles.filter(particle => {
    particle.x += particle.vx * deltaTime;
    particle.y += particle.vy * deltaTime;
    particle.vy += 0.1 * deltaTime; // Gravity
    particle.life -= deltaTime * 0.5; // Fade out
    
    return particle.life > 0;
  });
}

function drawConfetti(ctx: CanvasRenderingContext2D) {
  confettiParticles.forEach(particle => {
    ctx.save();
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.restore();
  });
}

// Orbiting blobs
interface Blob {
  x: number;
  y: number;
  radius: number;
  angle: number;
  speed: number;
  hue: number;
  alpha: number;
  driftX: number;
  driftY: number;
}

const blobs: Blob[] = [];
const BLOB_COUNT = 6;

// Initialize orbiting blobs
function initBlobs(canvas: HTMLCanvasElement) {
  blobs.length = 0;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  for (let i = 0; i < BLOB_COUNT; i++) {
    const angle = (i / BLOB_COUNT) * Math.PI * 2;
    const distance = 80 + Math.random() * 120;
    
    blobs.push({
      x: centerX + Math.cos(angle) * distance,
      y: centerY + Math.sin(angle) * distance,
      radius: 15 + Math.random() * 25,
      angle: angle,
      speed: 0.002 + Math.random() * 0.003,
      hue: Math.random() * 360,
      alpha: 0.3 + Math.random() * 0.4,
      driftX: (Math.random() - 0.5) * 0.5,
      driftY: (Math.random() - 0.5) * 0.5
    });
  }
}

// Update blobs with orbital motion and drift
function updateBlobs(canvas: HTMLCanvasElement, bpm: number, time: number) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const bpmMultiplier = bpm / 120; // Scale drift with BPM
  
  blobs.forEach(blob => {
    // Orbital motion
    blob.angle += blob.speed * bpmMultiplier;
    const baseDistance = 80 + Math.sin(time * 0.001 + blob.angle) * 40;
    
    // Perlin-ish drift
    blob.driftX += (Math.random() - 0.5) * 0.01 * bpmMultiplier;
    blob.driftY += (Math.random() - 0.5) * 0.01 * bpmMultiplier;
    blob.driftX = Math.max(-2, Math.min(2, blob.driftX));
    blob.driftY = Math.max(-2, Math.min(2, blob.driftY));
    
    blob.x = centerX + Math.cos(blob.angle) * baseDistance + blob.driftX;
    blob.y = centerY + Math.sin(blob.angle) * baseDistance + blob.driftY;
    
    // Subtle hue drift
    blob.hue += 0.1 * bpmMultiplier;
    if (blob.hue > 360) blob.hue -= 360;
  });
}

// Color manipulation helpers
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
}

function applySaturationBoost(hex: string, boost: number): string {
  const rgb = hexToRgb(hex);
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const delta = max - min;
  
  if (delta === 0) return hex;
  
  const saturation = delta / max;
  const newSaturation = Math.min(1, saturation + boost);
  
  const factor = newSaturation / saturation;
  const newR = Math.min(255, rgb.r + (rgb.r - min) * (factor - 1));
  const newG = Math.min(255, rgb.g + (rgb.g - min) * (factor - 1));
  const newB = Math.min(255, rgb.b + (rgb.b - min) * (factor - 1));
  
  return rgbToHex(newR, newG, newB);
}

function applyColorTint(hex: string, tint: { r: number; g: number; b: number }): string {
  const rgb = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, rgb.r + tint.r),
    Math.min(255, rgb.g + tint.g),
    Math.min(255, rgb.b + tint.b)
  );
}

// Get layer-based color tints
function getLayerTints(activeLayers: { drums: boolean; melody: boolean }) {
  let tint = { r: 0, g: 0, b: 0 };
  
  if (activeLayers.melody) {
    tint.r += 20; // Brighter magentas
    tint.b += 15;
  }
  
  if (activeLayers.drums) {
    tint.r += 25; // Deeper reds
    tint.g -= 5;
  }
  
  return tint;
}

// Main render function
function render(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, getState: () => CanvasState) {
  if (!isRunning) return;
  
  const { bpm, isPlaying, theme, activeLayers } = getState();
  const time = Date.now() * 0.001;
  const bpmMultiplier = bpm / 120;
  
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Update blobs
  updateBlobs(canvas, bpm, time);
  
  // Create multi-stop gradient background
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const maxRadius = Math.max(canvas.width, canvas.height) * 0.8;
  
  // Theme colors with gesture modulation and layer tints
  const isClubTheme = theme === 'club';
  let color1 = isClubTheme ? '#ff00ff' : '#1a1a2e';
  let color2 = isClubTheme ? '#00ffff' : '#16213e';
  let color3 = isClubTheme ? '#000000' : '#0f0f23';
  
  // Apply layer tints
  const layerTint = getLayerTints(activeLayers);
  color1 = applyColorTint(color1, layerTint);
  color2 = applyColorTint(color2, layerTint);
  
  // Apply saturation boost from raise gestures
  if (saturationBoost > 0) {
    color1 = applySaturationBoost(color1, saturationBoost);
    color2 = applySaturationBoost(color2, saturationBoost);
    saturationBoost *= saturationDecay;
  }
  
  // Apply color tint from flick gestures
  if (colorTint.r > 0 || colorTint.g > 0 || colorTint.b > 0) {
    color1 = applyColorTint(color1, colorTint);
    color2 = applyColorTint(color2, colorTint);
    colorTint.r *= tintDecay;
    colorTint.g *= tintDecay;
    colorTint.b *= tintDecay;
  }
  
  // Create rotating radial gradient with multiple stops
  const gradient = ctx.createRadialGradient(
    centerX + Math.cos(time * bpmMultiplier * 0.1) * 50,
    centerY + Math.sin(time * bpmMultiplier * 0.1) * 50,
    0,
    centerX,
    centerY,
    maxRadius
  );
  
  gradient.addColorStop(0, color1);
  gradient.addColorStop(0.3, color2);
  gradient.addColorStop(0.7, color3);
  gradient.addColorStop(1, isClubTheme ? '#000000' : '#000000');
  
  // Draw background gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw orbiting blobs
  blobs.forEach(blob => {
    ctx.save();
    ctx.globalAlpha = blob.alpha * (isPlaying ? (1 + beatFlash * 0.3) : 0.6);
    
    // Create blob gradient
    const blobGradient = ctx.createRadialGradient(
      blob.x, blob.y, 0,
      blob.x, blob.y, blob.radius
    );
    blobGradient.addColorStop(0, `hsla(${blob.hue}, 70%, 60%, 0.8)`);
    blobGradient.addColorStop(0.7, `hsla(${blob.hue + 30}, 50%, 40%, 0.4)`);
    blobGradient.addColorStop(1, `hsla(${blob.hue + 60}, 30%, 20%, 0)`);
    
    ctx.fillStyle = blobGradient;
    ctx.beginPath();
    ctx.arc(blob.x, blob.y, blob.radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add pulse effect when playing
    if (isPlaying && (beatFlash > 0 || barFlash > 0)) {
      const pulseIntensity = Math.max(beatFlash, barFlash * 1.5);
      ctx.globalAlpha = pulseIntensity * 0.3;
      ctx.fillStyle = `hsla(${blob.hue}, 80%, 80%, ${pulseIntensity})`;
      ctx.beginPath();
      ctx.arc(blob.x, blob.y, blob.radius * (1 + pulseIntensity * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  });
  
  // Update and draw confetti
  updateConfetti(16); // ~60fps
  drawConfetti(ctx);
  
  // Decay beat and bar flashes
  beatFlash *= beatDecay;
  barFlash *= barDecay;
  
  // Continue animation loop
  rafId = requestAnimationFrame(() => render(canvas, ctx, getState));
}

// Beat pulse function
function pulseBeat() {
  beatFlash = 1.0;
  publish({ type: 'beat.pulse' });
}

function pulseBar() {
  barFlash = 1.0;
  publish({ type: 'beat.pulse' }); // Also publish for bar pulses
}

// Main mount function
function mountStageCanvas(canvas: HTMLCanvasElement, { getState }: { getState: () => CanvasState }) {
  if (typeof window === 'undefined') return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Set up canvas size
  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    // Reinitialize blobs for new size
    initBlobs(canvas);
  };
  
  // Initialize
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Subscribe to gesture events for visual effects
  unsubscribe = subscribe((event) => {
    switch (event.type) {
      // Gesture modulation effects
      case 'gesture.raiseRight':
      case 'gesture.raiseLeft':
        saturationBoost = 0.4; // Brief saturation/brightness boost
        break;
      case 'gesture.waveRight':
      case 'gesture.waveLeft':
        // Spawn additional blobs for wave gestures
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const distance = 50 + Math.random() * 100;
          blobs.push({
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance,
            radius: 10 + Math.random() * 15,
            angle: angle,
            speed: 0.003 + Math.random() * 0.005,
            hue: Math.random() * 360,
            alpha: 0.6 + Math.random() * 0.3,
            driftX: (Math.random() - 0.5) * 1,
            driftY: (Math.random() - 0.5) * 1
          });
        }
        break;
      case 'gesture.flickRightDown':
        // Redden palette for slower (down flick)
        colorTint = { r: 30, g: 0, b: 0 };
        break;
      case 'gesture.flickRightUp':
        // Blue/cyan tint for faster (up flick)
        colorTint = { r: 0, g: 20, b: 30 };
        break;
      // Theme changes
      case 'ui.theme.club':
        console.log('🎨 Visualizer: Switching to club theme');
        createConfettiBurst(canvas);
        break;
      case 'ui.theme.default':
        console.log('🎨 Visualizer: Switching to default theme');
        break;
    }
  });
  
  // Set up Tone.js beat synchronization
  if (typeof window !== 'undefined') {
    // Schedule beat pulses
    const beatScheduleId = Tone.Transport.scheduleRepeat((time) => {
      pulseBeat();
    }, '4n');
    
    // Schedule bar pulses
    const barScheduleId = Tone.Transport.scheduleRepeat((time) => {
      pulseBar();
    }, '1m');
    
    // Store schedule IDs for cleanup
    toneUnsubscribe = () => {
      Tone.Transport.clear(beatScheduleId);
      Tone.Transport.clear(barScheduleId);
    };
  }
  
  // Start rendering
  isRunning = true;
  render(canvas, ctx, getState);
  
  // Return cleanup function
  return () => {
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (toneUnsubscribe) {
      toneUnsubscribe();
      toneUnsubscribe = null;
    }
    window.removeEventListener('resize', resizeCanvas);
    
    // Clear all scheduled Tone.js callbacks
    if (typeof window !== 'undefined') {
      Tone.Transport.cancel();
    }
  };
}

export default function StageCanvas({ isPlaying, bpm, activeLayers, theme }: StageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getState = () => ({
      bpm,
      isPlaying,
      theme,
      activeLayers
    });

    cleanupRef.current = mountStageCanvas(canvas, { getState }) || null;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [isPlaying, bpm, activeLayers, theme]);
  
  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-2xl"
      aria-label="Audio visualizer canvas"
    />
  );
}