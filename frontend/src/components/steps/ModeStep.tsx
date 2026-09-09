import { Camera, FileText, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlassPanel } from '@/components/GlassPanel'
import { cn } from '@/lib/utils'

interface ModeStepProps {
  onSelect: (mode: 'texto' | 'voz' | 'foto') => void
  onBack: () => void
}

const options = [
  { id: 'texto' as const, label: 'Texto', icon: FileText, desc: 'Escribe lo que observaste' },
  { id: 'voz' as const, label: 'Voz', icon: Mic, desc: 'Graba tu observación' },
  { id: 'foto' as const, label: 'Foto', icon: Camera, desc: 'Toma una foto del equipo' },
]

export function ModeStep({ onSelect, onBack }: ModeStepProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <GlassPanel className="flex flex-col items-center gap-6 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          ¿Cómo quieres capturar la observación?
        </h2>
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {options.map(({ id, label, icon: Icon, desc }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border border-border bg-white/50 p-6',
                'transition-colors hover:bg-white/80 active:scale-[0.97]',
                'transition-transform duration-150 ease-out',
              )}
            >
              <Icon className="size-8 text-primary" />
              <span className="font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" onClick={onBack}>
          Atrás
        </Button>
      </GlassPanel>
    </div>
  )
}
