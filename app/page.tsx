"use client";

import { useEffect, useRef, useState } from "react";

// Goose logic
import { registerSoundHandlers } from "@/lib/audio/soundController";
import { handleCameraStateChange } from "@/lib/vision/gestureDetector";
import { startPose, stopPose } from "@/lib/vision/poseClient";
import { subscribe, publish } from "@/lib/eventBus";
import { state, toggleCamera, setTheme } from "@/lib/state";
import { initSpeech, ensureMic, startListening } from "@/lib/voice/speechClient";
import { initTransport, startTransport } from "@/lib/audio/transport";
import { initInstruments, toggleDrums, toggleMelody } from "@/lib/audio/instruments";
import { setDebugOverlay } from "@/lib/vision/poseClient";
// Voice controller removed - using speechClient directly
import { startFaceGestures, stopFaceGestures } from "@/lib/vision/faceGestures";
import { registerVisHandlers } from "@/lib/visuals/visController";
import { registerThemeHandlers } from "@/lib/ui/themeController";
import { registerGestureHandlers } from "@/lib/gestures/gestureController";
import confetti from "canvas-confetti";

const ENABLE_FACE_GESTURES = false;

// v0 UI components
import TopBar from "./components/TopBar";
import PermissionGate from "./components/PermissionGate";
import StageCanvas from "./components/StageCanvas";
import GooseDancer from "./components/GooseDancer";
import HudPill from "./components/HudPill";
import SettingsDrawer from "./components/SettingsDrawer";
import AboutModal from "./components/AboutModal";
import FooterStatus from "./components/FooterStatus";
import SoundwaveVisualizer from "./components/SoundwaveVisualizer";
import VoiceCommandsHelper from "./components/VoiceCommandsHelper";

