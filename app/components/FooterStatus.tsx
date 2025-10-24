"use client"

import { useEffect, useState } from "react"
import { subscribe } from "@/lib/eventBus"
import { state, type IndividualLayers } from "@/lib/state"

interface FooterStatusProps {
  voiceStatus: "Idle" | "Ready" | "Listening"
}

// Layer pill component
function LayerPill({ name, isActive }: { name: string; isActive: boolean }) {
  return (
    <div
      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
        isActive
          ? "bg-white/90 text-black shadow-sm"
          : "border border-white/40 text-white/70 hover:text-white/90"
      }`}
    >
      {name}
    </div>
  )
}

export default function FooterStatus({ voiceStatus }: FooterStatusProps) {
  const [theme, setTheme] = useState(state.theme)
  const [individualLayers, setIndividualLayers] = useState<IndividualLayers>(state.individualLayers)

  // Subscribe to global state changes
  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.type === 'state.updated') {
        setTheme(state.theme)
        setIndividualLayers(state.individualLayers)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <footer
      className="flex items-center justify-between border-t border-white/20 bg-black/50 px-6 py-3 backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-6">
        {/* Voice Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/90">Voice:</span>
          <span
            className={`flex items-center gap-2 text-sm font-semibold ${
              (voiceStatus === "Listening" || voiceStatus === "Ready") ? "text-green-400" : "text-white/70"
            }`}
          >
            {(voiceStatus === "Listening" || voiceStatus === "Ready") && <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />}
            {voiceStatus}
          </span>
        </div>

        <div className="h-4 w-px bg-white/20" aria-hidden="true" />

        {/* Theme */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/90">Theme:</span>
          <span className={`text-sm font-semibold ${theme === "club" ? "text-purple-400" : "text-white"}`}>
            {theme === "club" ? "Club" : "Default"}
          </span>
        </div>

        <div className="h-4 w-px bg-white/20" aria-hidden="true" />

        {/* Layer Indicators */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/90">Layers:</span>
          <div className="flex items-center gap-1">
            <LayerPill name="Lead" isActive={individualLayers.lead} />
            <LayerPill name="Chords" isActive={individualLayers.chords} />
            <LayerPill name="Kick" isActive={individualLayers.kick} />
            <LayerPill name="Snare" isActive={individualLayers.snare} />
            <LayerPill name="Hats" isActive={individualLayers.hats} />
          </div>
        </div>
      </div>

      <div className="text-xs text-white/70">Ready for conducting</div>
    </footer>
  )
}
