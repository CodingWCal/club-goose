"use client"

interface HudPillProps {
  label: string
  value: string | number
  variant: "tempo" | "layer"
}

export default function HudPill({ label, value, variant }: HudPillProps) {
  return (
    <div
      className="rounded-2xl border border-border/50 bg-card/80 px-5 py-3 backdrop-blur-xl"
      role="status"
      aria-label={`${label}: ${value}`}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${variant === "tempo" ? "text-primary" : "text-accent"}`}>{value}</div>
    </div>
  )
}
