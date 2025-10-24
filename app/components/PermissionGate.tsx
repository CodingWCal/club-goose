"use client"

import { motion } from "framer-motion"
import { Camera, Mic, CheckCircle2 } from "lucide-react"

interface PermissionGateProps {
  cameraAllowed: boolean
  micAllowed: boolean
  onAllowCamera: () => void
  onAllowMic: () => void
  onStart: () => void
}

export default function PermissionGate({
  cameraAllowed,
  micAllowed,
  onAllowCamera,
  onAllowMic,
  onStart,
}: PermissionGateProps) {
  const allPermissionsGranted = cameraAllowed && micAllowed

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-md"
    >
      <div className="w-full max-w-lg rounded-3xl border border-border/50 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
        <h2 className="mb-2 text-center text-3xl font-bold text-foreground">Permissions Required</h2>
        <p className="mb-8 text-center text-muted-foreground">Grant camera and microphone access to start conducting</p>

        <div className="mb-8 space-y-4">
          <button
            onClick={onAllowCamera}
            disabled={cameraAllowed}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-muted/30 p-6 transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            aria-label={cameraAllowed ? "Camera access granted" : "Allow camera access"}
          >
            <div className="flex items-center gap-4">
              <Camera className="h-6 w-6 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-foreground">Camera Access</div>
                <div className="text-sm text-muted-foreground">
                  {cameraAllowed ? "Granted" : "Required for motion tracking"}
                </div>
              </div>
            </div>
            {cameraAllowed && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          </button>

          <button
            onClick={onAllowMic}
            disabled={micAllowed}
            className="flex w-full items-center justify-between rounded-2xl border border-border bg-muted/30 p-6 transition-all hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            aria-label={micAllowed ? "Microphone access granted" : "Allow microphone access"}
          >
            <div className="flex items-center gap-4">
              <Mic className="h-6 w-6 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-foreground">Microphone Access</div>
                <div className="text-sm text-muted-foreground">
                  {micAllowed ? "Granted" : "Required for voice commands"}
                </div>
              </div>
            </div>
            {micAllowed && <CheckCircle2 className="h-6 w-6 text-green-500" />}
          </button>
        </div>

        <button
          onClick={onStart}
          disabled={!allPermissionsGranted}
          className="w-full rounded-2xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:scale-105 hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          aria-label="Start conducting"
        >
          Start Conducting
        </button>
      </div>
    </motion.div>
  )
}
