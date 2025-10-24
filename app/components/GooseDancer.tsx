"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as Tone from "tone";

// Tone.js type declarations
declare global {
  interface Window {
    Tone: typeof Tone;
  }
}

interface GooseDancerProps {
  playing: boolean;
}

export interface GooseDancerRef {
  triggerBeat: () => void;
}

const GooseDancer = forwardRef<GooseDancerRef, GooseDancerProps>(
  ({ playing }, ref) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const wingLeftRef = useRef<SVGGElement>(null);
    const wingRightRef = useRef<SVGGElement>(null);
    const footLeftRef = useRef<SVGGElement>(null);
    const footRightRef = useRef<SVGGElement>(null);
    const bodyRef = useRef<SVGGElement>(null);
    const idleSwayRef = useRef<number>(0);
    const animationIdRef = useRef<number | null>(null);

    // Expose triggerBeat method via ref
    useImperativeHandle(ref, () => ({
      triggerBeat: () => {
        // Wings rotate ±20° quickly (ease-out 160ms)
        if (wingLeftRef.current) {
          wingLeftRef.current.style.transition = 'transform 160ms ease-out';
          wingLeftRef.current.style.transform = 'rotate(-20deg)';
          setTimeout(() => {
            if (wingLeftRef.current) {
              wingLeftRef.current.style.transform = 'rotate(0deg)';
            }
          }, 160);
        }
        
        if (wingRightRef.current) {
          wingRightRef.current.style.transition = 'transform 160ms ease-out';
          wingRightRef.current.style.transform = 'rotate(20deg)';
          setTimeout(() => {
            if (wingRightRef.current) {
              wingRightRef.current.style.transform = 'rotate(0deg)';
            }
          }, 160);
        }

        // Feet rotate/step a few degrees
        if (footLeftRef.current) {
          footLeftRef.current.style.transition = 'transform 160ms ease-out';
          footLeftRef.current.style.transform = 'rotate(-8deg)';
          setTimeout(() => {
            if (footLeftRef.current) {
              footLeftRef.current.style.transform = 'rotate(0deg)';
            }
          }, 160);
        }
        
        if (footRightRef.current) {
          footRightRef.current.style.transition = 'transform 160ms ease-out';
          footRightRef.current.style.transform = 'rotate(8deg)';
          setTimeout(() => {
            if (footRightRef.current) {
              footRightRef.current.style.transform = 'rotate(0deg)';
            }
          }, 160);
        }

        // Body scales to 1.04 then back
        if (bodyRef.current) {
          bodyRef.current.style.transition = 'transform 160ms ease-out';
          bodyRef.current.style.transform = 'scale(1.04)';
          setTimeout(() => {
            if (bodyRef.current) {
              bodyRef.current.style.transform = 'scale(1.0)';
            }
          }, 160);
        }
      }
    }));

    // Idle sway animation when not playing
    useEffect(() => {
      const animate = () => {
        if (!svgRef.current) return;

        const time = Date.now() * 0.001;

        // Idle sway (tiny ±2°) when not playing
        if (!playing) {
          idleSwayRef.current = Math.sin(time * 0.8) * 2;
          svgRef.current.style.transform = `rotate(${idleSwayRef.current}deg)`;
        } else {
          svgRef.current.style.transform = 'rotate(0deg)';
        }

        animationIdRef.current = requestAnimationFrame(animate);
      };

      animate();

      return () => {
        if (animationIdRef.current) {
          cancelAnimationFrame(animationIdRef.current);
        }
      };
    }, [playing]);

    // Subscribe to beat source (same as visualizer)
    useEffect(() => {
      if (typeof window === 'undefined') return;

      // Schedule beat pulses on '4n' (same as visualizer)
      const beatScheduleId = Tone.Transport.scheduleRepeat((time) => {
        // triggerBeat will be called by the ref
      }, '4n');

      return () => {
        Tone.Transport.clear(beatScheduleId);
      };
    }, []);

    return (
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <svg
          ref={svgRef}
          width="120"
          height="120"
          viewBox="0 0 120 120"
          className="drop-shadow-lg"
          style={{
            transformOrigin: 'center bottom'
          }}
        >
          {/* Goose Body */}
          <g ref={bodyRef} style={{ transformOrigin: 'center' }}>
            <ellipse
              cx="60"
              cy="75"
              rx="35"
              ry="25"
              fill="#ffffff"
              stroke="#e0e0e0"
              strokeWidth="2"
            />
            
            {/* Goose Neck */}
            <ellipse
              cx="60"
              cy="50"
              rx="8"
              ry="20"
              fill="#ffffff"
              stroke="#e0e0e0"
              strokeWidth="2"
            />
            
            {/* Goose Head */}
            <ellipse
              cx="60"
              cy="30"
              rx="12"
              ry="15"
              fill="#ffffff"
              stroke="#e0e0e0"
              strokeWidth="2"
            />
            
            {/* Goose Beak */}
            <polygon
              points="60,25 70,20 60,15"
              fill="#ff8c00"
              stroke="#ff6b00"
              strokeWidth="1"
            />
            
            {/* Goose Eye */}
            <circle
              cx="65"
              cy="28"
              r="2"
              fill="#000000"
            />
          </g>
          
          {/* Left Wing */}
          <g ref={wingLeftRef} style={{ transformOrigin: 'center' }}>
            <ellipse
              cx="45"
              cy="70"
              rx="15"
              ry="20"
              fill="#f0f0f0"
              stroke="#e0e0e0"
              strokeWidth="1"
            />
          </g>
          
          {/* Right Wing */}
          <g ref={wingRightRef} style={{ transformOrigin: 'center' }}>
            <ellipse
              cx="75"
              cy="70"
              rx="15"
              ry="20"
              fill="#f0f0f0"
              stroke="#e0e0e0"
              strokeWidth="1"
            />
          </g>
          
          {/* Left Foot */}
          <g ref={footLeftRef} style={{ transformOrigin: 'center' }}>
            <ellipse
              cx="50"
              cy="100"
              rx="4"
              ry="8"
              fill="#ff8c00"
              stroke="#ff6b00"
              strokeWidth="1"
            />
          </g>
          
          {/* Right Foot */}
          <g ref={footRightRef} style={{ transformOrigin: 'center' }}>
            <ellipse
              cx="70"
              cy="100"
              rx="4"
              ry="8"
              fill="#ff8c00"
              stroke="#ff6b00"
              strokeWidth="1"
            />
          </g>
        </svg>
      </div>
    );
  }
);

GooseDancer.displayName = "GooseDancer";

export default GooseDancer;