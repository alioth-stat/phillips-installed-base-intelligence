import { useEffect, useState } from 'react'
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
import { getTaxonomy, saveObservation, type Fields, type SaveResult } from '@/api'

interface ReviewStepProps {
  sourceText: string
  fields: Fields
  onSaved: (result: SaveResult) => void
  onBack: () => void
}

export function ReviewStep({ sourceText, fields, onSaved, onBack }: ReviewStepProps) {
  const [customer, setCustomer] = useState(fields.customer ?? '')
  const [city, setCity] = useState(fields.city ?? '')
  const [country, setCountry] = useState(fields.country ?? '')
  const [modality, setModality] = useState(fields.modality ?? undefined)
  const [brand, setBrand] = useState(fields.brand ?? undefined)
  const [model, setModel] = useState(fields.model ?? '')
  const [quantity, setQuantity] = useState(fields.quantity?.toString() ?? '')
  const [ageYears, setAgeYears] = useState(fields.age_years?.toString() ?? '')

  const [modalities, setModalities] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTaxonomy('modality').then(setModalities).catch(() => setModalities([]))
    getTaxonomy('brand').then(setBrands).catch(() => setBrands([]))
  }, [])

  async function handleSave() {
    setError(null)
    setIsSaving(true)
    try {
      const result = await saveObservation({
        customer: customer || null,
        city: city || null,
        country: country || null,
        modality: modality || null,
        brand: brand || null,
        model: model || null,
        quantity: quantity ? Number(quantity) : null,
        age_years: ageYears ? Number(ageYears) : null,
        source_text: sourceText,
      })
      onSaved(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la observación.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <GlassPanel className="flex max-w-2xl flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Confirma o completa los datos
          </h2>
          <p className="text-sm text-muted-foreground">
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

          <div className="space-y-1.5">
            <Label>Modalidad del equipo</Label>
            <Select value={modality} onValueChange={(v) => setModality(v ?? undefined)}>
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
            <Select value={brand} onValueChange={(v) => setBrand(v ?? undefined)}>
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
            <Label htmlFor="model">Modelo</Label>
            <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              min={0}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="age">Antigüedad (años)</Label>
            <Input
              id="age"
              type="number"
              min={0}
              step={0.5}
              value={ageYears}
              onChange={(e) => setAgeYears(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={onBack} disabled={isSaving}>
            Atrás
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar observación'}
          </Button>
        </div>
      </GlassPanel>
    </div>
  )
}
