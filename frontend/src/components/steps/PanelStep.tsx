import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GlassPanel } from '@/components/GlassPanel'
import { listObservations, type Observation } from '@/api'

interface PanelStepProps {
  onNewObservation: () => void
  onBack: () => void
}

const STATUS_ES: Record<string, string> = {
  confirmed: 'Confirmado',
  reported: 'Reportado',
  estimated: 'Estimado',
  unknown: 'Desconocido',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  confirmed: 'default',
  reported: 'secondary',
  estimated: 'outline',
  unknown: 'outline',
}

const STAGGER_CAP = 10

export function PanelStep({ onNewObservation, onBack }: PanelStepProps) {
  const [observations, setObservations] = useState<Observation[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('__all__')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listObservations()
      .then(setObservations)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar el panel.'))
      .finally(() => setIsLoading(false))
  }, [])

  const customers = useMemo(
    () => Array.from(new Set(observations.map((o) => o.customer).filter((c): c is string => !!c))),
    [observations],
  )

  const filtered = useMemo(
    () =>
      selectedCustomer === '__all__'
        ? observations
        : observations.filter((o) => o.customer === selectedCustomer),
    [observations, selectedCustomer],
  )

  const aggregate = useMemo(() => {
    const groups = new Map<
      string,
      { modality: string | null; brand: string | null; cantidad: number; ages: number[]; customers: Set<string> }
    >()
    for (const o of observations) {
      const key = `${o.modality ?? ''}::${o.brand ?? ''}`
      if (!groups.has(key)) {
        groups.set(key, { modality: o.modality, brand: o.brand, cantidad: 0, ages: [], customers: new Set() })
      }
      const g = groups.get(key)!
      g.cantidad += o.quantity ?? 0
      if (o.age_years != null) g.ages.push(o.age_years)
      if (o.customer) g.customers.add(o.customer)
    }
    return Array.from(groups.values()).map((g) => ({
      modality: g.modality ?? '—',
      brand: g.brand ?? '—',
      cantidad_total: g.cantidad,
      antiguedad_promedio: g.ages.length
        ? Math.round((g.ages.reduce((a, b) => a + b, 0) / g.ages.length) * 10) / 10
        : null,
      num_clientes: g.customers.size,
    }))
  }, [observations])

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <GlassPanel className="flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Información recopilada
          </h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              Atrás
            </Button>
            <Button onClick={onNewObservation}>Nueva observación</Button>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && observations.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">
            Aún no hay observaciones registradas. Usa "Nueva observación" para agregar la primera.
          </p>
        )}

        {observations.length > 0 && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Vista por cliente</span>
                <Select value={selectedCustomer} onValueChange={(v) => setSelectedCustomer(v ?? '__all__')}>
                  <SelectTrigger className="w-48">
                    <SelectValue>{(v: string) => (v === '__all__' ? 'Todos' : v)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border bg-white/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Ciudad</TableHead>
                      <TableHead>Modalidad</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Cant.</TableHead>
                      <TableHead>Antig.</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Confianza</TableHead>
                      <TableHead>Corrob.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((o, i) => (
                      <TableRow
                        key={o.id}
                        className="animate-in fade-in slide-in-from-bottom-1"
                        style={
                          i < STAGGER_CAP
                            ? { animationDelay: `${i * 40}ms`, animationDuration: '250ms', animationFillMode: 'backwards' }
                            : undefined
                        }
                      >
                        <TableCell>{o.customer ?? '—'}</TableCell>
                        <TableCell>{o.city ?? '—'}</TableCell>
                        <TableCell>{o.modality ?? '—'}</TableCell>
                        <TableCell>{o.brand ?? '—'}</TableCell>
                        <TableCell>{o.quantity ?? '—'}</TableCell>
                        <TableCell>{o.age_years ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[o.status] ?? 'outline'}>
                            {STATUS_ES[o.status] ?? o.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{o.confidence}</TableCell>
                        <TableCell>{o.corroboration_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="space-y-3">
              <span className="text-sm font-medium text-foreground">Vista agregada entre clientes</span>
              <div className="overflow-x-auto rounded-lg border border-border bg-white/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modalidad</TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Cantidad total</TableHead>
                      <TableHead>Antigüedad promedio</TableHead>
                      <TableHead>N.º clientes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggregate.map((row, i) => (
                      <TableRow key={`${row.modality}-${row.brand}-${i}`}>
                        <TableCell>{row.modality}</TableCell>
                        <TableCell>{row.brand}</TableCell>
                        <TableCell>{row.cantidad_total}</TableCell>
                        <TableCell>{row.antiguedad_promedio ?? '—'}</TableCell>
                        <TableCell>{row.num_clientes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </GlassPanel>
    </div>
  )
}