export default function Page() {
  // permissions + panels
  const [started, setStarted] = useState(false);
  const [cameraAllowed, setCameraAllowed] = useState(false);
  const [micAllowed, setMicAllowed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  // theme state
  const [isClubTheme, setIsClubTheme] = useState(true);
  const [theme, setThemeState] = useState<"default" | "club">(state.theme);

  // visualizer state
  const [showVisualizer, setShowVisualizer] = useState(true);

  // welcome message state
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeFading, setWelcomeFading] = useState(false);

  // HUD (stubbed until visuals/voice/state bindings land)
  const [isPlaying] = useState(false);
  const [activeLayers] = useState({ drums: false, melody: false });
  const [cameraEnabled, setCameraEnabled] = useState(state.camera.enabled);
  const [voiceStatus, setVoiceStatus] = useState<"Idle" | "Ready" | "Listening">("Idle");

  // debug video preview
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // prevent double start
  const startedRef = useRef(false);

  // canvas ref for debug overlay
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  // voice initialized flag
  const voiceInitializedRef = useRef(false);

  // goose dancer ref
  const gooseDancerRef = useRef<any>(null);

  // Voice bootstrap is now handled by the voice controller

  // one-time wiring
  useEffect(() => {
    let mounted = true;
    
    if (typeof window !== 'undefined') {
      registerSoundHandlers();   // subscribes to event bus + Tone.js
      // Gesture detector initialized dynamically based on camera state
      registerVisHandlers();     // subscribes to visual events
      registerThemeHandlers();   // subscribes to theme events
      registerGestureHandlers(); // subscribes to gesture events
      
      // Apply club theme class on initial load
      if (state.theme === "club") {
        document.documentElement.classList.add('theme-club');
      }
    }
    
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to UI events from voice/gesture commands
  useEffect(() => {
    let mounted = true;
    
    const unsubscribe = subscribe((event) => {
      if (!mounted) return;
      
      // Debug: log all UI events
      if (event.type.startsWith('ui.')) {
        console.log(`🎛️ UI Event received: ${event.type}`);
      }
      
      switch (event.type) {
        case 'ui.settings.open':
          setSettingsOpen(true);
          break;
        case 'ui.settings.close':
          console.log('🎛️ Closing settings via voice command');
          setSettingsOpen(false);
          break;
        case 'ui.about.open':
          setAboutOpen(true);
          break;
        case 'ui.about.close':
          console.log('ℹ️ Closing about via voice command');
          setAboutOpen(false);
          break;
        case 'ui.start':
          // Only allow voice start if permissions are granted
          if (cameraAllowed && micAllowed && !started) {
            onStart();
          }
          break;
        case 'ui.theme.club':
          setTheme("club");
          setThemeState("club");
          setIsClubTheme(true);
          // Add club theme class to document root
          if (typeof window !== 'undefined') {
            document.documentElement.classList.add('theme-club');
          }
          console.log('🎭 Club theme activated');
          break;
        case 'ui.theme.default':
          setTheme("default");
          setThemeState("default");
          setIsClubTheme(false);
          // Remove club theme class from document root
          if (typeof window !== 'undefined') {
            document.documentElement.classList.remove('theme-club');
          }
          console.log('🏠 Default theme activated');
          break;
        case 'ui.visuals.on':
          setShowVisualizer(true);
          console.log('👁️ Visualizer enabled');
          break;
        case 'ui.visuals.off':
          setShowVisualizer(false);
          console.log('👁️ Visualizer disabled');
          break;
        default:
          break;
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []); // Remove dependencies to prevent subscription recreation

  // Initialize voice when both permissions are granted
  useEffect(() => {
    let mounted = true;
    
    if (cameraAllowed && micAllowed && !voiceInitializedRef.current && typeof window !== 'undefined') {
      voiceInitializedRef.current = true;
      
      // Initialize speech recognition directly with comprehensive command handling
      initSpeech((text) => {
        // This callback is for backward compatibility - the real processing happens in speechClient.ts
        console.log('🎤 Voice command received:', text);
      });
      
      // Start listening immediately when permissions are granted
      startListening().then(() => {
        console.log('🎙️ Voice recognition started immediately');
      }).catch((error) => {
        console.error('Failed to start voice recognition:', error);
      });
      
      console.log('🎙️ Voice control initialized via speechClient');
    }
    
    return () => {
      mounted = false;
    };
  }, [cameraAllowed, micAllowed]);

  // permission callbacks
  const onAllowCamera = async () => setCameraAllowed(true);
  const onAllowMic = async () => setMicAllowed(true);

  // enable all layers (drums + melody)
  const enableAll = (on: boolean) => {
    toggleDrums(on);
    toggleMelody(on);
  };

  // camera toggle handler
  const handleToggleCamera = (enabled: boolean) => {
    toggleCamera(enabled);
  };

  // Beat synchronization for GooseDancer
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleBeat = () => {
      if (gooseDancerRef.current?.triggerBeat) {
        gooseDancerRef.current.triggerBeat();
      }
    };

    // Subscribe to beat events from the event bus
    const unsubscribe = subscribe((event) => {
      if (event.type === 'beat.pulse') {
        handleBeat();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Subscribe to state changes for camera updates
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const unsubscribe = subscribe((event) => {
      if (event.type === 'state.updated') {
        setCameraEnabled(state.camera.enabled);
        setThemeState(state.theme);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update voice status based on permissions and state
  useEffect(() => {
    if (micAllowed && started) {
      setVoiceStatus("Listening");
    } else if (micAllowed) {
      setVoiceStatus("Ready");
    } else {
      setVoiceStatus("Idle");
    }
  }, [micAllowed, started]);

  // Handle camera state changes dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleCameraToggle = async () => {
      if (cameraEnabled && startedRef.current) {
        // Start pose if camera is enabled and app is started
        try {
          await startPose(videoRef.current || undefined);
          setDebugOverlay(overlayRef.current, { mirror: true });
        } catch (error) {
          console.error('Failed to start pose:', error);
        }
      } else if (!cameraEnabled) {
        // Stop pose if camera is disabled
        try {
          stopPose();
        } catch (error) {
          console.error('Failed to stop pose:', error);
        }
      }
      
      // Handle gesture detector state based on camera setting
      handleCameraStateChange();
    };

    handleCameraToggle();
  }, [cameraEnabled]);

  // start conducting
  const onStart = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarted(true); // hide overlay immediately

    // Show welcome message
    setShowWelcome(true);

    // Trigger confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff']
    });

    // Start fade out after 4 seconds, then hide after 5 seconds
    setTimeout(() => {
      setWelcomeFading(true);
    }, 4000);
    
    setTimeout(() => {
      setShowWelcome(false);
      setWelcomeFading(false);
    }, 5000);

    try {
      // 1) Ask for mic under user gesture
      await ensureMic();
      
      // 2) start camera/pose (only if camera is enabled)
      if (cameraEnabled) {
        await startPose(videoRef.current || undefined);
        setDebugOverlay(overlayRef.current, { mirror: true });
      }
      
      // 3) start face gestures (only if camera is enabled)
      if (ENABLE_FACE_GESTURES && cameraEnabled) {
        const vid = document.querySelector("video");
        if (vid instanceof HTMLVideoElement) {
          await startFaceGestures(vid);
        }
      }
      
      // 4) initialize audio systems (no auto-start)
      await initTransport();
      initInstruments();
      registerSoundHandlers();      // if not already
      registerVisHandlers();        // new visual events

      // 5) Start ASR loop
      await startListening();
      
      // 6) Kick audio via our normal event
      publish({ type: "voice.start" });

    } catch (e) {
      console.error("Start failed:", e);
      startedRef.current = false;
      setStarted(false);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    let mounted = true;
    
    return () => {
      mounted = false;
      try { 
        stopPose(); 
        // Voice cleanup handled by speechClient
      } catch {}
    };
  }, []);

  // Apply club theme styling
  const rootClassName = `min-h-screen bg-gradient-to-br text-slate-100 ${
    isClubTheme 
      ? 'from-purple-900 via-pink-900 to-red-900' 
      : 'from-slate-900 via-slate-900 to-indigo-950'
  }`;

  return (
    <div className={rootClassName}>
      <TopBar onOpenSettings={() => setSettingsOpen(true)} onOpenAbout={() => setAboutOpen(true)} />

      <main className="relative h-[calc(100vh-120px)] px-4">
        {/* Debug webcam preview (off to the corner) - only show if camera enabled */}
        {cameraEnabled && (
          <>
            <video
              ref={videoRef}
              className="absolute bottom-6 left-6 w-48 h-36 rounded-xl border border-white/10 shadow-lg opacity-80 scale-x-[-1]"
              autoPlay
              playsInline
              muted
            />

            <canvas
              id="overlay"
              ref={overlayRef}
              className="absolute bottom-6 left-6 w-48 h-36 rounded-xl pointer-events-none z-50 border border-white/20"
              width={480}
              height={360}
            />
          </>
        )}

        {/* Stage */}
        <div className="h-full w-full rounded-2xl overflow-hidden relative">
          {showVisualizer ? (
            <>
              <StageCanvas isPlaying={isPlaying} bpm={120} activeLayers={activeLayers} theme={theme} />
              <SoundwaveVisualizer isPlaying={isPlaying} theme={theme} />
            </>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-slate-900 rounded-2xl">
              <p className="text-slate-400">Visualizer Off</p>
            </div>
          )}
        </div>

        {/* Goose Dancer */}
        <GooseDancer 
          ref={gooseDancerRef}
          playing={isPlaying} 
        />

        {/* Voice Commands Helper */}
        <VoiceCommandsHelper voiceStatus={voiceStatus} />

        {/* HUD */}
        <div className="absolute top-6 right-6 flex gap-2">
            <button
              onClick={() => {
                const newTheme = theme === "default" ? "club" : "default";
                setTheme(newTheme);
                setThemeState(newTheme);
                setIsClubTheme(newTheme === "club");
                publish({ type: newTheme === "club" ? "ui.theme.club" : "ui.theme.default" });
                console.log(newTheme === "club" ? "🎉 Club mode activated" : "🏠 Default mode activated");
              }}
            className="px-3 py-1.5 bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 rounded-full text-xs font-medium text-slate-200 hover:bg-slate-700/80 hover:border-slate-500/70 transition-colors cursor-pointer"
          >
            Theme: {theme === "club" ? "Club Goose" : "Default"}
          </button>
          <HudPill
            label="Layers"
            value={`${Object.values(activeLayers).filter(Boolean).length}/2 ON`}
            variant="layer"
          />
        </div>

        {/* Permissions + Start */}
        {(!cameraAllowed || !micAllowed || !started) && (
          <PermissionGate
            cameraAllowed={cameraAllowed}
            micAllowed={micAllowed}
            onAllowCamera={onAllowCamera}
            onAllowMic={onAllowMic}
            onStart={onStart}
          />
        )}
      </main>

      <FooterStatus voiceStatus={voiceStatus} />

      {/* Panels */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        sensitivity={50}
        onChangeSensitivity={() => {}}
        voiceEnabled={true}
        onToggleVoice={() => {}}
        allowKeyboardDuringSetup={true}
        onToggleKeyboard={() => {}}
        audioOutput={"default"}
        onChangeAudioOutput={() => {}}
        cameraEnabled={cameraEnabled}
        onToggleCamera={handleToggleCamera}
      />

      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* Welcome message */}
      {showWelcome && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${welcomeFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="text-center">
            <div className="text-8xl font-black text-white mb-4 drop-shadow-2xl animate-bounce" style={{ textShadow: '0 0 20px white, 0 0 40px white, 0 0 60px white' }}>
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-red-500 bg-clip-text text-transparent" style={{ WebkitTextStroke: '2px white' }}>
                WELCOME TO
              </div>
            </div>
            <div className="text-9xl font-black text-white drop-shadow-2xl animate-pulse" style={{ textShadow: '0 0 20px white, 0 0 40px white, 0 0 60px white' }}>
              <div className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 bg-clip-text text-transparent" style={{ WebkitTextStroke: '3px white' }}>
                CLUB GOOSE
              </div>
            </div>
            <div className="text-2xl font-bold text-white mt-6 drop-shadow-xl animate-pulse" style={{ textShadow: '0 0 10px white, 0 0 20px white' }}>
              <div className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent" style={{ WebkitTextStroke: '1px white' }}>
                🎵 Let's Make Some Music! 🎵
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Club theme indicator */}
      {isClubTheme && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-1 bg-pink-600/80 text-white text-sm rounded-full backdrop-blur-sm">
          🎪 Club Mode
        </div>
      )}
    </div>
  );
}
