import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GlassPanel } from '@/components/GlassPanel'
import { getTaxonomy, saveObservation, type Extraction, type Item } from '@/api'

interface ReviewStepProps {
  sourceText: string
  extraction: Extraction
  onSaved: () => void
  onBack: () => void
}

interface ItemDraft {
  modality: string | undefined
  brand: string | undefined
  model: string
  quantity: string
  ageYears: string
}

const EMPTY_ITEM: Item = { modality: null, brand: null, model: null, quantity: null, age_years: null }

function toDraft(item: Item): ItemDraft {
  return {
    modality: item.modality ?? undefined,
    brand: item.brand ?? undefined,
    model: item.model ?? '',
    quantity: item.quantity?.toString() ?? '',
    ageYears: item.age_years?.toString() ?? '',
  }
}

export function ReviewStep({ sourceText, extraction, onSaved, onBack }: ReviewStepProps) {
  const [customer, setCustomer] = useState(extraction.customer ?? '')
  const [city, setCity] = useState(extraction.city ?? '')
  const [country, setCountry] = useState(extraction.country ?? '')
  const detected = extraction.items.length
  const [items, setItems] = useState<ItemDraft[]>(() =>
    (detected ? extraction.items : [EMPTY_ITEM]).map(toDraft),
  )

  const [modalities, setModalities] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTaxonomy('modality').then(setModalities).catch(() => setModalities([]))
    getTaxonomy('brand').then(setBrands).catch(() => setBrands([]))
  }, [])

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  async function handleSave() {
    setError(null)
    setIsSaving(true)
    // Each item is its own observation. Drop items as they save, so a retry
    // after a mid-way failure doesn't re-send (and falsely corroborate) the
    // ones that already went through.
    const pending = [...items]
    try {
      while (pending.length) {
        const it = pending[0]
        await saveObservation({
          customer: customer || null,
          city: city || null,
          country: country || null,
          modality: it.modality || null,
          brand: it.brand || null,
          model: it.model || null,
          quantity: it.quantity ? Number(it.quantity) : null,
          age_years: it.ageYears ? Number(it.ageYears) : null,
          source_text: sourceText,
        })
        pending.shift()
      }
      onSaved()
    } catch (err) {
      setItems(pending)
      setError(err instanceof Error ? err.message : 'Error al guardar la observación.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <GlassPanel className="flex max-w-2xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Confirma o completa los datos
          </h2>
          <p className="text-sm text-muted-foreground">
            {detected > 1 && `QVAC detectó ${detected} tipos de equipo. `}
            Los campos vacíos son lo que QVAC no pudo inferir del texto — complétalos si los
            conoces.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="customer">Hospital / Cliente</Label>
            <Input id="customer" value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">País</Label>
            <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>

        {items.map((it, i) => (
          <fieldset
            key={i}
            className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-white/50 p-4 sm:grid-cols-2"
          >
            <div className="flex items-center justify-between sm:col-span-2">
              <legend className="text-sm font-medium text-foreground">Equipo {i + 1}</legend>
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Quitar equipo ${i + 1}`}
                >
                  <Trash2 />
                  Quitar
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Modalidad del equipo</Label>
              <Select value={it.modality} onValueChange={(v) => updateItem(i, { modality: v ?? undefined })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {modalities.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Select value={it.brand} onValueChange={(v) => updateItem(i, { brand: v ?? undefined })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={`model-${i}`}>Modelo</Label>
              <Input
                id={`model-${i}`}
                value={it.model}
                onChange={(e) => updateItem(i, { model: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`quantity-${i}`}>Cantidad</Label>
              <Input
                id={`quantity-${i}`}
                type="number"
                min={0}
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`age-${i}`}>Antigüedad (años)</Label>
              <Input
                id={`age-${i}`}
                type="number"
                min={0}
                step={0.5}
                value={it.ageYears}
                onChange={(e) => updateItem(i, { ageYears: e.target.value })}
              />
            </div>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          disabled={isSaving}
          onClick={() => setItems((prev) => [...prev, toDraft(EMPTY_ITEM)])}
        >
          <Plus />
          Agregar otro equipo
        </Button>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} disabled={isSaving}>
            Atrás
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving
              ? 'Guardando...'
              : items.length > 1
                ? `Guardar ${items.length} observaciones`
                : 'Guardar observación'}
          </Button>
        </div>
      </GlassPanel>
    </div>
  )
}
