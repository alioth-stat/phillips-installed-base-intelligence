export interface Item {
  modality: string | null
  brand: string | null
  model: string | null
  quantity: number | null
  age_years: number | null
}

// One narration can mention several equipment classes: shared visit fields
// plus one item per class, each saved as its own observation.
export interface Extraction {
  customer: string | null
  city: string | null
  country: string | null
  items: Item[]
}

// One saved observation: the visit fields plus a single item.
export interface Fields extends Omit<Extraction, 'items'>, Item {}

export interface Observation extends Fields {
  id: number
  status: string
  confidence: number
  corroboration_count: number
  source_text: string
  created_at: string
}

export interface SaveResult {
  duplicate: boolean
  id: number
  status: string
  confidence: number
}

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail || `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export function getTaxonomy(category: 'modality' | 'brand'): Promise<string[]> {
  return fetch(`/api/taxonomy?category=${category}`).then(unwrap<string[]>)
}

export function extractText(text: string): Promise<Extraction> {
  return fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).then(unwrap<Extraction>)
}

export function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, 'recording.webm')
  return fetch('/api/transcribe', { method: 'POST', body: form })
    .then(unwrap<{ text: string }>)
    .then((r) => r.text)
}

export function saveObservation(fields: Fields & { source_text: string }): Promise<SaveResult> {
  return fetch('/api/observations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }).then(unwrap<SaveResult>)
}

export function listObservations(): Promise<Observation[]> {
  return fetch('/api/observations').then(unwrap<Observation[]>)
}

export interface PhotoResult {
  description: string
  fields: Extraction
}

export function analyzePhoto(file: File | Blob): Promise<PhotoResult> {
  const form = new FormData()
  form.append('photo', file, file instanceof File ? file.name : 'photo.jpg')
  return fetch('/api/photo', { method: 'POST', body: form }).then(unwrap<PhotoResult>)
}
