"use client";

import { useState, useEffect } from "react";
import { subscribe } from "@/lib/eventBus";
import { state } from "@/lib/state";

interface VoiceCommandsHelperProps {
  voiceStatus: string;
}

export default function VoiceCommandsHelper({ voiceStatus }: VoiceCommandsHelperProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [individualLayers, setIndividualLayers] = useState(state.individualLayers);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'state.updated') {
        setIndividualLayers(state.individualLayers);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Show/hide based on voice status
  useEffect(() => {
    setIsVisible(voiceStatus === "Listening" || voiceStatus === "Ready");
  }, [voiceStatus]);

  if (!isVisible) return null;

  const activeLayers = Object.entries(individualLayers)
    .filter(([_, isActive]) => isActive)
    .map(([layer, _]) => layer);

  const getVoiceCommands = () => {
    const commands = [
      // Transport commands
      { command: "start", description: "Start music" },
      { command: "stop", description: "Stop music" },
      
      // Individual instrument commands
      { command: "lead on/off", description: "Toggle lead melody" },
      { command: "chords on/off", description: "Toggle chords" },
      { command: "kick on/off", description: "Toggle kick drum" },
      { command: "snare on/off", description: "Toggle snare" },
      { command: "hats on/off", description: "Toggle hi-hats" },
      
      // UI commands
      { command: "open settings", description: "Show settings" },
      { command: "enter club goose", description: "Club mode" },
      { command: "visuals on/off", description: "Toggle visualizer" }
    ];

    return commands;
  };

  return (
    <div className="absolute top-6 left-6 z-40">
      <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-white">Voice Commands</span>
          </div>
          <div className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
            {voiceStatus}
          </div>
        </div>

        {/* Active Layers */}
        {activeLayers.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-white/80 mb-2">Active Layers:</div>
            <div className="flex flex-wrap gap-1">
              {activeLayers.map((layer) => (
                <span
                  key={layer}
                  className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full border border-green-500/30"
                >
                  {layer}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Voice Commands List */}
        <div className="space-y-2">
          <div className="text-xs text-white/80 mb-2">Available Commands:</div>
          {getVoiceCommands().map((cmd, index) => (
            <div key={index} className="flex items-start gap-2 text-xs">
              <div className="text-white/60 font-mono min-w-0 flex-shrink-0">
                "{cmd.command}"
              </div>
              <div className="text-white/80 flex-1">
                {cmd.description}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-xs text-white/60">
            💡 Say any command to control the music
          </div>
        </div>
      </div>
    </div>
  );
}
