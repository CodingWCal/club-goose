"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useEffect } from "react"

interface SettingsDrawerProps {
  open: boolean
  onClose: () => void
  sensitivity: number
  onChangeSensitivity: (value: number) => void
  voiceEnabled: boolean
  onToggleVoice: (enabled: boolean) => void
  allowKeyboardDuringSetup: boolean
  onToggleKeyboard: (enabled: boolean) => void
  audioOutput: string
  onChangeAudioOutput: (value: string) => void
  cameraEnabled: boolean
  onToggleCamera: (enabled: boolean) => void
}

export default function SettingsDrawer({
  open,
  onClose,
  sensitivity,
  onChangeSensitivity,
  voiceEnabled,
  onToggleVoice,
  allowKeyboardDuringSetup,
  onToggleKeyboard,
  audioOutput,
  onChangeAudioOutput,
  cameraEnabled,
  onToggleCamera,
}: SettingsDrawerProps) {
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose()
      }
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-card shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-border p-6">
                <h2 id="settings-title" className="text-2xl font-bold text-foreground">
                  Settings
                </h2>
                <button
                  onClick={onClose}
                  className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close settings"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto p-6">
                <div>
                  <label htmlFor="sensitivity" className="mb-3 block text-sm font-medium text-foreground">
                    Motion Sensitivity
                  </label>
                  <input
                    id="sensitivity"
                    type="range"
                    min="0"
                    max="100"
                    value={sensitivity}
                    onChange={(e) => onChangeSensitivity(Number(e.target.value))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={sensitivity}
                  />
                  <div className="mt-2 text-right text-sm text-muted-foreground">{sensitivity}%</div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                  <div>
                    <div className="font-medium text-foreground">Voice Commands</div>
                    <div className="text-sm text-muted-foreground">Enable voice control</div>
                  </div>
                  <button
                    onClick={() => onToggleVoice(!voiceEnabled)}
                    className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      voiceEnabled ? "bg-primary" : "bg-muted"
                    }`}
                    role="switch"
                    aria-checked={voiceEnabled}
                    aria-label="Toggle voice commands"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                        voiceEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                  <div>
                    <div className="font-medium text-foreground">Camera & Pose Detection</div>
                    <div className="text-sm text-muted-foreground">Enable MediaPipe pose tracking</div>
                  </div>
                  <button
                    onClick={() => onToggleCamera(!cameraEnabled)}
                    className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      cameraEnabled ? "bg-primary" : "bg-muted"
                    }`}
                    role="switch"
                    aria-checked={cameraEnabled}
                    aria-label="Toggle camera and pose detection"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                        cameraEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-4">
                  <div>
                    <div className="font-medium text-foreground">Keyboard Shortcuts</div>
                    <div className="text-sm text-muted-foreground">Allow during setup</div>
                  </div>
                  <button
                    onClick={() => onToggleKeyboard(!allowKeyboardDuringSetup)}
                    className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                      allowKeyboardDuringSetup ? "bg-primary" : "bg-muted"
                    }`}
                    role="switch"
                    aria-checked={allowKeyboardDuringSetup}
                    aria-label="Toggle keyboard shortcuts"
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform ${
                        allowKeyboardDuringSetup ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label htmlFor="audio-output" className="mb-3 block text-sm font-medium text-foreground">
                    Audio Output
                  </label>
                  <select
                    id="audio-output"
                    value={audioOutput}
                    onChange={(e) => onChangeAudioOutput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="default">Default</option>
                    <option value="speakers">Speakers</option>
                    <option value="headphones">Headphones</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
