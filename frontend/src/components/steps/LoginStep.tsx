import { Button } from '@/components/ui/button'
import { GlassPanel } from '@/components/GlassPanel'

interface LoginStepProps {
  onStart: () => void
  onViewPanel: () => void
}

export function LoginStep({ onStart, onViewPanel }: LoginStepProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <GlassPanel className="flex flex-col items-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Inteligencia de Base Instalada de Clientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Reto Philips · Decentralized AI Hackathon · Extracción 100% on-device con QVAC
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button size="lg" onClick={onStart} className="sm:min-w-48">
            Nueva observación
          </Button>
          <Button size="lg" variant="secondary" onClick={onViewPanel} className="sm:min-w-48">
            Ver información recopilada
          </Button>
        </div>
      </GlassPanel>
    </div>
  )
}
