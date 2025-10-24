"use client"

import { Settings, Info } from "lucide-react"

interface TopBarProps {
  onOpenSettings: () => void
  onOpenAbout: () => void
}

export default function TopBar({ onOpenSettings, onOpenAbout }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-background/30 px-6 py-4 backdrop-blur-xl">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Club Goose</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </button>

        <button
          onClick={onOpenAbout}
          className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Open about"
        >
          <Info className="h-4 w-4" />
          About
        </button>
      </div>
    </header>
  )
}
