import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface GlassPanelProps {
  children: ReactNode
  className?: string
}

// The one floating glass surface in the app. Nothing should stack
// blur-on-blur on top of this -- content inside stays solid-colored for
// legibility over the translucent material.
export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        'w-full max-w-xl rounded-2xl border border-white/40 bg-white/60 p-8 shadow-xl backdrop-blur-xl md:p-10',
        className,
      )}
    >
      {children}
    </div>
  )
}
