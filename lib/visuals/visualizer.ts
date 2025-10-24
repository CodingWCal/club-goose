import { state } from "../state";

const palettes = [
  ["#1a1a2e", "#16213e"],
  ["#0f3460", "#533483"],
  ["#e94560", "#f27121"],
  ["#2d1b69", "#11998e"],
  ["#667eea", "#764ba2"]
];

export function startVisualizer(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let rafId: number;
  let isRunning = true;

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
  };

  const render = () => {
    if (!isRunning) return;

    const { bpm, layers, visuals } = state;
    const time = Date.now() * 0.001;
    const beatTime = (time * bpm) / 60;
    
    // Decay intensity
    const decayedIntensity = Math.max(0, visuals.intensity - 0.005);
    if (decayedIntensity !== visuals.intensity) {
      state.visuals.intensity = decayedIntensity;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background gradient with beat pulse
    const palette = palettes[visuals.paletteIndex] || palettes[0];
    const pulse = Math.sin(beatTime * Math.PI * 2) * 0.5 + 0.5;
    const intensity = visuals.intensity * (0.3 + pulse * 0.7);
    
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(1, palette[1]);
    
    ctx.globalAlpha = intensity;
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;

    // Melody ring
    if (layers.melody) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.15;
      const breathe = Math.sin(beatTime * Math.PI * 2) * 0.3 + 0.7;
      const radius = baseRadius * breathe;
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * visuals.intensity})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drum bars
    if (layers.drums) {
      const barWidth = canvas.width / 12;
      const maxHeight = canvas.height * 0.6;
      
      for (let i = 0; i < 12; i++) {
        const x = i * barWidth;
        const phase = (beatTime + i * 0.1) * Math.PI * 2;
        const height = maxHeight * (0.3 + Math.sin(phase) * 0.4 * visuals.intensity);
        
        ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * visuals.intensity})`;
        ctx.fillRect(x + barWidth * 0.1, canvas.height - height, barWidth * 0.8, height);
      }
    }

    rafId = requestAnimationFrame(render);
  };

  // Initialize
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  render();

  // Return cleanup
  return () => {
    isRunning = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    window.removeEventListener("resize", resizeCanvas);
  };
}
