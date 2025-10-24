"use client";

import { useEffect, useRef } from "react";
import { subscribe } from "@/lib/eventBus";
import { state } from "@/lib/state";

interface SoundwaveVisualizerProps {
  isPlaying: boolean;
  theme: "default" | "club";
}

export default function SoundwaveVisualizer({ isPlaying, theme }: SoundwaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const beatRef = useRef<number>(0);
  const lastBeatTime = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;

    // Subscribe to beat events
    const unsubscribe = subscribe((event) => {
      if (event.type === 'beat.pulse') {
        beatRef.current = 1.0;
        lastBeatTime.current = Date.now();
      }
    });

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    const drawSoundwave = () => {
      if (!isRunning) return;

      const { width, height } = canvas;
      const time = Date.now() * 0.001;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Beat decay
      const beatDecay = Math.max(0, beatRef.current - 0.05);
      beatRef.current = beatDecay;

      // Create soundwave bars
      const barCount = 32;
      const barWidth = width / barCount;
      const maxHeight = height * 0.8;
      const centerY = height / 2;

      // Theme colors
      const isClubTheme = theme === 'club';
      const colors = isClubTheme 
        ? ['#ff00ff', '#00ffff', '#ffff00', '#ff0080', '#8000ff']
        : ['#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff6b6b'];

      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth;
        const progress = i / barCount;
        
        // Create wave pattern with multiple frequencies
        const wave1 = Math.sin(time * 2 + progress * Math.PI * 4) * 0.5 + 0.5;
        const wave2 = Math.sin(time * 3.5 + progress * Math.PI * 6) * 0.3 + 0.3;
        const wave3 = Math.sin(time * 1.2 + progress * Math.PI * 2) * 0.2 + 0.2;
        
        // Combine waves
        const waveHeight = (wave1 + wave2 + wave3) * maxHeight;
        
        // Apply beat response
        const beatMultiplier = 1 + beatRef.current * 0.5;
        const finalHeight = waveHeight * beatMultiplier;
        
        // Color based on height and position
        const colorIndex = Math.floor(progress * colors.length);
        const color = colors[colorIndex] || colors[0];
        
        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, centerY - finalHeight, 0, centerY + finalHeight);
        gradient.addColorStop(0, color + '80'); // 50% opacity
        gradient.addColorStop(0.5, color + 'FF'); // Full opacity
        gradient.addColorStop(1, color + '80'); // 50% opacity
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x + barWidth * 0.1, centerY - finalHeight, barWidth * 0.8, finalHeight * 2);
        
        // Add glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillRect(x + barWidth * 0.1, centerY - finalHeight, barWidth * 0.8, finalHeight * 2);
        ctx.shadowBlur = 0;
      }

      // Add center line
      ctx.strokeStyle = isClubTheme ? '#ffffff' : '#ffffff80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      // Add pulsing center circle on beat
      if (beatRef.current > 0) {
        const pulseRadius = beatRef.current * 20;
        ctx.strokeStyle = isClubTheme ? '#ffff00' : '#4ecdc4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width / 2, centerY, pulseRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(drawSoundwave);
    };

    // Initialize
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    drawSoundwave();

    // Cleanup
    return () => {
      isRunning = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener("resize", resizeCanvas);
      unsubscribe();
    };
  }, [theme]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full opacity-80"
        style={{ mixBlendMode: 'screen' }}
        aria-label="Soundwave visualizer"
      />
    </div>
  );
}
